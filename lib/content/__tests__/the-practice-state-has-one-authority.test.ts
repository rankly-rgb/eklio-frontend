import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F76 — L'ÉTAT DU CABINET A UNE SEULE AUTORITÉ : project_briefs.state
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Deux fois de suite, une valeur a vécu à deux endroits sans que rien ne les
 * accorde : le numéro de licence (F64), puis l'État et la ville (F76) — saisis
 * dans les réglages, donc dans `site_specs.practice_details`, pendant que la
 * banque, la porte F46 et la mention lisaient `project_briefs`.
 *
 * ⚠ CE TEST NE TIENT PAS DE LISTE DE LECTEURS. Une liste écrite à la main
 * oublie le lecteur suivant — c'est exactement comme le second arbitre est
 * arrivé. Il PARCOURT le dépôt, trouve chaque lecture d'un État, et vérifie
 * qu'aucune, sur la chaîne du contenu, ne lit autre chose que le brief. Un
 * fichier ajouté demain est lu demain, sans qu'on pense à l'inscrire.
 *
 * Côté base, la même question est posée au catalogue (`pg_proc`,
 * `information_schema`) par 20261012090000_the_practice_state_has_one_authority.test.sql.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SCANNED = ["lib", "app", "components", "scripts"];
const SELF = relative(ROOT, __filename);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

/** Le code sans ses commentaires : un commentaire qui NOMME l'ancienne source n'en est pas un lecteur. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const FILES = SCANNED.flatMap((d) => walk(join(ROOT, d)))
  .map((path) => ({ rel: relative(ROOT, path).split(sep).join("/"), path }))
  .filter((f) => f.rel !== SELF)
  .map((f) => ({ ...f, source: code(readFileSync(f.path, "utf8")) }));

/*
 * La chaîne du contenu : ce qui tire, vérifie, signe, compose ou exporte un
 * post. Définie par des RÉPERTOIRES, pas par des fichiers — un module ajouté
 * dedans y est compté sans qu'on y pense.
 */
const CONTENT_CHAIN = [
  "lib/content/",
  "lib/compose/",
  "lib/check/",
  "app/api/content-items/",
  "app/app/content/",
  "scripts/production-path/",
  "scripts/local-render/",
];
const inContentChain = (rel: string) => CONTENT_CHAIN.some((prefix) => rel.startsWith(prefix));

/* Une lecture de l'État ou de la ville tels que la spec du site les porte. */
const SPEC_PLACE = /practice_?[dD]etails\??\.(state|city)\b|practice_details\s*->>?\s*'(state|city)'|\[\s*["'](state|city)["']\s*\]/;

describe("F76 — l'État du cabinet a une seule autorité", () => {
  it("le parcours a bien lu le dépôt", () => {
    /* Un parcours vide passerait tout : il doit avoir trouvé la chaîne du contenu. */
    expect(FILES.length).toBeGreaterThan(200);
    expect(FILES.filter((f) => inContentChain(f.rel)).length).toBeGreaterThan(50);
  });

  it("aucun fichier ne lit license_state_code : la colonne est retirée", () => {
    const readers = FILES.filter((f) => /license_state_code/.test(f.source)).map((f) => f.rel);
    expect(readers, "une seconde source d'État revient").toEqual([]);
  });

  it("aucun fichier de la chaîne du contenu ne lit l'État ou la ville de la spec du site", () => {
    const readers = FILES.filter((f) => inContentChain(f.rel) && SPEC_PLACE.test(f.source)).map((f) => f.rel);
    expect(readers, "la chaîne du contenu lit une projection au lieu de l'autorité").toEqual([]);
  });

  it("chaque lecture d'un État sur la chaîne du contenu vient de project_briefs", () => {
    /*
     * Un fichier de la chaîne qui calcule un code d'État (`stateCode`,
     * `state_code`, `.state`) doit lire `project_briefs` — ou ne rien lire du
     * tout et le recevoir d'un port qui le fait. Ceux qui en reçoivent un sont
     * repérés par le seul nom qu'ils emploient : `facts.stateCode` ou
     * `verdict.stateCode`, tous deux issus de `licenceFacts`, qui lit le brief.
     *
     * ⚠ `seg.state_code` N'EST PAS UN LECTEUR DE CE GENRE : c'est l'État d'un
     * segment de banque, créé depuis le brief et comparé à lui par la base (les
     * fonctions de tirage, et le cachet de `content_items`). Il n'est pas visé.
     */
    const offenders = FILES.filter(
      (f) =>
        inContentChain(f.rel) &&
        /\b(brief|row|pb|details|spec)\??\.state\b/.test(f.source) &&
        !/["'`]project_briefs["'`]/.test(f.source) &&
        !/\bproject_briefs\b/.test(f.source)
    ).map((f) => f.rel);
    expect(offenders, "un État lu ailleurs que dans le brief").toEqual([]);
  });

  it("le préalable ne reçoit pas d'État en paramètre : il le lit avec la licence", () => {
    const calls = FILES.flatMap((f) =>
      [...f.source.matchAll(/serverPreflightPort\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)].map((m) => ({ rel: f.rel, args: m[1] }))
    );
    expect(calls.length, "aucun appel trouvé : le motif ne voit plus le code").toBeGreaterThan(2);
    const injected = calls.filter((c) => c.args.includes(",")).map((c) => `${c.rel}: ${c.args}`);
    expect(injected, "un appelant injecte un État dans le préalable").toEqual([]);
  });

  it("le produit écrit chaque post avec l'État de sa mention", () => {
    /*
     * La base stampe l'autorité quand l'écrivain ne dit rien ; un écrivain qui a
     * COMPOSÉ une mention doit dire pour quel État, pour qu'un brief changé entre
     * le préalable et l'écriture soit refusé plutôt que masqué. Les scripts du
     * harnais ne composent pas pour publier : la base les stampe.
     */
    const inserts = FILES.filter((f) => f.rel.startsWith("lib/") && !f.rel.includes("__tests__")).flatMap((f) =>
      [...f.source.matchAll(/from\(\s*["']content_items["']\s*\)\s*\.insert\(\s*\{([\s\S]*?)\}\s*\)/g)].map((m) => ({
        rel: f.rel,
        body: m[1],
      }))
    );
    expect(inserts.length, "aucune écriture trouvée : le motif ne voit plus le code").toBeGreaterThan(0);
    const unstamped = inserts.filter((i) => !/licence_state_code\s*:/.test(i.body)).map((i) => i.rel);
    expect(unstamped).toEqual([]);
  });

  it("la route qui produit l'image demande à la base avant de composer", () => {
    const route = FILES.find((f) => f.rel === "app/api/content-items/[id]/image/route.ts");
    expect(route).toBeDefined();
    const ask = route!.source.indexOf("licenceStateProblem(");
    const compose = route!.source.indexOf("reviewCardFor(");
    expect(ask, "la route ne vérifie pas l'État du post").toBeGreaterThan(-1);
    expect(ask, "la route compose avant de vérifier").toBeLessThan(compose);
  });
});
