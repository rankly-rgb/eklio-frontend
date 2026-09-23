import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ UN MOIS REFUSÉ REND CE QU'IL N'A PAS PUBLIÉ ──────────────────────
 *
 * Le 2026-09-23, `20-month.ts` rendait les sujets sur-générés et soldait
 * leurs crédits DANS UN BLOC PLACÉ APRÈS LE REFUS — donc après un `throw`.
 *
 * Un essai refusé gardait alors pour quatre-vingt-dix jours une vingtaine de
 * sujets qu'il n'avait pas publiés, et ne soldait aucune de leurs
 * réservations. CHAQUE ESSAI REFUSÉ RENDAIT LE SUIVANT PLUS PAUVRE : c'est le
 * mécanisme de F13 vu de l'intérieur. On cherchait le défaut dans le tirage —
 * un mois de 23 posts, puis un de 16 — et il était dans l'ordre de deux blocs.
 *
 * Aucune suite ne pouvait le voir : les deux blocs existaient, chacun était
 * juste, et le script se terminait sur un `throw` attendu. Ce test lit donc
 * l'ORDRE, qui est la seule chose qui était fausse.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

const at = (needle: string): number => {
  const i = SOURCE.indexOf(needle);
  expect(i, `introuvable dans 20-month.ts : ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("un essai refusé ne s'appauvrit pas lui-même", () => {
  const refusal = at("if (selection.remaining.length > 0) {");

  it("les sujets non publiés sont rendus AVANT le refus", () => {
    expect(at('untypedTable(db, "topic_assignments").delete()')).toBeLessThan(refusal);
  });

  it("les crédits des candidats écartés sont soldés AVANT le refus", () => {
    expect(at("for (const candidate of discarded) {")).toBeLessThan(refusal);
  });

  it("le refus sort bien en erreur — la restitution ne l'adoucit pas", () => {
    const tail = SOURCE.slice(refusal, refusal + 1600);
    expect(tail).toContain("throw new Error(");
    expect(tail).toContain("refused: true");
  });
});
