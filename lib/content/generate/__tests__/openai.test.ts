import { describe, expect, it, vi } from "vitest";
import {
  ProviderRejected,
  ProviderUnavailable,
  SpendCapReached,
  cacheDiscountApplied,
  meteredCall,
  openAiCostUsd,
  openAiTransport,
  spendMeter,
  worstCaseCallUsd,
} from "@/lib/content/generate/openai";
import { syncCostUsd } from "@/lib/content/generate/copy-batch";
import { OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";

/*
 * ── LE TRANSPORT, LE COÛT ET LE COMPTEUR, SANS UN APPEL ─────────────────
 *
 * Le transport réel est éprouvé par de vrais appels (planche du premier mois).
 * Ici, tout ce qui DÉCIDE : quel refus se relance, ce qu'un usage coûte, et quand
 * le compteur refuse d'envoyer.
 */

const MODEL = OPENAI_COPY_MODEL;
const NO_WAIT = { delayMs: () => 0 };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("le coût OpenAI ne compte pas le cache deux fois", () => {
  /*
   * ⚠ LA SONDE DU 2026-10-04 : 1 972 tokens d'entrée les deux fois, dont 1 969
   * écrits puis 1 969 lus. `input_tokens` CONTIENT le cache.
   */
  const written = { input: 1972, output: 62, cacheRead: 0, cacheWrite: 1969 };
  const read = { input: 1972, output: 49, cacheRead: 1969, cacheWrite: 0 };

  it("2 $ l'entrée, 12 $ la sortie, par MTok", () => {
    expect(openAiCostUsd(MODEL, { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(2, 9);
    expect(openAiCostUsd(MODEL, { input: 0, output: 1e6, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(12, 9);
  });

  it("une écriture en cache ne s'ajoute pas à l'entrée", () => {
    expect(openAiCostUsd(MODEL, written)).toBeCloseTo((1972 * 2 + 62 * 12) / 1e6, 12);
  });

  /*
   * ⚠ LE TARIF DU CACHE N'A PAS ÉTÉ LU : la lecture coûte une entrée pleine. Le
   * chiffre est une borne haute, et `cacheDiscountApplied` le dit.
   */
  it("une lecture en cache est facturée pleine, faute de tarif lu", () => {
    expect(cacheDiscountApplied(MODEL)).toBe(false);
    expect(openAiCostUsd(MODEL, read)).toBeCloseTo((1972 * 2 + 49 * 12) / 1e6, 12);
  });

  /*
   * ⚠ LA JONCTION QUI AURAIT FLATTÉ… ET FAUSSÉ : la formule d'Anthropic sur un
   * usage OpenAI. Elle refuse désormais au lieu de rendre un chiffre.
   */
  it("la formule d'Anthropic refuse un modèle OpenAI", () => {
    const before = process.env.CONTENT_COPY_MODEL;
    process.env.CONTENT_COPY_MODEL = MODEL;
    try {
      expect(() => syncCostUsd(written)).toThrow(/openAiCostUsd/);
    } finally {
      if (before === undefined) delete process.env.CONTENT_COPY_MODEL;
      else process.env.CONTENT_COPY_MODEL = before;
    }
  });

  it("un modèle au tarif non lu refuse de se chiffrer", () => {
    expect(() => openAiCostUsd("gpt-5.6-luna", written)).toThrow(/tarif n'a pas été lu/);
  });
});

describe("le transport relance le passager, et rien d'autre", () => {
  it("un solde épuisé ne se relance pas", async () => {
    const fetchImpl = vi.fn(async () =>
      reply(429, { error: { code: "insufficient_quota", message: "You exceeded your current quota" } })
    );
    const t = openAiTransport("sk-test-SECRET", { fetchImpl: fetchImpl as never, ...NO_WAIT });
    await expect(t({})).rejects.toMatchObject({ reason: "no_credit" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("une limite de débit se relance, puis passe", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply(429, { error: { code: "rate_limit_exceeded", message: "slow down" } }))
      .mockResolvedValueOnce(reply(200, { status: "completed", output_text: "{}" }));
    const t = openAiTransport("sk-test-SECRET", { fetchImpl: fetchImpl as never, ...NO_WAIT });
    await expect(t({})).resolves.toMatchObject({ status: "completed" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("un 400 est notre faute : il ne se relance pas", async () => {
    const fetchImpl = vi.fn(async () => reply(400, { error: { code: "invalid_json_schema", message: "bad" } }));
    const t = openAiTransport("sk-test-SECRET", { fetchImpl: fetchImpl as never, ...NO_WAIT });
    await expect(t({})).rejects.toBeInstanceOf(ProviderRejected);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("des 5xx répétés finissent en indisponible, pas en refus de rédaction", async () => {
    const fetchImpl = vi.fn(async () => reply(503, { error: { message: "overloaded" } }));
    const t = openAiTransport("sk-test-SECRET", { fetchImpl: fetchImpl as never, retries: 2, ...NO_WAIT });
    await expect(t({})).rejects.toBeInstanceOf(ProviderUnavailable);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  /* ⚠ LA CLEF NE SORT DANS AUCUN MESSAGE, même quand le fournisseur la cite. */
  it("la clef n'apparaît dans aucune erreur", async () => {
    const fetchImpl = vi.fn(async () =>
      reply(401, { error: { code: "invalid_api_key", message: "Incorrect API key provided" } })
    );
    const t = openAiTransport("sk-test-SECRET", { fetchImpl: fetchImpl as never, ...NO_WAIT });
    const error = await t({}).catch((e: Error) => e);
    expect(String((error as Error).message)).not.toContain("SECRET");
    const sent = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(String(sent.body)).not.toContain("SECRET");
  });
});

describe("le compteur refuse avant d'envoyer", () => {
  const body = { instructions: "x".repeat(3000), input: "y".repeat(300), max_output_tokens: 2000 };

  it("le pire coût surestime l'entrée et prend la sortie au plafond", () => {
    expect(worstCaseCallUsd(MODEL, body)).toBeCloseTo(((3300 / 3 + 2) * 2 + 2000 * 12) / 1e6, 3);
  });

  it("un appel qui franchirait le plafond n'est pas envoyé", async () => {
    const meter = spendMeter(0.01, 0.0);
    const transport = vi.fn();
    await expect(meteredCall(transport, meter, MODEL, body, "test")).rejects.toBeInstanceOf(SpendCapReached);
    expect(transport, "l'appel est parti malgré le plafond").not.toHaveBeenCalled();
  });

  /*
   * ⚠ DES APPELS CONCURRENTS NE FRANCHISSENT PAS LE PLAFOND À EUX TOUS. Chacun
   * réserve son pire coût ; le second voit la réserve du premier.
   */
  it("deux appels en vol réservent chacun leur pire coût", async () => {
    const worst = worstCaseCallUsd(MODEL, body);
    const meter = spendMeter(worst * 1.5);
    let release: () => void = () => {};
    const transport = vi.fn(
      () => new Promise((resolve) => { release = () => resolve({ usage: { input_tokens: 10, output_tokens: 1 } }); })
    );
    const first = meteredCall(transport as never, meter, MODEL, body, "premier");
    await expect(meteredCall(transport as never, meter, MODEL, body, "second")).rejects.toBeInstanceOf(SpendCapReached);
    release();
    await first;
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("la réponse remplace la réserve par le coût réel", async () => {
    const meter = spendMeter(1);
    const transport = vi.fn(async () => ({
      usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 800 } },
    }));
    const { costUsd } = await meteredCall(transport, meter, MODEL, body, "test");
    expect(costUsd).toBeCloseTo((1000 * 2 + 100 * 12) / 1e6, 12);
    expect(meter.spentUsd()).toBeCloseTo(costUsd, 12);
    expect(meter.usage()).toEqual({ input: 1000, output: 100, cacheRead: 800, cacheWrite: 0 });
  });

  /*
   * ⚠ UNE COUPURE APRÈS ENVOI EST COMPTÉE À SON PIRE COÛT. Elle a pu être
   * facturée ; compter zéro est la seule erreur qui laisse franchir le plafond.
   */
  it("une coupure réseau est comptée au pire, un refus franc à zéro", async () => {
    const worst = worstCaseCallUsd(MODEL, body);
    const cut = spendMeter(1);
    await meteredCall(
      async () => { throw new ProviderUnavailable("errored", "réseau"); }, cut, MODEL, body, "t"
    ).catch(() => {});
    expect(cut.spentUsd()).toBeCloseTo(worst, 12);

    const refused = spendMeter(1);
    await meteredCall(
      async () => { throw new ProviderUnavailable("no_credit", "solde"); }, refused, MODEL, body, "t"
    ).catch(() => {});
    expect(refused.spentUsd()).toBe(0);
  });
});
