import { describe, expect, it, vi } from "vitest";
import {
  ContentImageModerationError,
  ContentImageTransientError,
} from "@/lib/content/images/client";
import {
  CONTENT_IMAGE_MODEL,
  CONTENT_IMAGE_SIZE,
  ContentImageQualityError,
  ESTIMATE_DRIFT_WARN,
  IMAGE_OUTPUT_PER_MTOK,
  estimatedCostUsd,
  imageCostUsd,
  resolveQuality,
} from "@/lib/content/images/config";
import {
  customVisualPath,
  generateCustomVisual,
  promptHash,
  type CustomVisualDeps,
} from "@/lib/content/images/generate";
import { FIXTURE_USAGE, fixtureImageClient } from "@/lib/content/images/fixture-client";

/*
 * ⚠ TOUT CE QUI SORT DE CE FICHIER VIENT D'UNE FIXTURE. Aucun appel n'a touché
 * OpenAI, et les jetons de `FIXTURE_USAGE` sont un ordre de grandeur plausible
 * et non une valeur observée. Ce qui est éprouvé ici est le CHAÎNAGE, pas le
 * coût d'une vraie image.
 */

const KIT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function deps(over: Partial<CustomVisualDeps> = {}): CustomVisualDeps & {
  calls: { n: number };
  ledger: string[];
  uploads: string[];
} {
  const calls = { n: 0 };
  const ledger: string[] = [];
  const uploads: string[] = [];
  return {
    calls,
    ledger,
    uploads,
    client: fixtureImageClient({ calls }),
    lookup: async () => null,
    reserve: async () => {
      ledger.push("reserve");
      return { ok: true, reason: "reserved", reservationId: "res-1" };
    },
    upload: async (path) => {
      uploads.push(path);
    },
    record: async ({ storagePath }) => {
      ledger.push("settle");
      return { ok: true, reason: "generated", storagePath };
    },
    release: async () => {
      ledger.push("release");
    },
    warn: () => {},
    ...over,
  };
}

describe("la qualité est refusée par le code, pas déconseillée", () => {
  it("accepte low et medium", () => {
    expect(resolveQuality("low", "medium")).toBe("low");
    expect(resolveQuality("medium", "medium")).toBe("medium");
  });

  /*
   * ⚠ `high` EXISTE CHEZ LE MODÈLE ET N'EST PAS ACHETÉE ICI. Une variable mal
   * réglée échoue avant l'appel, et la ligne de `custom_visual_generations`
   * porte le même refus.
   */
  it("refuse high, xhigh et max", () => {
    for (const q of ["high", "xhigh", "max"]) {
      expect(() => resolveQuality(q, "medium")).toThrow(ContentImageQualityError);
    }
  });

  /*
   * ⚠ `auto` LAISSE LE MODÈLE CHOISIR. Un plafond qu'une autre partie décide
   * n'est pas un plafond.
   */
  it("refuse auto, qui n'est pas une position dans l'ordre de dépense", () => {
    expect(() => resolveQuality("auto", "medium")).toThrow(ContentImageQualityError);
  });

  it("un plafond relevé par configuration ouvre bien le palier", () => {
    expect(resolveQuality("high", "high")).toBe("high");
  });
});

describe("le coût vient d'`usage`, jamais d'une table de prix", () => {
  it("valorise les jetons de sortie image à 30 $ le million", () => {
    expect(imageCostUsd({ output_tokens: 1_000_000 })).toBeCloseTo(IMAGE_OUTPUT_PER_MTOK, 9);
    expect(imageCostUsd({ output_tokens: 1_560 })).toBeCloseTo((1_560 / 1e6) * 30, 9);
  });

  /*
   * ⚠ PAS DE COÛT SANS `usage`. Ce modèle n'a pas de prix forfaitaire par
   * image : une réponse muette ne peut pas être valorisée, et écrire un
   * nombre inventé dans une colonne nommée `actual_cost_usd` serait pire
   * qu'une colonne vide.
   */
  it("rend null quand l'API n'a rien dit", () => {
    expect(imageCostUsd(null)).toBeNull();
    expect(imageCostUsd({})).toBeNull();
    expect(imageCostUsd({ output_tokens: null })).toBeNull();
    expect(imageCostUsd({ output_tokens: -1 })).toBeNull();
  });

  it("ne dépend d'aucune table (modèle, qualité, taille)", async () => {
    // Anti-vacuité de la décision : si une table forfaitaire réapparaissait,
    // deux appels de qualités différentes mais de même `usage` divergeraient.
    expect(imageCostUsd(FIXTURE_USAGE.low)).toBe(imageCostUsd({ output_tokens: 1_560 }));
  });
});

describe("le hachage de prompt", () => {
  it("est un SHA-256 minuscule, la forme que la base exige", () => {
    expect(promptHash("a prompt", CONTENT_IMAGE_MODEL, "low", CONTENT_IMAGE_SIZE)).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  /*
   * ⚠ LE MODÈLE ET LA QUALITÉ SONT DEDANS. Sans eux, changer de configuration
   * serait invisible et le cache servirait indéfiniment ce que l'ancienne
   * configuration avait produit.
   */
  it("change avec la qualité", () => {
    expect(promptHash("p", CONTENT_IMAGE_MODEL, "low", CONTENT_IMAGE_SIZE)).not.toBe(
      promptHash("p", CONTENT_IMAGE_MODEL, "medium", CONTENT_IMAGE_SIZE)
    );
  });

  it("change avec le modèle", () => {
    expect(promptHash("p", "gpt-image-2.5-flare", "low", CONTENT_IMAGE_SIZE)).not.toBe(
      promptHash("p", "gpt-image-2.5-flare-2026-09-08", "low", CONTENT_IMAGE_SIZE)
    );
  });

  it("le chemin de stockage commence par le kit, comme la ligne l'exige", () => {
    expect(customVisualPath(KIT, "a".repeat(64)).startsWith(`${KIT}/`)).toBe(true);
  });
});

describe("le chaînage complet, sur fixture", () => {
  it("réserve, appelle, lit usage, stocke, règle", async () => {
    const d = deps();
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "a quiet room" },
      d
    );

    expect(out.ok).toBe(true);
    expect(out.reason).toBe("generated");
    expect(d.ledger).toEqual(["reserve", "settle"]);
    expect(d.calls.n).toBe(1);
    expect(d.uploads).toHaveLength(1);
    // Le coût est celui de la fixture, valorisé depuis ses jetons.
    expect(out.ok && out.reason === "generated" && out.costUsd).toBeCloseTo(
      (FIXTURE_USAGE.low.output_tokens! / 1e6) * 30,
      9
    );
  });

  /*
   * ⚠ PREUVE DE DÉDUPLICATION, NIVEAU (b). Un `prompt_hash` déjà généré ne
   * déclenche NI appel image NI décompte de crédit.
   */
  it("un prompt déjà généré n'appelle rien et ne réserve rien", async () => {
    const d = deps({ lookup: async () => `${KIT}/custom/cached.png` });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "a quiet room" },
      d
    );

    expect(out).toMatchObject({ ok: true, reason: "cached", calledModel: false, costUsd: 0 });
    expect(d.calls.n).toBe(0);
    expect(d.ledger).toEqual([]);
    expect(d.uploads).toEqual([]);
  });

  it("deux demandes du même prompt : un seul appel, un seul crédit", async () => {
    let stored: string | null = null;
    const d = deps({
      lookup: async () => stored,
      record: async ({ storagePath }) => {
        stored = storagePath;
        d.ledger.push("settle");
        return { ok: true, reason: "generated", storagePath };
      },
    });

    const input = { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "a quiet room" };
    await generateCustomVisual(input, d);
    const second = await generateCustomVisual(input, d);

    expect(second).toMatchObject({ reason: "cached", calledModel: false });
    expect(d.calls.n).toBe(1);
    expect(d.ledger.filter((e) => e === "reserve")).toHaveLength(1);
  });
});

describe("les refus et les pannes", () => {
  /*
   * ⚠ LE PLAFOND EST EN SQL. Cette fonction ne sait pas ce qu'est un quota :
   * elle sait qu'on lui a répondu non, et elle s'arrête avant d'appeler.
   */
  it("un quota épuisé n'appelle rien", async () => {
    const d = deps({
      reserve: async () => ({ ok: false, reason: "quota_exhausted", reservationId: null }),
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out).toMatchObject({ ok: false, reason: "quota_exhausted", calledModel: false });
    expect(d.calls.n).toBe(0);
  });

  it("une absence de droit n'appelle rien non plus", async () => {
    const d = deps({
      reserve: async () => ({ ok: false, reason: "not_entitled", reservationId: null }),
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out).toMatchObject({ ok: false, reason: "not_entitled", calledModel: false });
    expect(d.calls.n).toBe(0);
  });

  /*
   * ⚠ UNE MODÉRATION N'EST PAS RÉESSAYÉE. Un prompt refusé le sera autant de
   * fois qu'on le posera, et chaque fois coûtera.
   */
  it("une modération est terminale et rend le crédit", async () => {
    const calls = { n: 0 };
    const d = deps({
      client: fixtureImageClient({ calls, throws: new ContentImageModerationError("refused") }),
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out).toMatchObject({ ok: false, reason: "moderated" });
    expect(calls.n).toBe(1);
    expect(d.ledger).toEqual(["reserve", "release"]);
  });

  it("une panne a exactement un réessai", async () => {
    const calls = { n: 0 };
    const d = deps({
      client: {
        async generate(request) {
          calls.n += 1;
          if (calls.n === 1) throw new ContentImageTransientError("429");
          return fixtureImageClient().generate(request);
        },
      },
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out.ok).toBe(true);
    expect(calls.n).toBe(2);
  });

  it("deux pannes d'affilée rendent le crédit, sans boucle", async () => {
    const calls = { n: 0 };
    const d = deps({
      client: fixtureImageClient({ calls, throws: new ContentImageTransientError("429") }),
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out).toMatchObject({ ok: false, reason: "failed" });
    expect(calls.n).toBe(2);
    expect(d.ledger).toEqual(["reserve", "release"]);
  });

  it("un échec de stockage rend le crédit plutôt que d'écrire une ligne sans octets", async () => {
    const d = deps({
      upload: async () => {
        throw new Error("bucket unreachable");
      },
    });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(out).toMatchObject({ ok: false, reason: "upload_failed" });
    expect(d.ledger).toEqual(["reserve", "release"]);
  });
});

describe("la dérive d'estimation se dénonce", () => {
  it("journalise un warning au-delà de 50 %", async () => {
    const warn = vi.fn();
    const d = deps({
      // Quatre fois l'estimation : la dérive est de 300 %.
      client: fixtureImageClient({ usage: { output_tokens: 6_000 } }),
      warn,
    });
    await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/estimate drift/);
    expect(warn.mock.calls[0][0]).toMatch(/ESTIMATED_OUTPUT_TOKENS/);
  });

  it("se tait quand l'estimation tient", async () => {
    const warn = vi.fn();
    const d = deps({ warn });
    await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("le seuil est bien 50 %, et il est franchi des deux côtés", async () => {
    expect(ESTIMATE_DRIFT_WARN).toBe(0.5);
    const estimated = estimatedCostUsd("low");
    // Juste sous le seuil : 1,4× l'estimation.
    const under = vi.fn();
    await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      deps({
        client: fixtureImageClient({ usage: { output_tokens: Math.round(1_500 * 1.4) } }),
        warn: under,
      })
    );
    expect(under).not.toHaveBeenCalled();
    expect(estimated).toBeGreaterThan(0);
  });

  it("une réponse sans usage ne déclenche pas de faux warning", async () => {
    const warn = vi.fn();
    const d = deps({ client: fixtureImageClient({ usage: null }), warn });
    const out = await generateCustomVisual(
      { brandKitId: KIT, userId: USER, contentItemId: null, prompt: "p" },
      d
    );
    expect(warn).not.toHaveBeenCalled();
    // Et le coût réel est null, pas zéro : on n'a pas mesuré, on ne prétend pas.
    expect(out.ok && out.reason === "generated" && out.costUsd).toBeNull();
  });
});
