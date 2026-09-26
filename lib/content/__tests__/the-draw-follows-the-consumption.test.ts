import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CANDIDATES_PER_ATTEMPT,
  EXAMINED_YIELD,
  POSTS_PER_MONTH,
  SPARE_POOL,
  USABLE_TARGET,
  candidatesToSubmit,
  drawnPerAttempt,
} from "@/lib/content/bank";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";

/*
 * ── F41 — LE TIRAGE DOIT SUIVRE CE QUE LE RUN CONSOMME ──────────────────
 *
 * 102 candidats soumis et payés, une cinquantaine examinés. La cause n'était pas
 * une erreur d'arithmétique mais une TAUTOLOGIE prise pour une mesure :
 * `PREPARATION_YIELD = 0.479` valait « seuil d'arrêt / tirage » — 36/72 — donc
 * 50 % quoi que le modèle écrive. Le tirage a ensuite été redérivé de ce ratio,
 * et la mesure s'est confirmée elle-même : relever le banc doublait le tirage, et
 * le doublement prouvait le rendement.
 *
 * Deux structures rendaient l'erreur invisible, et ce fichier les tient toutes
 * les deux :
 *
 *   1. le tirage était un LITTÉRAL — un littéral ne peut pas diverger de la
 *      boucle qui le consomme, il peut seulement avoir tort ;
 *   2. la cible d'arrêt vivait dans le harnais et le tirage dans le
 *      dimensionnement — deux fichiers, aucune expression commune.
 */

const BANK = readFileSync("lib/content/bank.ts", "utf8");
const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

describe("le tirage est dérivé, pas écrit", () => {
  it("CANDIDATES_PER_ATTEMPT est un appel, pas un nombre", () => {
    const line = BANK.slice(BANK.indexOf("export const CANDIDATES_PER_ATTEMPT"));
    expect(
      line.slice(0, 120),
      "CANDIDATES_PER_ATTEMPT est redevenu un littéral — c'est exactement F41"
    ).toContain("candidatesToSubmit(");
    expect(line.slice(0, 120)).not.toMatch(/=\s*\d+\s*;/);
  });

  it("il couvre la cible au rendement retenu", () => {
    expect(CANDIDATES_PER_ATTEMPT * EXAMINED_YIELD).toBeGreaterThanOrEqual(USABLE_TARGET);
  });

  /*
   * ⚠ ET IL NE LA COUVRE PAS DEUX FOIS. C'est la borne que F41 a coûté : tout
   * candidat soumis est facturé à la soumission du lot, examiné ou non.
   */
  it("il ne soumet pas le double de ce qu'il consomme", () => {
    expect(
      CANDIDATES_PER_ATTEMPT,
      `${CANDIDATES_PER_ATTEMPT} soumis pour ${USABLE_TARGET} consommés — la moitié serait payée sans être lue`
    ).toBeLessThan(USABLE_TARGET * 1.5);
  });

  /*
   * ⚠ LA SOMME PAR ARCHÉTYPE DOIT VALOIR LE TIRAGE. La boucle prend
   * `ceil(candidats / familles)` par famille : un nombre qui ne divise pas fait
   * tirer plus que demandé, et fait mentir toute cible de banque d'un ou deux
   * sujets par archétype.
   */
  it("la somme par archétype vaut exactement le tirage", () => {
    const total = Object.values(drawnPerAttempt()).reduce((a, b) => a + b, 0);
    expect(total).toBe(CANDIDATES_PER_ATTEMPT);
    expect(CANDIDATES_PER_ATTEMPT % Object.keys(FORMAT_FAMILIES).length).toBe(0);
  });

  it.each([
    [36, 0.85],
    [48, 0.85],
    [48, 0.7],
    [60, 0.95],
  ])("la somme tombe juste aussi pour (cible %s, rendement %s)", (target, rate) => {
    const n = candidatesToSubmit(target, rate);
    expect(n % Object.keys(FORMAT_FAMILIES).length).toBe(0);
    expect(n * rate).toBeGreaterThanOrEqual(target);
    expect(Object.values(drawnPerAttempt(n)).reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe("le harnais et le dimensionnement lisent la même cible", () => {
  it("le harnais ne déclare plus son propre banc ni son propre compte de posts", () => {
    expect(MONTH, "SPARE_POOL est redéclaré dans le harnais").not.toMatch(
      /^const SPARE_POOL\s*=/m
    );
    expect(MONTH, "WANTED est redevenu un littéral").not.toMatch(/^const WANTED\s*=\s*\d+/m);
  });

  it("il importe les trois grandeurs du dimensionnement", () => {
    const imports = MONTH.slice(
      MONTH.indexOf("} from \"../../lib/content/bank\";") - 400,
      MONTH.indexOf("} from \"../../lib/content/bank\";")
    );
    for (const name of ["CANDIDATES_PER_ATTEMPT", "POSTS_PER_MONTH", "SPARE_POOL", "USABLE_TARGET"]) {
      expect(imports, `${name} n'est pas importé du dimensionnement`).toContain(name);
    }
  });

  it("la cible est bien la somme des deux", () => {
    expect(USABLE_TARGET).toBe(POSTS_PER_MONTH + SPARE_POOL);
  });
});

/*
 * ── ⚠ ET LE RENDEMENT RESTE UN RAPPORT SUR LES EXAMINÉS ─────────────────
 *
 * `PREPARATION_YIELD` était exporté et n'était utilisé par AUCUN code : il ne
 * vivait que dans le commentaire qui justifiait 102. Un nombre qui a l'air de
 * piloter le dimensionnement sans le piloter est pire qu'un nombre absent — un
 * humain l'a lu et s'en est servi pour raisonner.
 */
describe("le rendement ne peut pas redevenir une tautologie", () => {
  /*
   * ⚠ LA DÉCLARATION, PAS LA MENTION. Le nom reste cité dans le commentaire qui
   * explique pourquoi il a disparu — c'est le seul endroit où il doit vivre.
   */
  it("l'ancien nom n'est plus déclaré", () => {
    expect(BANK, "PREPARATION_YIELD est redéclaré").not.toMatch(
      /^export const PREPARATION_YIELD/m
    );
  });

  it("le nom du nouveau dit sur quoi il porte", () => {
    expect(BANK).toContain("export const EXAMINED_YIELD");
  });

  /*
   * ⚠ ET IL EST SOUS LE MINIMUM OBSERVÉ. Se tromper vers le haut coûte des
   * appels jetés ; vers le bas, un banc plus mince. Le minimum mesuré sur
   * 30 essais était 0,923 ; au-dessus de lui, le tirage n'aurait plus de marge.
   */
  it("il est conservateur, et strictement un rapport", () => {
    expect(EXAMINED_YIELD).toBeGreaterThan(0);
    expect(EXAMINED_YIELD).toBeLessThanOrEqual(0.92);
  });

  /*
   * ── ⚠ ET IL NE SE DÉDUIT PAS DU TIRAGE, DANS LA SOURCE ────────────────
   *
   * La première version de ce test comparait `EXAMINED_YIELD` à
   * `USABLE_TARGET / CANDIDATES_PER_ATTEMPT` et exigeait qu'ils diffèrent. Elle
   * était fausse : le tirage vaut `ceil(cible / rendement)`, donc
   * `cible / tirage ≈ rendement` est une IDENTITÉ, pas une tautologie. Un test
   * qui vérifie une identité échoue en annonçant un défaut qui n'existe pas.
   *
   * La tautologie de F41 était un défaut de PROCÉDÉ — mesurer le rendement comme
   * `utilisables / tirés` sur des runs qui s'arrêtaient au seuil, puis en
   * redériver le tirage. Aucun test sur des constantes ne le voit. Ce qu'un test
   * voit, c'est que la constante reste un littéral posé par une mesure, et non
   * une expression qui se nourrit du tirage.
   */
  it("sa déclaration est un littéral, pas une expression", () => {
    const decl = BANK.slice(
      BANK.indexOf("export const EXAMINED_YIELD"),
      BANK.indexOf(";", BANK.indexOf("export const EXAMINED_YIELD")) + 1
    );
    expect(decl).toMatch(/^export const EXAMINED_YIELD = 0\.\d+;$/);
    for (const name of ["USABLE_TARGET", "CANDIDATES_PER_ATTEMPT", "POSTS_PER_MONTH"]) {
      expect(decl, `le rendement se calcule depuis ${name}`).not.toContain(name);
    }
  });

  /*
   * ⚠ ET SON COMMENTAIRE DIT SUR QUOI IL A ÉTÉ MESURÉ. C'est ce qui manquait :
   * « 174 utilisables sur 363 » ne disait pas que les 363 incluaient les jamais
   * examinés, et personne ne pouvait le deviner en lisant le chiffre.
   */
  it("sa provenance est écrite, et elle nomme le bon dénominateur", () => {
    const before = BANK.slice(0, BANK.indexOf("export const EXAMINED_YIELD"));
    const comment = before.slice(before.lastIndexOf("/*"));
    expect(comment.toLowerCase()).toContain("examin");
    expect(comment, "la provenance ne cite aucune mesure").toMatch(/0,9\d\d|0\.9\d\d/);
  });
});
