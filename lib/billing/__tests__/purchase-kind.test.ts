import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ENTITLING_STATUSES,
  hasPurchasedAddon,
  resolveEntitledTier,
} from "@/lib/billing/entitlements";
import { OFFER_SKUS } from "@/lib/billing/offer";
import { KIT_TIERS } from "@/lib/kit/tiers";

/*
 * ── UN ACHAT QUI NE MONTE AUCUN PALIER ──────────────────────────────────
 *
 * `purchases.kind` vaut `tier`, `addon` ou `seat`. Seul le premier monte
 * l'échelle — celle que `highestTier` lit, et que `surface-access.ts` relit
 * pour décider ce qui est ouvert.
 *
 * ⚠ LE SENS DE L'ERREUR COMPTE. Sans ce filtre, un accessoire à 89 $ entrerait
 * dans le calcul du palier, et il OUVRIRAIT des surfaces vendues 249 $. Un
 * défaut qui ferme se voit et remonte en support ; un défaut qui ouvre ne
 * remonte jamais.
 *
 * ⚠ ET `parseKitTier` NE SUFFIT PAS COMME GARDE. Aujourd'hui, `identity_addon`
 * n'est pas un `KitTier`, donc il serait écarté même sans filtre — un accident
 * heureux, pas une règle. Le jour où un SKU est nommé comme un palier, la
 * protection disparaît sans qu'un seul test bouge. C'est pourquoi le filtre est
 * explicite, et pourquoi ce fichier vérifie qu'il part vraiment vers la base.
 */

type Filter = { column: string; value: unknown };

function recordingClient(rows: unknown[]): {
  supabase: SupabaseClient<Database>;
  filters: Filter[];
} {
  const filters: Filter[] = [];
  const result = () => ({ data: rows, error: null });

  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    in(column: string, value: unknown) {
      filters.push({ column, value });
      return Object.assign(Promise.resolve(result()), chain);
    },
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return Object.assign(Promise.resolve(result()), chain);
    },
    limit() {
      return Object.assign(Promise.resolve(result()), chain);
    },
  });

  const supabase = {
    from: () => ({ select: () => chain }),
    /*
     * ⚠ AJOUTÉ QUAND `resolveEntitledTier` A APPRIS À LIRE L'OCTROI COMP.
     * Sans octroi actif (le cas de tous ces tests), la réponse est celle des
     * achats seuls — donc ce faux ne change RIEN à ce que chaque test vérifie.
     * Le rendre `false` plutôt que de l'omettre est délibéré : un client qui
     * n'a pas `.rpc` lève, et un test qui lève sur un appel légitime ne dit
     * plus rien de l'assertion qu'il porte.
     */
    rpc: async () => ({ data: false, error: null }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, filters };
}

function valueOf(filters: Filter[], column: string) {
  return filters.find((entry) => entry.column === column)?.value;
}

describe("resolveEntitledTier ne regarde que les achats de palier", () => {
  it("le filtre part réellement vers la base", async () => {
    const { supabase, filters } = recordingClient([
      { tier: "foundation", project_id: "p1" },
    ]);

    await resolveEntitledTier(supabase, "p1");

    expect(valueOf(filters, "kind")).toBe("tier");
    expect(valueOf(filters, "project_id")).toBe("p1");
    expect(valueOf(filters, "status")).toEqual([...ENTITLING_STATUSES]);
  });

  it("un projet dont le seul achat est un accessoire n'a aucun palier", async () => {
    /*
     * La base ne rendra jamais cette ligne, puisque le filtre `kind` l'écarte.
     * Le faux client la rend quand même : c'est la seule façon de montrer que
     * le résultat ne dépend PAS de ce que `parseKitTier` fait d'un nom
     * inconnu. Si quelqu'un retire le filtre, `identity_addon` arrive ici et
     * le test reste vert jusqu'au jour où le SKU ressemble à un palier — d'où
     * la ligne du dessus, qui vérifie le filtre lui-même.
     */
    const { supabase } = recordingClient([
      { tier: "identity_addon", project_id: "p1" },
    ]);

    expect(await resolveEntitledTier(supabase, "p1")).toBeNull();
  });

  it("un palier reste rendu, et c'est le plus généreux", async () => {
    const { supabase } = recordingClient([
      { tier: "starter", project_id: "p1" },
      { tier: "foundation", project_id: "p1" },
    ]);

    // The Foundation est en fin de `KIT_TIERS`, donc au-dessus de starter.
    expect(await resolveEntitledTier(supabase, "p1")).toBe("foundation");
  });
});

describe("hasPurchasedAddon pose l'autre question", () => {
  it("elle ne se déduit pas d'un palier", async () => {
    const { supabase, filters } = recordingClient([{ id: "purchase-1" }]);

    expect(await hasPurchasedAddon(supabase, "p1", "identity_addon")).toBe(true);

    expect(valueOf(filters, "kind")).toBe("addon");
    expect(valueOf(filters, "tier")).toBe("identity_addon");
    expect(valueOf(filters, "project_id")).toBe("p1");
    // La même liste de statuts que partout ailleurs.
    expect(valueOf(filters, "status")).toEqual([...ENTITLING_STATUSES]);
  });

  it("aucune ligne, aucun accessoire", async () => {
    const { supabase } = recordingClient([]);
    expect(await hasPurchasedAddon(supabase, "p1", "identity_addon")).toBe(false);
  });

  it("une erreur de lecture ferme", async () => {
    // Un droit qu'on n'a pas pu vérifier n'est pas un droit accordé.
    const supabase = {
      from: () => ({
        select: () => {
          const chain: Record<string, unknown> = {};
          const failed = { data: null, error: { message: "boom" } };
          Object.assign(chain, {
            in: () => Object.assign(Promise.resolve(failed), chain),
            eq: () => Object.assign(Promise.resolve(failed), chain),
            limit: () => Object.assign(Promise.resolve(failed), chain),
          });
          return chain;
        },
      }),
    /*
     * ⚠ AJOUTÉ QUAND `resolveEntitledTier` A APPRIS À LIRE L'OCTROI COMP.
     * Sans octroi actif (le cas de tous ces tests), la réponse est celle des
     * achats seuls — donc ce faux ne change RIEN à ce que chaque test vérifie.
     * Le rendre `false` plutôt que de l'omettre est délibéré : un client qui
     * n'a pas `.rpc` lève, et un test qui lève sur un appel légitime ne dit
     * plus rien de l'assertion qu'il porte.
     */
    rpc: async () => ({ data: false, error: null }),
    } as unknown as SupabaseClient<Database>;

    expect(await hasPurchasedAddon(supabase, "p1", "identity_addon")).toBe(false);
  });
});

describe("les trois formes d'achat, et ce qu'elles montent", () => {
  it("le catalogue en nomme exactement un de chaque hors abonnement", () => {
    const once = OFFER_SKUS.filter((entry) => entry.billingPeriod === "once");
    expect(once.filter((e) => e.kind === "kit").map((e) => e.sku)).toEqual([
      "foundation",
      "roster",
    ]);
    expect(once.filter((e) => e.kind === "addon").map((e) => e.sku)).toEqual([
      "identity_addon",
    ]);
    expect(once.filter((e) => e.kind === "seat").map((e) => e.sku)).toEqual([
      "roster_seat",
    ]);
  });

  it("ce qui n'est pas un kit n'apparaît jamais dans l'échelle des paliers", () => {
    /*
     * ⚠ L'ÉCHELLE EST AUSSI CELLE DES SURFACES. `KIT_TIERS.indexOf` est lu par
     * `tierRank` (quel achat prime) ET par `rank` dans `surface-access.ts`
     * (quelle surface est incluse). Un accessoire qui y entrerait déciderait
     * l'accès.
     */
    for (const entry of OFFER_SKUS) {
      if (entry.kind === "kit") continue;
      expect(KIT_TIERS as readonly string[]).not.toContain(entry.sku);
    }
  });
});
