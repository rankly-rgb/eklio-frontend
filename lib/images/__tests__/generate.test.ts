import { describe, expect, it } from "vitest";
import {
  ImageModerationError,
  ImageTransientError,
  type ImageModelClient,
  type ImageResult,
} from "@/lib/images/client";
import { generateBrandImage } from "@/lib/images/generate";
import { slotPriceCents } from "@/lib/images/config";
import type { ImageFingerprintInput } from "@/lib/images/fingerprint";

/*
 * ── TOUTE L'ORCHESTRATION, POUR ZÉRO CENTIME ────────────────────────────
 *
 * Le client de modèle est injecté, donc chacun de ces chemins -- empreinte,
 * réservation, envoi signé, enregistrement, reprise, repli -- s'exécute sans
 * appeler l'API et sans dépenser quoi que ce soit. C'était la contrainte de
 * conception, et c'est ce test qui prouve qu'elle est tenue : si la seule
 * façon d'exercer la pipeline était l'API réelle, personne n'écrirait le
 * deuxième test.
 */

const INPUT: ImageFingerprintInput = {
  direction: { id: "dir-1", name: "Quiet Clay", tone_keywords: ["calm", "plain", "warm"] },
  palette: {
    primary: "#B4653F", secondary: "#2E4E8A", accent: "#7A8B6F",
    paper: "#FAF7F2", light_neutral: "#E8E2D9", dark_neutral: "#2B2724",
  },
  specialty: "Anxiety", city: "Austin", state: "TX",
};

const PATH = "kit-1/images/fp/hero.webp";

function stubClient(impl: () => Promise<ImageResult>): ImageModelClient & { calls: number } {
  const client = {
    calls: 0,
    async generate() {
      client.calls += 1;
      return impl();
    },
  };
  return client;
}

function ok(): Promise<ImageResult> {
  return Promise.resolve({
    bytes: Buffer.from("not-really-a-webp"),
    contentType: "image/webp",
    usage: { total_tokens: 100 },
  });
}

/**
 * A stand-in for the caller's Supabase session. Every RPC and the storage
 * upload are recorded so a test can assert what the pipeline DID, not merely
 * what it returned — "did it settle the claim" is the interesting question.
 */
function stubSupabase(overrides: Record<string, unknown> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const responses: Record<string, unknown> = {
    brand_images_claim: { claimed: true, reason: "claimed", image_id: "img-1", claim_token: "2026-09-05T20:00:00Z" },
    brand_images_path: PATH,
    brand_images_mark_ready: { ok: true, reason: "ready" },
    brand_images_mark_failed: { ok: true, reason: "failed" },
    brand_kit_has_generation_credit: true,
    consume_generation_credit: true,
    ...overrides,
  };
  const uploads: { path: string }[] = [];
  const supabase = {
    calls,
    uploads,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: responses[fn], error: null });
    },
    storage: {
      from() {
        return {
          upload(path: string) {
            uploads.push({ path });
            return Promise.resolve({ error: (responses.uploadError as Error) ?? null });
          },
        };
      },
    },
  };
  return supabase;
}

function run(supabase: ReturnType<typeof stubSupabase>, client: ImageModelClient, extra = {}) {
  return generateBrandImage({
    // The stub stands in for a real session client; the pipeline only ever
    // uses `.rpc` and `.storage`, which is exactly what it implements.
    supabase: supabase as never,
    client,
    brandKitId: "kit-1",
    slot: "hero",
    fingerprintInput: INPUT,
    userId: "user-1",
    isRegeneration: false,
    ...extra,
  });
}

describe("le chemin heureux", () => {
  it("réserve, génère, envoie, enregistre, et rend le coût de la TABLE DE PRIX", async () => {
    const supabase = stubSupabase();
    const client = stubClient(ok);
    const outcome = await run(supabase, client);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.costCents).toBe(slotPriceCents("hero"));
    expect(outcome.costCents).toBe(25);
    expect(outcome.storagePath).toBe(PATH);
    expect(supabase.uploads).toEqual([{ path: PATH }]);

    const ready = supabase.calls.find((c) => c.fn === "brand_images_mark_ready");
    expect(ready?.args.p_cost_cents).toBe(25);
    // Le coût vient du tarif, jamais du bloc `usage` de la réponse.
    expect(ready?.args.p_cost_cents).not.toBe(100);
  });

  it("un slot initial ne consomme AUCUN crédit", async () => {
    const supabase = stubSupabase();
    await run(supabase, stubClient(ok));
    expect(supabase.calls.map((c) => c.fn)).not.toContain("consume_generation_credit");
    expect(supabase.calls.map((c) => c.fn)).not.toContain("brand_kit_has_generation_credit");
  });
});

describe("les crédits", () => {
  it("une régénération vérifie AVANT et ne consomme qu'APRÈS l'enregistrement", async () => {
    const supabase = stubSupabase();
    await run(supabase, stubClient(ok), { isRegeneration: true });
    const order = supabase.calls.map((c) => c.fn);
    expect(order.indexOf("brand_kit_has_generation_credit")).toBeLessThan(
      order.indexOf("brand_images_claim")
    );
    expect(order.indexOf("consume_generation_credit")).toBeGreaterThan(
      order.indexOf("brand_images_mark_ready")
    );
  });

  it("sans crédit, rien n'est réservé et rien n'est appelé", async () => {
    const supabase = stubSupabase({ brand_kit_has_generation_credit: false });
    const client = stubClient(ok);
    const outcome = await run(supabase, client, { isRegeneration: true });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_credit");
    expect(client.calls).toBe(0);
    expect(supabase.calls.map((c) => c.fn)).not.toContain("brand_images_claim");
  });

  it("une régénération qui ÉCHOUE ne consomme aucun crédit", async () => {
    const supabase = stubSupabase();
    const client = stubClient(() => Promise.reject(new ImageTransientError("upstream 503")));
    const outcome = await run(supabase, client, { isRegeneration: true });
    expect(outcome.ok).toBe(false);
    expect(supabase.calls.map((c) => c.fn)).not.toContain("consume_generation_credit");
  });
});

describe("la reprise : une seule, et jamais sur une modération", () => {
  it("un échec transitoire est retenté exactement une fois", async () => {
    let attempt = 0;
    const client = stubClient(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new ImageTransientError("upstream 503"));
      return ok();
    });
    const outcome = await run(stubSupabase(), client);
    expect(client.calls).toBe(2);
    expect(outcome.ok).toBe(true);
  });

  it("deux échecs transitoires s'arrêtent là -- jamais de boucle", async () => {
    const supabase = stubSupabase();
    const client = stubClient(() => Promise.reject(new ImageTransientError("upstream 503")));
    const outcome = await run(supabase, client);
    expect(client.calls).toBe(2);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("failed");

    const failed = supabase.calls.find((c) => c.fn === "brand_images_mark_failed");
    expect(failed?.args.p_status).toBe("failed");
    expect(failed?.args.p_failure_reason).toBeTruthy();
  });

  it("une MODÉRATION n'est jamais retentée, et est terminale", async () => {
    // Le point qui compte : un refus de politique de contenu est un défaut de
    // prompt. Le retenter dépense de l'argent pour se faire refuser encore.
    const supabase = stubSupabase();
    const client = stubClient(() => Promise.reject(new ImageModerationError("content policy")));
    const outcome = await run(supabase, client);
    expect(client.calls).toBe(1);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("moderated");

    const failed = supabase.calls.find((c) => c.fn === "brand_images_mark_failed");
    expect(failed?.args.p_status).toBe("moderated");
  });
});

describe("les refus de la base sont transmis tels quels", () => {
  it.each([
    ["disabled", "disabled"],
    ["budget_exceeded", "budget_exceeded"],
    ["busy", "busy"],
    ["already_ready", "already_ready"],
    ["already_moderated", "already_moderated"],
    ["payment_required", "payment_required"],
  ])("« %s » n'appelle jamais le modèle", async (reason, expected) => {
    const supabase = stubSupabase({
      brand_images_claim: { claimed: false, reason, image_id: null, claim_token: null },
    });
    const client = stubClient(ok);
    const outcome = await run(supabase, client);
    expect(client.calls).toBe(0);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe(expected);
    expect(outcome.message).not.toBe("");
  });
});

describe("le repli", () => {
  it("un slot désactivé ne réserve rien et n'appelle rien", async () => {
    const supabase = stubSupabase();
    const client = stubClient(ok);
    const outcome = await generateBrandImage({
      supabase: supabase as never,
      client,
      brandKitId: "kit-1",
      slot: "texture",
      fingerprintInput: INPUT,
      userId: "user-1",
      isRegeneration: false,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("slot_disabled");
    expect(client.calls).toBe(0);
    expect(supabase.calls).toEqual([]);
  });

  it("un envoi qui échoue règle la réservation plutôt que de la laisser pendre", async () => {
    const supabase = stubSupabase({ uploadError: new Error("storage said no") });
    const outcome = await run(supabase, stubClient(ok));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("upload_failed");
    expect(supabase.calls.map((c) => c.fn)).toContain("brand_images_mark_failed");
  });

  it("une réservation reprise par un autre ne prétend pas avoir gagné", async () => {
    const supabase = stubSupabase({ brand_images_mark_ready: { ok: false, reason: "stale_claim" } });
    const outcome = await run(supabase, stubClient(ok));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("stale_claim");
  });
});

describe("le plafond demandé", () => {
  it("la réservation est le prix du tarif, pas zéro", async () => {
    const supabase = stubSupabase();
    await run(supabase, stubClient(ok));
    const claim = supabase.calls.find((c) => c.fn === "brand_images_claim");
    expect(claim?.args.p_cost_estimate_cents).toBe(25);
    expect(claim?.args.p_daily_cap_cents).toBe(2000);
  });
});
