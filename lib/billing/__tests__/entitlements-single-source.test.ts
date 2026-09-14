import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ENTITLING_STATUSES,
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

type Recorded = { column: string; values: readonly string[] };

/**
 * Un faux client qui ENREGISTRE le filtre de statut au lieu de l'ignorer.
 *
 * `.eq` est volontairement présent et volontairement fatal : si une lecture
 * revenait à `.eq("status", "paid")`, elle ne tomberait pas sur un `undefined
 * is not a function` obscur — elle dirait laquelle, et pourquoi.
 */
function recordingClient(rows: {
  purchases?: unknown[];
  projects?: unknown[];
}): { supabase: SupabaseClient<Database>; recorded: Recorded[] } {
  const recorded: Recorded[] = [];

  const purchasesQuery = {
    in(column: string, values: readonly string[]) {
      recorded.push({ column, values });
      // `resolveEntitledTier` enchaîne `.eq("project_id", …)` après `.in` ;
      // `countUnpaidProjects` s'arrête là. Le même objet sert les deux, donc
      // il est à la fois « thenable » et enchaînable.
      const result = { data: rows.purchases ?? [], error: null };
      return Object.assign(Promise.resolve(result), {
        eq: async () => result,
      });
    },
    eq(column: string, value: string) {
      throw new Error(
        `une lecture de \`purchases\` filtre encore \`${column} = '${value}'\` en dur ` +
          `au lieu de lire ENTITLING_STATUSES`
      );
    },
  };

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
  } as unknown as SupabaseClient<Database>;

  return { supabase, recorded };
}

describe("la constante dit ce que la base dit", () => {
  it("ENTITLING_STATUSES est exactement brand_kit_entitling_statuses()", () => {
    expect([...ENTITLING_STATUSES]).toEqual(WHAT_THE_DATABASE_SAYS);
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
