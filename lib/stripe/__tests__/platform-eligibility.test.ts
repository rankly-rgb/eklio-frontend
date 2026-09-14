import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ── L'ÉLIGIBILITÉ N'EST PAS UN REFUS ────────────────────────────────────
 *
 * Correction d'une erreur de spec. `20260914120000_platform_qualification.sql`
 * disait : « les autres sont refusées à l'inscription ». L'ancienne offre
 * n'étant pas retirée de la vente — et ne promettant AUCUNE publication —, un
 * refus renvoyait une cliente qu'on savait encore servir.
 *
 * Ce que ce fichier exige, dans les deux sens :
 *
 *   ce qui promet de publier      fermé si on ne publie pas chez elle
 *   tout le reste                 ouvert, toujours
 *
 * ⚠ ET LA SECONDE MOITIÉ EST LA PLUS IMPORTANTE. Un fichier qui ne
 * vérifierait que les fermetures serait vert le jour où la garde referme tout,
 * ce qui est précisément l'erreur corrigée ici.
 *
 * Son jumeau SQL : eklio-backend/supabase/tests/20260914200000_eligibility.test.sql
 */

const sessionsCreate = vi.fn(() => {
  throw new Error("Stripe appelé pour un SKU que sa plateforme ne porte pas.");
});
const customersCreate = vi.fn(() => {
  throw new Error("Customer Stripe créé avant la décision d'éligibilité.");
});

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: sessionsCreate } },
    customers: { create: customersCreate },
  }),
  kitPriceId: () => "price_test",
  monthlyPresencePriceId: () => "price_test_monthly",
  StripeConfigError: class StripeConfigError extends Error {},
}));
vi.mock("@/lib/site-url", () => ({ siteUrl: () => "https://example.test" }));

import {
  PlatformNotEligibleError,
  UnsellableSkuError,
  createCheckoutSession,
} from "@/lib/stripe/checkout";

/** `plans`, vérifiée contre le projet vivant le 14 septembre 2026. */
const PLANS: Record<string, { sellable: boolean; gated: boolean }> = {
  free: { sellable: true, gated: false },
  starter: { sellable: true, gated: false },
  practice: { sellable: true, gated: false },
  signature: { sellable: true, gated: false },
  identity_addon: { sellable: true, gated: false },
  foundation: { sellable: true, gated: true },
  roster: { sellable: true, gated: true },
  roster_seat: { sellable: false, gated: false },
  fill_solo: { sellable: false, gated: true },
  fill_practice: { sellable: false, gated: true },
};

const PLATFORMS = [
  { id: "wordpress", label: "WordPress", status: "accepted", notice: null },
  {
    id: "wix",
    label: "Wix",
    status: "refused",
    notice: "We do not publish to Wix yet.",
  },
  {
    id: "maybe",
    label: "Maybe",
    status: "conditional",
    notice: "We are still confirming.",
  },
];

function fakeSupabase(platformId: string | null) {
  const readOrder: string[] = [];
  return {
    from(table: string) {
      readOrder.push(table);
      if (table === "plans") {
        return {
          select: () => ({
            eq: (_c: string, sku: string) => ({
              maybeSingle: async () => {
                const row = PLANS[sku];
                return row
                  ? {
                      data: {
                        sellable: row.sellable,
                        requires_publishable_platform: row.gated,
                      },
                      error: null,
                    }
                  : { data: null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "project_briefs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { site_platform_id: platformId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "site_platforms") {
        return { select: () => ({ order: async () => ({ data: PLATFORMS, error: null }) }) };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { stripe_customer_id: "cus_test" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "purchases") {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`table inattendue : ${table}`);
    },
    readOrder,
  } as never as import("@supabase/supabase-js").SupabaseClient<
    import("@/types/supabase").Database
  > & { readOrder: string[] };
}

const buy = (sku: string, platformId: string | null, projectId: string | null =
  "22222222-2222-2222-2222-222222222222") =>
  createCheckoutSession(fakeSupabase(platformId), {
    userId: "11111111-1111-1111-1111-111111111111",
    email: "her@example.test",
    tier: sku as never,
    projectId,
    withMonthlyPresence: false,
  });

beforeEach(() => {
  sessionsCreate.mockClear();
  customersCreate.mockClear();
});

describe("⚠ sur une plateforme qu'on ne publie pas, l'ancienne offre reste ACHETABLE", () => {
  /*
   * LA CORRECTION, EN QUATRE LIGNES. Ces paliers ne promettent aucune
   * publication : ils livrent des fichiers et un texte à coller. Les fermer
   * était refuser une vente qu'on sait honorer.
   */
  it.each(["starter", "practice", "signature", "identity_addon"])(
    "%s s'achète depuis Wix",
    async (sku) => {
      await expect(buy(sku, "wix")).rejects.not.toBeInstanceOf(
        PlatformNotEligibleError
      );
      expect(
        sessionsCreate,
        `${sku} a été fermé à quelqu'un sur Wix — il ne promet pourtant aucune publication`
      ).toHaveBeenCalled();
    }
  );

  it("et la garde n'a même pas eu à lire sa plateforme", () => {
    /*
     * Un SKU non conditionné sort avant la lecture du brief. Ce n'est pas une
     * optimisation : c'est la preuve que sa plateforme N'ENTRE PAS dans la
     * décision pour l'ancienne offre.
     */
    const supabase = fakeSupabase("wix");
    return createCheckoutSession(supabase, {
      userId: "11111111-1111-1111-1111-111111111111",
      email: "her@example.test",
      tier: "practice" as never,
      projectId: "22222222-2222-2222-2222-222222222222",
      withMonthlyPresence: false,
    }).catch(() => {
      expect(supabase.readOrder).not.toContain("project_briefs");
      expect(supabase.readOrder).not.toContain("site_platforms");
    });
  });
});

describe("ce qui promet de publier suit la plateforme", () => {
  it.each(["foundation", "roster"])("%s passe sur WordPress", async (sku) => {
    await expect(buy(sku, "wordpress")).rejects.not.toBeInstanceOf(
      PlatformNotEligibleError
    );
    expect(sessionsCreate).toHaveBeenCalled();
  });

  it.each(["foundation", "roster"])("%s est fermé sur Wix", async (sku) => {
    await expect(buy(sku, "wix")).rejects.toBeInstanceOf(PlatformNotEligibleError);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("⚠ la fermeture porte la phrase de la base, pas une phrase écrite ici", async () => {
    await expect(buy("foundation", "wix")).rejects.toMatchObject({
      sku: "foundation",
      notice: "We do not publish to Wix yet.",
    });
  });

  it("⚠ « conditional » PASSE — sinon le troisième état ne dirait plus rien", async () => {
    /*
     * On prend l'inscription, et ce qui n'est pas garanti a déjà été dit à
     * l'étape 1. En faire un refus au paiement rendrait `conditional`
     * identique à `refused`.
     */
    await expect(buy("foundation", "maybe")).rejects.not.toBeInstanceOf(
      PlatformNotEligibleError
    );
    expect(sessionsCreate).toHaveBeenCalled();
  });

  it("sans réponse de plateforme, on ne devine pas", async () => {
    await expect(buy("foundation", null)).rejects.toBeInstanceOf(
      PlatformNotEligibleError
    );
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("sans projet du tout non plus", async () => {
    /* Un checkout parti de `/pricing` n'a pas de brief, donc pas de réponse. */
    await expect(buy("foundation", "wordpress", null)).rejects.toBeInstanceOf(
      PlatformNotEligibleError
    );
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("une plateforme retirée du catalogue ferme, elle n'ouvre pas", async () => {
    await expect(buy("foundation", "a_platform_that_left")).rejects.toBeInstanceOf(
      PlatformNotEligibleError
    );
  });
});

describe("les deux raisons restent distinctes", () => {
  it("⚠ `sellable` passe AVANT la plateforme", async () => {
    /*
     * `fill_solo` porte les deux : invendable à tout le monde, ET conditionné.
     * Il doit rendre `UnsellableSkuError` — dire « votre plateforme » de
     * quelque chose qu'on ne vend à personne serait un mensonge poli, et elle
     * changerait de plateforme pour rien.
     */
    await expect(buy("fill_solo", "wordpress")).rejects.toBeInstanceOf(
      UnsellableSkuError
    );
  });

  it("un SKU inconnu reste un SKU inconnu", async () => {
    await expect(buy("a_sku_nobody_wrote", "wordpress")).rejects.toBeInstanceOf(
      UnsellableSkuError
    );
  });
});
