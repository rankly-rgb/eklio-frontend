import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkCount, checkMonth } from "@/lib/content/month-checks";

/*
 * ── ⚠ UN MOIS DE QUINZE POSTS A ÉTÉ LIVRÉ SANS UN SEUL CONSTAT ─────────
 *
 * Mesuré le 2026-09-23, quatrième essai, sur une banque à sec. Le tirage n'a
 * rendu que 18 candidats pour 30 posts ; 15 ont été écrits ; le mois est
 * sorti **sans refus et sans erreur**.
 *
 * Le rapport portait bien la ligne « statement: 5 of 18 (the bank had no
 * more) ». Mais un `shortfall` de rapport n'est pas un contrôle : rien ne
 * refusait le mois, et « un mois qui échoue n'est jamais livré » ne couvrait
 * pas le cas où ce qui échoue est le NOMBRE.
 *
 * Un mois court n'est pas un mois imparfait : c'est la moitié de ce qui a été
 * acheté. Le quota accorde trente crédits ; en livrer quinze est une demi-
 * livraison qu'aucune mesure ne signalait.
 */
const post = (i: number) => ({
  archetype: i % 3 === 0 ? "cycle" : i % 3 === 1 ? "comparison_pair" : "surface_and_beneath",
  title: `titre ${i}`,
  cardLine: `titre ${i}`,
  payload: { note: `unique ${i}` },
});

describe("un mois court est refusé", () => {
  it("quinze posts pour trente promis donnent un constat", () => {
    const found = checkCount(15, 30);
    expect(found).toHaveLength(1);
    expect(found[0].check).toBe("month.short");
    expect(found[0].detail).toContain("15 posts pour 30 promis");
  });

  it("trente pour trente n'en donnent aucun", () => {
    expect(checkCount(30, 30)).toHaveLength(0);
  });

  /* Plus que promis n'est pas un défaut : le sélecteur coupe déjà à `wanted`. */
  it("plus que promis ne déclenche rien", () => {
    expect(checkCount(31, 30)).toHaveLength(0);
  });

  /*
   * ⚠ SANS `wanted`, LE CONTRÔLE SE TAIT — et c'est ce qui le rendait
   * inoffensif : `checkMonth` ne recevait pas le nombre promis.
   */
  it("le contrôle se tait quand personne ne dit combien étaient promis", () => {
    expect(checkCount(15, undefined)).toHaveLength(0);
  });

  it("checkMonth le porte, et le porte en premier", () => {
    const palette = { paper: "#FFFFFF", ink: "#000000", primary: "#884422",
                      secondary: "#226688", light: "#EEEEEE", dark: "#333333" } as never;
    const findings = checkMonth({
      posts: Array.from({ length: 15 }, (_, i) => post(i)),
      direction: palette, wanted: 30,
    });
    expect(findings[0]?.check).toBe("month.short");
  });
});

/*
 * ── ⚠ ET LE NOMBRE ÉCRIT, PAS LE NOMBRE CHOISI ────────────────────────
 *
 * Mesuré le 2026-09-23, huit essais plus tard : un mois de **29 posts** est
 * sorti sans refus, alors que `checkCount` venait d'être posé.
 *
 * `checkCount` regardait la SÉLECTION, et la sélection en portait bien trente.
 * Entre elle et la base, un insert a échoué, `failures` a gagné une ligne
 * « database », la boucle a continué, et personne n'a recompté.
 *
 * ⚠ CONTRÔLER UNE GRANDEUR EN AMONT DE L'ÉCRITURE NE DIT RIEN DE CE QUI A ÉTÉ
 * ÉCRIT. C'est la même leçon que F21 — « imprimer une grandeur n'est pas la
 * contrôler » — prise un cran plus loin : la contrôler au mauvais endroit non
 * plus. Le seul nombre qui compte est celui des lignes en base.
 */
describe("le nombre écrit est recompté après l'écriture", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("le recompte lit `written`, pas la sélection", () => {
    expect(SOURCE).toContain("const shortOnWrite: Finding[] = written < WANTED");
    expect(SOURCE).toContain("posts écrits pour ${WANTED} promis");
  });

  it("il s'ajoute aux constats AVANT le refus, donc il refuse", () => {
    const at = SOURCE.indexOf("selection.remaining.push(...shortOnWrite);");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(SOURCE.indexOf("if (selection.remaining.length > 0) {"));
  });

  it("et il vient après la boucle d'insertion, pas avant", () => {
    expect(SOURCE.indexOf("written += 1;"))
      .toBeLessThan(SOURCE.indexOf("const shortOnWrite: Finding[] ="));
  });
});
