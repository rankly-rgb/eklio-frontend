import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  isSiteError,
  siteOutputMarkCopied,
  siteSpecFixContrast,
  siteSpecGet,
  siteSpecPatch,
} from "@/lib/site/rpc";
import { CLAY_AND_SAND } from "@/lib/site/__tests__/envelope.fixture";

/*
 * La couche d'appel : les arguments partent avec le bon nom, l'enveloppe
 * revient intacte, et l'enveloppe d'erreur du contrat devient un code d'état.
 */

type Rpc = ReturnType<typeof stub>;

function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

function lastCall(rpc: Rpc["rpc"]) {
  return rpc.mock.calls[rpc.mock.calls.length - 1];
}

describe("les arguments du contrat", () => {
  it("site_spec_get envoie p_brand_kit_id", async () => {
    const { rpc, client } = stub(CLAY_AND_SAND);
    await siteSpecGet(client, "kit-1");
    expect(lastCall(rpc)).toEqual([
      "site_spec_get",
      { p_brand_kit_id: "kit-1" },
    ]);
  });

  it("site_spec_patch envoie le patch sous p_patch", async () => {
    const { rpc, client } = stub(CLAY_AND_SAND);
    await siteSpecPatch(client, "kit-1", { primary: "#123456" });
    expect(lastCall(rpc)).toEqual([
      "site_spec_patch",
      { p_brand_kit_id: "kit-1", p_patch: { primary: "#123456" } },
    ]);
  });

  it("fix_contrast envoie un pair_id, jamais un hex", async () => {
    const { rpc, client } = stub(CLAY_AND_SAND);
    await siteSpecFixContrast(client, "kit-1", "secondary_on_paper");
    const [, args] = lastCall(rpc);
    expect(args).toEqual({
      p_brand_kit_id: "kit-1",
      p_pair_id: "secondary_on_paper",
    });
    // La suggestion est recalculée en base : lui envoyer un hex serait celui
    // d'avant l'écriture précédente.
    expect(JSON.stringify(args)).not.toContain("#");
  });
});

describe("l'enveloppe revient telle qu'elle arrive", () => {
  it("ne retire rien, pas même une clé que le front ne connaît pas", async () => {
    const withExtra = { ...CLAY_AND_SAND, future_key: { anything: true } };
    const { client } = stub(withExtra);

    const result = await siteSpecGet(client, "kit-1");

    expect(result.ok).toBe(true);
    // Le contrat dit « return what comes back ». Un schéma qui filtre les clés
    // ferait disparaître en silence tout ce que la base ajoutera ensuite.
    expect(result.ok && result.data).toEqual(withExtra);
  });
});

describe("les codes d'erreur du contrat", () => {
  it.each([
    ["not_found", 404],
    ["unauthenticated", 401],
    ["too_long", 400],
    ["invalid_target", 400],
    ["unknown_field", 400],
  ])("%s remonte en %i", async (code, status) => {
    const { client } = stub({ error: { code, message: "…" } });
    const result = await siteSpecGet(client, "kit-1");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.status).toBe(status);
    expect(!result.ok && result.error.code).toBe(code);
  });

  it("no_fix_needed a son propre code : ce n'est pas une faute de l'utilisatrice", async () => {
    const { client } = stub({
      error: {
        code: "no_fix_needed",
        field: "pair_id",
        message: "Body text on the page already reaches AA contrast.",
      },
    });
    const result = await siteSpecFixContrast(client, "kit-1", "dark_neutral_on_paper");

    // 409 et non 400 : le client doit pouvoir en faire un NO-OP sans lire le
    // message. La paire passait déjà — il n'y a rien à corriger, ni à dire.
    expect(!result.ok && result.status).toBe(409);
  });

  it("une panne de transport ne se déguise pas en refus du contrat", async () => {
    const { client } = stub(null, { message: "connection reset" });
    const result = await siteOutputMarkCopied(client, "kit-1");

    expect(!result.ok && result.status).toBe(500);
  });

  it("conserve le champ fautif, qui est ce qui rend l'erreur affichable en ligne", async () => {
    const { client } = stub({
      error: {
        code: "too_long",
        field: "hero.headline",
        message: "This is 91 characters. The limit is 90.",
      },
    });
    const result = await siteSpecPatch(client, "kit-1", {});

    expect(!result.ok && result.error.field).toBe("hero.headline");
  });
});

describe("isSiteError", () => {
  it("ne prend pas une enveloppe valide pour une erreur", () => {
    expect(isSiteError(CLAY_AND_SAND)).toBe(false);
  });

  it("reconnaît la forme du contrat", () => {
    expect(isSiteError({ error: { code: "not_found", message: "x" } })).toBe(true);
  });

  it("refuse une clé `error` qui n'a pas la forme du contrat", () => {
    // Une chaîne sous `error` vient d'ailleurs — de nos propres helpers HTTP,
    // par exemple. La confondre ferait passer un 500 pour un refus métier.
    expect(isSiteError({ error: "boom" })).toBe(false);
    expect(isSiteError(null)).toBe(false);
  });
});

describe("`payment_required` — une offre, pas une erreur", () => {
  it("remonte en 402", async () => {
    const { client } = stub({
      error: {
        code: "payment_required",
        message: "This kit isn't unlocked yet.",
      },
    });
    const result = await siteSpecGet(client, "kit-1");

    // 402 est le seul code dont le sens est « voici comment continuer » plutôt
    // que « vous avez fait quelque chose de mal ». Le client ouvre le checkout.
    expect(!result.ok && result.status).toBe(402);
    expect(!result.ok && result.error.code).toBe("payment_required");
  });

  it("vaut pour toutes les entrées, pas seulement la lecture", async () => {
    // La barrière est en base : une route qui oublierait de vérifier ne reçoit
    // rien, au lieu de tout.
    for (const call of [siteSpecPatch, siteSpecFixContrast]) {
      const { client } = stub({
        error: { code: "payment_required", message: "…" },
      });
      const result = await call(client, "kit-1", {} as never);
      expect(!result.ok && result.status).toBe(402);
    }
  });

  it("ne se confond pas avec `unauthenticated`", async () => {
    // 401 veut dire « connectez-vous » ; 402 veut dire « payez ». Les
    // confondre enverrait une praticienne connectée sur un écran de login.
    const { client } = stub({
      error: { code: "unauthenticated", message: "Sign in to edit your site spec." },
    });
    expect((await siteSpecGet(client, "k")).ok).toBe(false);
    const result = await siteSpecGet(client, "k");
    expect(!result.ok && result.status).toBe(401);
  });
});
