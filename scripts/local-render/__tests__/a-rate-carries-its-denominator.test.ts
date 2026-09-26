import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

/*
 * ── ⚠ « 46 SUR 102 » N'A JAMAIS ÉTÉ UN TAUX DE CONFORMITÉ ────────────────
 *
 * Deux briefs de suite ont conclu, sur ce chiffre, que la première écriture
 * était le goulot du pipeline : « conformité au premier appel à 46 sur 102,
 * concentrée sur trois classes ». Le numérateur était juste. Le dénominateur
 * ne l'était pas.
 *
 * La boucle d'examen s'arrête dès qu'elle tient `WANTED + SPARE_POOL`
 * utilisables — 48. Sur 102 candidats tirés, elle en regarde une cinquantaine
 * et ne touche jamais aux autres. La mesure vraie du 2026-09-26 est donc
 * « 46 conformes sur 48 examinés », soit 96 %, et non 45 %.
 *
 * ⚠ CE FICHIER NE VÉRIFIE PAS UN TAUX, IL VÉRIFIE QU'IL EST DIVISIBLE. Un
 * compteur de numérateur sans son dénominateur produit un chiffre que
 * quelqu'un divisera par ce qu'il a sous la main, et c'est arrivé deux fois.
 */
describe("la conformité au premier appel porte son dénominateur", () => {
  it("l'entonnoir compte les candidats EXAMINÉS", () => {
    expect(MONTH, "funnel.examined a disparu").toContain("examined: 0,");
    expect(MONTH).toContain("funnel.examined += 1;");
  });

  /*
   * ⚠ L'INCRÉMENT EST APRÈS LE `break`, ET C'EST TOUT CE QUI COMPTE. Placé
   * avant, il compterait les 102 tirés et rendrait exactement le dénominateur
   * faux qu'il doit remplacer.
   */
  it("il est compté après l'arrêt de boucle, pas avant", () => {
    const loop = MONTH.indexOf("for (const candidate of candidates) {");
    const stop = MONTH.indexOf("if (usable.length >= WANTED + SPARE_POOL) break;", loop);
    const count = MONTH.indexOf("funnel.examined += 1;", loop);
    expect(stop).toBeGreaterThan(loop);
    expect(count, "l'examen est compté AVANT l'arrêt : le dénominateur redevient le tirage")
      .toBeGreaterThan(stop);
  });

  it("le numérateur et le dénominateur sont voisins dans l'entonnoir", () => {
    const at = MONTH.indexOf("examined: 0,");
    expect(MONTH.slice(at, at + 120)).toContain("conformantFirstCall: 0,");
  });
});
