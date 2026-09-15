import { beforeEach, describe, expect, it } from "vitest";
import { invalidateCatalog, readCatalog } from "@/lib/catalog/read";
import { FIXTURE_CATALOG } from "@/lib/brief/fixtures/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LE DÉFAUT QUI A VIDÉ « LICENSE TYPE » ───────────────────────────────
 *
 * Les quinze policies du catalogue portaient `to authenticated`. Le brief
 * ANONYME — le tout premier écran qu'une nouvelle praticienne touche — appelle
 * en `anon`. PostgREST ne refuse pas un SELECT que RLS écarte : il répond 200
 * avec `[]`. Zéro ligne, zéro erreur, un intitulé sans rien dessous.
 *
 * La base est réparée (`20260915053102` côté eklio-backend). Ce fichier teste
 * l'AUTRE moitié : que le front ne rende plus jamais ça en silence, et surtout
 * qu'il ne le METTE PAS EN CACHE — le cache est un cache de module, partagé par
 * tous les appelants de l'instance, et une seule lecture creuse servirait des
 * étapes vides à tout le monde pendant dix minutes.
 */

/** Les quinze tables lues par `fetchCatalog`, dans l'ordre où elle les lit. */
const TABLES = [
  ["license_types", "licenseTypes"],
  ["specialties", "specialties"],
  ["problem_cards", "problemCards"],
  ["gain_cards", "gainCards"],
  ["client_persona_cards", "personaCards"],
  ["tone_cards", "toneCards"],
  ["palette_families", "paletteFamilies"],
  ["type_pairings", "typePairings"],
  ["primary_actions", "primaryActions"],
  ["site_goals", "siteGoals"],
  ["ethics_rules", "ethicsRules"],
  ["session_style_cards", "sessionStyleCards"],
  ["not_a_fit_cards", "notAFitCards"],
  ["modality_cards", "modalityCards"],
  ["modality_prominence_options", "modalityProminenceOptions"],
  ["license_type_states", "licenseTypeStates"],
  ["degrees", "degrees"],
] as const;

/*
 * `ethics_rules` n'est pas dans le fixture (il ne sert aucun des sept écrans
 * mesurés) mais il est bien lu, donc le double a besoin d'une ligne pour lui.
 */
const ROWS: Record<string, unknown[]> = Object.fromEntries(
  TABLES.map(([table, key]) => [
    table,
    key === "ethicsRules"
      ? [{ id: "no_testimonials" }]
      : (FIXTURE_CATALOG[key] as unknown[]),
  ])
);

/**
 * Un client Supabase juste assez réel : `.from(t).select().eq().order()` est
 * thenable et rend `{ data, error }`, comme PostgREST.
 *
 * ⚠ `empty` ne rend PAS d'erreur. C'est tout l'intérêt : le défaut ne s'est
 * jamais annoncé comme une erreur, et un double qui en lèverait une testerait
 * un bug que personne n'a eu.
 */
function clientReturning(
  rowsFor: (table: string) => unknown[]
): { supabase: SupabaseClient<Database>; reads: () => number } {
  let reads = 0;
  const supabase = {
    from(table: string) {
      const result = { data: rowsFor(table), error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        then: (resolve: (value: unknown) => unknown) => {
          reads += 1;
          return Promise.resolve(result).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, reads: () => reads };
}

beforeEach(() => {
  invalidateCatalog();
});

describe("readCatalog", () => {
  it("rend le catalogue quand la lecture aboutit", async () => {
    const { supabase } = clientReturning((table) => ROWS[table] ?? []);
    const catalog = await readCatalog(supabase);

    expect(catalog.licenseTypes).toHaveLength(FIXTURE_CATALOG.licenseTypes.length);
    expect(catalog.specialties).toHaveLength(FIXTURE_CATALOG.specialties.length);
  });

  /*
   * ⚠ LE NOMBRE DE TABLES N'EST PAS FIGÉ ICI, et ça n'est pas de la mollesse.
   *
   * `fetchCatalog` en lit quinze aujourd'hui et une branche voisine en ajoute
   * une seizième (`site_platforms`). Ce qui est testé n'est pas « combien »
   * mais « la seconde lecture n'en déclenche AUCUNE » — la propriété du cache.
   * Un compte écrit en dur ferait échouer ce fichier à chaque table ajoutée,
   * sur un défaut qui n'existe pas.
   */
  it("met en cache une lecture saine plutôt que de tout relire", async () => {
    const { supabase, reads } = clientReturning((table) => ROWS[table] ?? []);
    await readCatalog(supabase);
    const afterFirst = reads();
    await readCatalog(supabase);

    // Anti-vacuité : une première lecture qui n'a rien lu rendrait la suite
    // vraie sans rien prouver.
    expect(afterFirst).toBeGreaterThanOrEqual(TABLES.length);
    expect(reads()).toBe(afterFirst);
  });

  /*
   * ⚠ LE TEST DE RÉGRESSION. Avant, ça rendait un catalogue vide, sans un mot,
   * et l'écran 1 affichait « License type » avec zéro puce dessous.
   */
  it("lève quand une table revient vide — 200 avec [] est le costume du refus RLS", async () => {
    const { supabase } = clientReturning((table) =>
      table === "license_types" ? [] : (ROWS[table] ?? [])
    );

    await expect(readCatalog(supabase)).rejects.toThrow(/licenseTypes/);
  });

  it("nomme TOUTES les tables vides, pas seulement la première", async () => {
    const { supabase } = clientReturning(() => []);

    /*
     * `[\s\S]*` plutôt que `.*` avec le drapeau `s` : la cible de compilation
     * de ce dépôt est antérieure à es2018, où `dotAll` n'existe pas.
     */
    await expect(readCatalog(supabase)).rejects.toThrow(
      /licenseTypes[\s\S]*specialties/
    );
  });

  /*
   * ⚠ CELUI-CI EST LE PLUS IMPORTANT DES QUATRE.
   *
   * Le cache est partagé par TOUS les appelants de l'instance. Si une lecture
   * creuse y entrait, la visiteuse anonyme dont la lecture a échoué ne serait
   * pas la seule servie à vide : les utilisatrices connectées de la même
   * instance le seraient aussi, pendant dix minutes, alors que LEUR lecture
   * aurait parfaitement marché.
   */
  it("n'empoisonne pas le cache : la lecture suivante repart de zéro", async () => {
    const broken = clientReturning(() => []);
    await expect(readCatalog(broken.supabase)).rejects.toThrow();

    const healthy = clientReturning((table) => ROWS[table] ?? []);
    const catalog = await readCatalog(healthy.supabase);

    expect(catalog.licenseTypes.length).toBeGreaterThan(0);
    // Elle a bien RELU : rien de creux n'était resté en cache.
    expect(healthy.reads()).toBeGreaterThanOrEqual(TABLES.length);
  });
});
