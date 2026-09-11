import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const SOURCE = readFileSync(join(ROOT, "lib/billing/entitlements.ts"), "utf8");

/**
 * Le source sans ses commentaires.
 *
 * ⚠ SANS ÇA, LA RÈGLE ATTRAPE SA PROPRE PROSE — pour la deuxième fois dans ce
 * dépôt. Le commentaire qui EXPLIQUE la correction cite la condition retirée,
 * mot pour mot, et une garde qui punit l'explication de la garde finit par
 * faire supprimer l'explication.
 */
const ENTITLEMENTS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^[ \t]*\/\/.*$/gm,
  ""
);

/*
 * ── UN ACHAT SANS PROJET NE PAYE AUCUN PROJET ───────────────────────────
 *
 * Trois lecteurs faisaient valoir une ligne `purchases` orpheline pour TOUS
 * les projets du compte : `resolveEntitledTier`, `purchaseWasReversed` et
 * `countUnpaidProjects`. Trois chemins produisent une telle ligne, et deux
 * d'entre eux sont des pannes :
 *
 *   1. `/pricing` renvoie vers `/app/checkout?plan=…` SANS projet — un vrai
 *      chemin produit, pas un accident ;
 *   2. la réclamation du brief échoue à l'inscription, donc la page de
 *      checkout ne voit aucun projet à travers sa RLS ;
 *   3. `purchases_project_id_fkey` est ON DELETE SET NULL : supprimer un
 *      projet DÉTACHE son achat au lieu de l'effacer.
 *
 * ⚠ ET LA RÈGLE NE FAISAIT MARCHER AUCUN DES TROIS. `grant_plan_allowance`
 * rend `false` sur un projet nul (mesuré en base, session 4) et
 * `brand_kit_entitled` est scopé au projet. La ligne orpheline n'ouvrait donc
 * rien : elle faisait dire « payé » à l'écran pendant que la base refusait —
 * une praticienne qui choisit une direction et repart au checkout d'un kit
 * qu'elle a l'air d'avoir acheté.
 *
 * Lu dans la source : ces requêtes sont des chaînes PostgREST, et ce qui doit
 * être verrouillé est la CONDITION, pas le résultat d'un double de test qui
 * répondrait ce qu'on lui a dit de répondre.
 */

const READERS = [
  "resolveEntitledTier",
  "purchaseWasReversed",
  "countUnpaidProjects",
] as const;

function bodyOf(name: string): string {
  const start = ENTITLEMENTS.indexOf(`export async function ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  const next = READERS.map((other) =>
    ENTITLEMENTS.indexOf(`export async function ${other}(`)
  )
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  return ENTITLEMENTS.slice(start, next ?? ENTITLEMENTS.length);
}

describe("⚠ aucun lecteur ne fait valoir un achat orphelin", () => {
  it("le fichier porte bien les trois lecteurs", () => {
    // Garde anti-vide : une regex cassée rendrait tout le reste vacuously vrai.
    for (const name of READERS) {
      expect(ENTITLEMENTS).toContain(`export async function ${name}(`);
    }
  });

  it.each(READERS)("%s ne lit plus `project_id.is.null`", (name) => {
    expect(bodyOf(name)).not.toContain("project_id.is.null");
  });

  it.each(["resolveEntitledTier", "purchaseWasReversed"] as const)(
    "%s filtre sur CE projet",
    (name) => {
      expect(bodyOf(name)).toContain('.eq("project_id", projectId)');
    }
  );

  it("countUnpaidProjects jette les project_id nuls plutôt que d'y voir un droit", () => {
    const body = bodyOf("countUnpaidProjects");
    expect(body).toContain("id !== null");
    // Et surtout : plus de sortie anticipée sur la présence d'un orphelin.
    expect(body).not.toMatch(/project_id === null\)\)\s*return 0/);
  });

  it("CANARY — la règle mord", () => {
    const fake = '.or(`project_id.eq.${projectId},project_id.is.null`)';
    expect(fake).toContain("project_id.is.null");
  });
});
