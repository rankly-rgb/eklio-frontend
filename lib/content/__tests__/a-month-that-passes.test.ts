import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkMonth, type PostUnderCheck } from "@/lib/content/month-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── ⚠ UN JEU DE CONTRÔLES QUI REFUSE TOUT NE VAUT PAS MIEUX QU'UN QUI
 *      N'EN REFUSE AUCUN ───────────────────────────────────────────────────
 *
 * Cinq mois enregistrés sont ici comme CONTRE-exemples : isla, marlow,
 * perrin, wren, odile, tous refusés sur leurs données réelles. Aucun ne dit
 * si les seuils laissent encore passer un bon mois.
 *
 * Celui-ci le dit. `pia.rosenthal`, 2026-10, est le premier mois livré à
 * contrôles GELÉS — deux sur dix essais, sans qu'un seuil bouge pendant la
 * mesure (F28). Il est exporté de la base tel quel.
 *
 * ⚠ S'IL SE MET À ÉCHOUER, C'EST LE CONTRÔLE QU'IL FAUT REGARDER D'ABORD,
 * pas le mois : ce fichier existe pour que le prochain tour de vis se voie
 * ici avant de se voir en production.
 */
const posts: PostUnderCheck[] = JSON.parse(
  readFileSync("lib/content/__tests__/fixtures/month-pia.json", "utf8")
);

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

describe("le mois livré le 2026-09-24 passe, et doit continuer à passer", () => {
  it("il porte bien trente posts", () => {
    expect(posts).toHaveLength(30);
  });

  it("aucun constat, sur aucun contrôle", () => {
    const findings = checkMonth({
      posts, direction: DIRECTION, wanted: 30, modalities: ["EMDR"],
    });
    expect(findings.map((f) => `${f.check} — ${f.detail.slice(0, 90)}`)).toEqual([]);
  });

  /*
   * ⚠ ET IL PORTE SES DEUX CARROUSELS. C'est le plancher de F22, et le seul
   * des onze archétypes qui en ait un — les dix autres peuvent encore
   * disparaître sans qu'un chiffre bouge, et celui-ci le fait : il ne
   * contient AUCUNE phrase seule.
   */
  it("il porte au moins deux carrousels", () => {
    const carousels = posts.filter((p) => p.archetype === "carousel").length;
    expect(carousels).toBeGreaterThanOrEqual(2);
  });

  it("⚠ et il ne porte aucune phrase seule, ce qu'aucun contrôle ne voit", () => {
    // Ce n'est pas une exigence : c'est un défaut CONNU, écrit ici pour qu'il
    // ne se découvre pas une seconde fois. Voir F28.
    expect(posts.filter((p) => p.archetype === "single_statement")).toHaveLength(0);
  });
});
