import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ENTITLING_STATUSES,
  PAST_DUE_GRACE_DAYS,
  countUnpaidProjects,
  resolveEntitledTier,
} from "@/lib/billing/entitlements";

/*
 * ── UNE SEULE SOURCE POUR LE DROIT, ET LE CHEMIN EST PARCOURU ───────────
 *
 * `brand_kit_entitled` en base répond à « ce kit est-il ouvert » et lit
 * `brand_kit_entitling_statuses()`, qui rend `{paid, partially_refunded}`.
 * Deux lectures TypeScript posent une question voisine — « quel palier
 * a-t-elle payé », « combien de projets n'a-t-elle pas payés » — et elles
 * filtraient `status = 'paid'` en dur.
 *
 * La conséquence n'était pas théorique : une acheteuse partiellement
 * remboursée avait son kit ouvert côté base et se voyait refuser en 402
 * toutes les surfaces au-dessus de `starter`, sur un écran qui lui proposait
 * d'acheter ce qu'elle avait déjà.
 *
 * ⚠ CE QUE CE FICHIER FAIT QUE `unpaid-projects.test.ts` NE FAIT PAS. Celui-là
 * épingle la VALEUR de la constante. Celui-ci vérifie que les lectures s'en
 * SERVENT : le faux client enregistre l'argument réellement passé à
 * `.in("status", …)`, et l'assertion porte sur ce qui est parti vers la base.
 * Une constante juste que personne ne lit est exactement le défaut qui était
 * là, et un test qui ne lirait que la constante l'aurait laissé passer.
 *
 * ⚠ L'AUTRE MOITIÉ DE L'ACCORD SE VÉRIFIE EN BASE, et elle y est vérifiée :
 * `supabase/tests/20260914090000_entitling_statuses_single_source.test.sql`
 * (backend) épingle la valeur rendue par `brand_kit_entitling_statuses()`.
 * Les deux fichiers nomment la même liste littérale ; si la base change
 * d'avis, l'un des deux tombe.
 */

/** La liste que la base rend. Écrite à la main ici : c'est le point d'épingle. */
const WHAT_THE_DATABASE_SAYS = ["paid", "partially_refunded"];

/** Ce que `monthly_presence_past_due_grace()` rend, en jours. Même rôle. */
const WHAT_THE_DATABASE_GRANTS_IN_DAYS = 3;

type Recorded = { column: string; values: readonly string[] };

/**
 * Un faux client qui ENREGISTRE le filtre de statut au lieu de l'ignorer.
 *
 * ⚠ `.eq("status", …)` EST FATAL, LES AUTRES `.eq` NE LE SONT PAS. La garde
 * porte sur UNE colonne : si une lecture revenait à `.eq("status", "paid")`,
 * elle ne tombe pas sur un `undefined is not a function` obscur — elle dit
 * laquelle et pourquoi. Les autres colonnes s'enchaînent normalement, parce
 * que `resolveEntitledTier` en filtre deux de plus (`kind`, `project_id`) et
 * qu'interdire tout `.eq` ferait de ce faux client un obstacle plutôt qu'un
 * témoin.
 */
function recordingClient(rows: {
  purchases?: unknown[];
  projects?: unknown[];
}): { supabase: SupabaseClient<Database>; recorded: Recorded[] } {
  const recorded: Recorded[] = [];

  const result = () => ({ data: rows.purchases ?? [], error: null });

  // Chaînable ET « thenable » : `countUnpaidProjects` s'arrête après `.in`,
  // `resolveEntitledTier` enchaîne encore deux `.eq`, et `hasPurchasedAddon`
  // finit par `.limit`.
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    in(column: string, values: readonly string[]) {
      recorded.push({ column, values });
      return Object.assign(Promise.resolve(result()), chain);
    },
    eq(column: string, value: string) {
      if (column === "status") {
        throw new Error(
          `une lecture de \`purchases\` filtre encore \`status = '${value}'\` en dur ` +
            `au lieu de lire ENTITLING_STATUSES`
        );
      }
      return Object.assign(Promise.resolve(result()), chain);
    },
    limit() {
      return Object.assign(Promise.resolve(result()), chain);
    },
  });
  const purchasesQuery = chain;

  const supabase = {
    from(table: string) {
      if (table === "projects") {
        return {
          select: () => ({
            eq: async () => ({ data: rows.projects ?? [], error: null }),
          }),
        };
      }
      return { select: () => purchasesQuery };
    },
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

  return { supabase, recorded };
}

describe("la constante dit ce que la base dit", () => {
  it("ENTITLING_STATUSES est exactement brand_kit_entitling_statuses()", () => {
    expect([...ENTITLING_STATUSES]).toEqual(WHAT_THE_DATABASE_SAYS);
  });

  /*
   * ⚠ LA SECONDE CONSTANTE PARTAGÉE, DEPUIS LE 20 SEPTEMBRE. La grâce de trois
   * jours sur `past_due` décidait en TypeScript ; elle décide maintenant dans
   * `monthly_presence_past_due_grace()`, en base, appelée par le chokepoint que
   * `reserve_credit` consulte avant toute dépense.
   *
   * `PAST_DUE_GRACE_DAYS` reste exporté parce que la fonction pure en a besoin
   * pour choisir un TEXTE sans aller-retour. Deux copies d'un même nombre, donc
   * deux épingles : celle-ci, et
   * `supabase/tests/20260920140100_credit_ledger.test.sql` (backend) qui
   * épingle `interval '3 days'`. Si la règle commerciale change par migration
   * sans que cette constante suive, l'écran et le portefeuille se mettront à
   * dire deux choses différentes — et c'est cette épingle qui tombe en premier.
   */
  it("PAST_DUE_GRACE_DAYS est exactement monthly_presence_past_due_grace()", () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(WHAT_THE_DATABASE_GRANTS_IN_DAYS);
  });

  it("elle n'est jamais vide", () => {
    /*
     * ⚠ `.in("status", [])` ne rend AUCUNE ligne. Une liste vidée par
     * inadvertance ne ferait pas échouer un appel : elle retirerait son palier
     * à tout le monde, en silence, ce qui est la forme de défaut que ce dépôt
     * documente depuis le lot 6 — une valeur qui disparaît sans erreur.
     */
    expect(ENTITLING_STATUSES.length).toBeGreaterThan(0);
  });
});

describe("les lectures s'en servent réellement", () => {
  it("resolveEntitledTier envoie la liste à la base, pas 'paid'", async () => {
    const { supabase, recorded } = recordingClient({
      purchases: [{ tier: "starter", project_id: "p1" }],
    });

    await resolveEntitledTier(supabase, "p1");

    expect(recorded).toHaveLength(1);
    expect(recorded[0].column).toBe("status");
    expect([...recorded[0].values]).toEqual(WHAT_THE_DATABASE_SAYS);
  });

  it("countUnpaidProjects envoie la même liste", async () => {
    const { supabase, recorded } = recordingClient({
      purchases: [{ project_id: "p1" }],
      projects: [{ id: "p1" }, { id: "p2" }],
    });

    await countUnpaidProjects(supabase, "user-1");

    expect(recorded).toHaveLength(1);
    expect(recorded[0].column).toBe("status");
    expect([...recorded[0].values]).toEqual(WHAT_THE_DATABASE_SAYS);
  });
});

describe("ce que ça change pour une acheteuse partiellement remboursée", () => {
  it("son palier est rendu, il n'est plus perdu", async () => {
    /*
     * Le défaut, en une ligne : la base ouvrait son kit, `resolveEntitledTier`
     * rendait `null`, et toutes les surfaces au-dessus de `starter` lui
     * répondaient 402 avec un lien d'achat.
     */
    const { supabase } = recordingClient({
      purchases: [{ tier: "practice", project_id: "p1" }],
    });

    expect(await resolveEntitledTier(supabase, "p1")).toBe("practice");
  });

  it("son projet compte comme payé", async () => {
    const { supabase } = recordingClient({
      purchases: [{ project_id: "p1" }],
      projects: [{ id: "p1" }, { id: "p2" }],
    });

    // Un seul projet non payé : `p2`. `p1` est adossé à l'achat partiellement
    // remboursé, qui a bien payé ce projet-là.
    expect(await countUnpaidProjects(supabase, "user-1")).toBe(1);
  });
});
