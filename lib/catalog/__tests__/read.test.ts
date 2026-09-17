import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  ["site_platforms", "sitePlatforms"],
  ["positioning_rules", "positioningRules"],
  ["positioning_patterns", "positioningPatterns"],
] as const;

/*
 * ⚠ DEUX TABLES LUES QUI NE SONT PAS DANS `REQUIRED`, ET LA RAISON EST ÉCRITE
 * ICI PARCE QU'ELLE N'EST PAS ÉVIDENTE.
 *
 * `REQUIRED` fait échouer TOUTE lecture du catalogue — donc le brief, donc les
 * sept écrans. C'est juste pour une table dont le vide ne peut être qu'un refus
 * RLS déguisé en `[]`.
 *
 * Les règles de positionnement ont un second état vide LÉGITIME : celui où
 * personne ne les a encore écrites, ou celui, transitoire, où on remplace les
 * exemples par les vraies. Faire tomber le brief pour ça serait un dégât
 * collatéral que personne n'a demandé.
 *
 * La garde existe donc, mais là où le vide COÛTE quelque chose : la route du
 * palier gratuit refuse par `positioning_rules_missing` plutôt que de répondre
 * « rien » et de laisser croire qu'elle a regardé. L'assertion en bas de ce
 * fichier tient la chaîne : retirer ce refus de la route fait échouer ici.
 */
const GARDEES_AILLEURS = ["positioningRules", "positioningPatterns"] as const;

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
  /*
   * ⚠ LA GARDE QUI MANQUAIT, ET QUI VIENT DE COÛTER.
   *
   * `REQUIRED` dans read.ts est une liste écrite à la main à côté du type
   * `Catalog`. Le 17 septembre, la fusion du lot plateforme a ajouté
   * `sitePlatforms` au catalogue, à `fetchCatalog` et à la map de retour — git
   * a signalé les quatre conflits et ils ont tous été résolus en gardant les
   * deux côtés. Mais `REQUIRED` n'existait que d'un seul côté, donc AUCUN
   * conflit n'a été signalé là, et la table serait entrée dans le catalogue
   * sans jamais entrer dans la garde. Vide, elle serait revenue `[]` en silence
   * — le costume exact du refus RLS que ce fichier existe pour attraper.
   *
   * Ce test ne relit pas `REQUIRED` : il DÉRIVE la question de la source. Pour
   * chaque table que `fetchCatalog` lit, il la rend vide et exige que la
   * lecture lève EN LA NOMMANT. Une table de plus demain est couverte sans que
   * personne ait à s'en souvenir.
   */
  it.each(
    TABLES.filter(([, key]) => !GARDEES_AILLEURS.includes(key as never)).map(
      ([table, key]) => [table, key] as const
    )
  )(
    "refuse un catalogue où %s est vide — la garde couvre TOUTES les tables lues",
    async (empty, key) => {
      const { supabase } = clientReturning((t) => (t === empty ? [] : ROWS[t]));
      /*
       * ⚠ ON ATTEND LA CLÉ, PAS LE NOM DE TABLE. `missingTables` rend les clés
       * de `Catalog` — camelCase — et non les noms PostgREST. Écrit avec le nom
       * de table, ce test passait sur les deux seuls cas où les deux
       * coïncident (`specialties`, `degrees`) et échouait sur les seize autres.
       */
      await expect(readCatalog(supabase)).rejects.toThrow(key);
    }
  );

  /*
   * ⚠ ET LA LISTE DES TABLES EST ELLE-MÊME DÉRIVÉE. Sans ceci, `TABLES`
   * ci-dessus redevient la copie à côté de la source : une clé ajoutée au
   * catalogue et oubliée ici sortirait du `it.each` sans que rien ne bouge, et
   * la garde d'au-dessus cesserait de la couvrir en silence — le même défaut,
   * d'un cran plus haut.
   */
  it("lit toutes les clés que le catalogue déclare, et pas d'autres", () => {
    const lues = new Set(TABLES.map(([, key]) => key));
    const declarees = new Set(Object.keys(FIXTURE_CATALOG));
    declarees.delete("ethicsRules" as never);
    lues.delete("ethicsRules" as never);
    expect([...declarees].filter((k) => !lues.has(k as never))).toEqual([]);
    expect([...lues].filter((k) => !declarees.has(k))).toEqual([]);
  });

  /*
   * ⚠ ET LES DEUX EXEMPTÉES SONT GARDÉES AILLEURS, POUR DE VRAI. Sans cette
   * assertion, `GARDEES_AILLEURS` serait une liste d'exemptions — c'est-à-dire
   * une liste qu'on allonge au lieu de corriger. Elle nomme l'endroit, et cet
   * endroit doit exister.
   */
  it("⚠ les tables exemptées de REQUIRED sont refusées par la route du palier gratuit", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/first-line/route.ts"),
      "utf8"
    );
    expect(route).toContain("positioning_rules_missing");
    expect(route).toMatch(/positioningRules \?\? \[\]\)\.length === 0/);
  });

  it("⚠ et un catalogue sans règles de positionnement se LIT quand même — le brief ne tombe pas", async () => {
    const { supabase } = clientReturning((t) =>
      t === "positioning_rules" || t === "positioning_patterns" ? [] : ROWS[t]
    );
    const catalog = await readCatalog(supabase);
    expect(catalog.positioningRules).toEqual([]);
  });

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
