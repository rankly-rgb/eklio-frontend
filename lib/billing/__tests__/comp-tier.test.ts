import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { KIT_TIERS } from "@/lib/kit/tiers";

/*
 * ── UN COMPTE COMP VOIT LE PRODUIT PAYANT ───────────────────────────────
 *
 * `brand_kit_entitled`, en base, OU-e déjà `comp_access_active()` : un compte
 * comp franchissait le mur du paiement. Mais `resolveEntitledTier` ne lisait
 * que `purchases` — il entrait donc dans l'atelier et trouvait chaque section
 * fermée par `surfaceAccess(_, null)`. Mesuré sur le projet vivant le
 * 14 septembre : octroi comp actif, zéro achat, palier `null`.
 *
 * ⚠ ET SURTOUT PAS UNE LIGNE FABRIQUÉE DANS `purchases`. C'est la table de
 * l'argent, et `comp_grants` existe pour qu'un accès interne n'y figure
 * jamais : « This is NEVER revenue — exclude comp_grants from every financial
 * query » (commentaire de la table).
 */

const TOP = KIT_TIERS[KIT_TIERS.length - 1];

function client(options: {
  comp: boolean;
  purchases?: { tier: string }[];
  purchasesFail?: boolean;
}): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        in: () => ({
          eq: () => ({
            eq: async () =>
              options.purchasesFail
                ? { data: null, error: { message: "lecture perdue" } }
                : { data: options.purchases ?? [], error: null },
          }),
        }),
      }),
    }),
    rpc: async () => ({ data: options.comp, error: null }),
  } as unknown as SupabaseClient<Database>;
}

const PROJECT = "22222222-2222-2222-2222-222222222222";

describe("⚠ l'octroi comp répond au point d'étranglement du palier", () => {
  it("sans achat, un compte comp obtient le palier le plus haut", async () => {
    expect(await resolveEntitledTier(client({ comp: true }), PROJECT)).toBe(TOP);
  });

  it("sans achat ni comp, le palier reste null", async () => {
    // Le repli fermé n'a pas bougé : `surfaceAccess(_, null)` refuse.
    expect(await resolveEntitledTier(client({ comp: false }), PROJECT)).toBeNull();
  });

  it("⚠ il ne BAISSE jamais ce qu'un achat a donné", async () => {
    const tier = await resolveEntitledTier(
      client({ comp: true, purchases: [{ tier: "starter" }] }),
      PROJECT
    );
    expect(tier).toBe(TOP);
  });

  it("un achat au sommet n'interroge même pas le comp", async () => {
    /*
     * Pas une optimisation : la preuve que le comp ne peut pas CHANGER une
     * réponse déjà maximale. Le faux lève si la RPC est appelée.
     */
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => ({ eq: () => ({ eq: async () => ({ data: [{ tier: TOP }], error: null }) }) }),
        }),
      }),
      rpc: async () => {
        throw new Error("comp interrogé alors que l'achat était déjà au sommet");
      },
    } as unknown as SupabaseClient<Database>;
    expect(await resolveEntitledTier(supabase, PROJECT)).toBe(TOP);
  });

  it("⚠ une lecture de purchases en échec reste fermée, comp ou pas", async () => {
    /*
     * Le comp est un fait distinct, mais répondre « palier maximum » alors
     * qu'on n'a pas pu lire ce qu'elle a acheté remplacerait une incertitude
     * par une affirmation. Le repli fermé vaut pour tout le monde.
     */
    expect(
      await resolveEntitledTier(client({ comp: true, purchasesFail: true }), PROJECT)
    ).toBeNull();
  });

  it("le palier comp est DÉRIVÉ de l'échelle, pas écrit", async () => {
    /*
     * `comp_grants` ne porte aucun palier : il promet « le produit payant
     * complet ». Écrire « foundation » en dur laisserait un compte comp
     * derrière au premier palier ajouté au-dessus.
     */
    expect(TOP).toBe(KIT_TIERS[KIT_TIERS.length - 1]);
    expect(await resolveEntitledTier(client({ comp: true }), PROJECT)).toBe(
      KIT_TIERS[KIT_TIERS.length - 1]
    );
  });
});
