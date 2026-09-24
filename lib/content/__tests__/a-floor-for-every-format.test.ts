import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkMix, familyFloor, FORMAT_FAMILIES, MONTH_LIMITS } from "@/lib/content/month-checks";

/*
 * ── ⚠ DIX BORNES DE MÉLANGE, ET UNE SEULE SAVAIT DIRE « PAS ASSEZ » ─────
 *
 * `mix.dominant`, `mix.loneSentence`, `mix.identical` sont des plafonds ;
 * `mix.distinct` se contente de sept archétypes sur onze. Un format pouvait
 * donc disparaître entièrement d'un mois livré sans déplacer un chiffre — et
 * c'est arrivé deux fois, aux deux bouts :
 *
 *   2026-09-23  zéro carrousel sur soixante posts   → plancher `mix.carousel`
 *   2026-09-24  zéro phrase seule sur trente posts  → ce plancher-ci
 *
 * La seconde fois est la conséquence de la correction de la première :
 * l'ordre de tirage a été inversé pour sauver le carrousel, et la phrase
 * seule a pris sa place dans le trou. Corriger format par format déplace le
 * trou ; chaque famille a donc son plancher.
 */

/** Les six mois enregistrés, par famille. C'est d'eux que sort le seuil. */
const RECORDED: Record<string, Record<string, number>> = {
  isla: { statement: 12, simple: 10, varied: 8 },
  marlow: { statement: 10, simple: 11, varied: 9 },
  perrin: { statement: 11, simple: 11, varied: 8 },
  wren: { statement: 11, simple: 14, varied: 5 },
  odile: { statement: 9, simple: 11, varied: 10 },
  pia: { statement: 2, simple: 20, varied: 8 },
};

/** Un mois de trente posts qui porte exactement ces parts-là. */
function monthOf(shape: Record<string, number>): string[] {
  const out: string[] = [];
  for (const [family, count] of Object.entries(shape)) {
    const keys = FORMAT_FAMILIES[family];
    /* Étalé sur les formats de la famille, pour ne pas heurter `mix.dominant`. */
    for (let i = 0; i < count; i += 1) out.push(keys[i % keys.length]);
  }
  return out;
}

const floorsIn = (archetypes: string[]) =>
  checkMix(archetypes).filter((f) => f.check.startsWith("mix.floor.")).map((f) => f.check);

describe("le plancher est calculé sur la composition visée", () => {
  /*
   * ⚠ PAS POSÉ À LA MAIN. Le tirage vise `ceil(CANDIDATES / 3)` par famille,
   * donc un tiers chacune ; le plancher en est la moitié. Si une quatrième
   * famille apparaît, la part visée tombe à un quart et le plancher suit.
   */
  it("un sixième du mois, soit cinq sur trente", () => {
    expect(Object.keys(FORMAT_FAMILIES)).toHaveLength(3);
    expect(MONTH_LIMITS.minFamilyOfTarget).toBe(0.5);
    expect(familyFloor(30)).toBe(5);
    expect(familyFloor(24)).toBe(4);
  });

  it("il suit le nombre de familles, pas un chiffre écrit en dur", () => {
    const source = readFileSync("lib/content/month-checks.ts", "utf8");
    expect(source).toContain("const target = n / Object.keys(FORMAT_FAMILIES).length;");
  });
});

describe("les six mois enregistrés, passés au plancher", () => {
  /*
   * ⚠ CINQ SUR SIX TIENNENT, ET C'EST LA SEULE RAISON POUR LAQUELLE LE SEUIL
   * VAUT UN DEMI. Un plancher qui refuserait les mois validés à l'œil ne
   * serait pas un plancher, ce serait un arrêt de production.
   */
  for (const name of ["isla", "marlow", "perrin", "wren", "odile"]) {
    it(`${name} tient`, () => {
      expect(floorsIn(monthOf(RECORDED[name]))).toEqual([]);
    });
  }

  /*
   * ⚠ `wren` EST EXACTEMENT AU PLANCHER — cinq en `varied`. Le dépassement est
   * donc STRICT, comme pour `mix.dominant` et pour la même raison : le seuil
   * est tiré des mois réels, et le mois réel qui le touche doit passer.
   */
  it("wren tient à un post près, et c'est ce qui fixe le sens de l'inégalité", () => {
    expect(RECORDED.wren.varied).toBe(familyFloor(30));
    expect(floorsIn(monthOf(RECORDED.wren))).toEqual([]);
    expect(floorsIn(monthOf({ ...RECORDED.wren, varied: 4, simple: 15 })))
      .toEqual(["mix.floor.varied"]);
  });

  /* ⚠ Et le sixième est celui que ce plancher existe pour refuser. */
  it("pia est refusé : deux posts de phrase seule sur trente", () => {
    expect(floorsIn(monthOf(RECORDED.pia))).toEqual(["mix.floor.statement"]);
  });
});

describe("chaque famille a le sien, pas seulement celle qui a manqué", () => {
  /*
   * ⚠ CORRIGER FORMAT PAR FORMAT DÉPLACE LE TROU. Le carrousel a reçu son
   * plancher le 2026-09-23 ; la phrase seule est tombée à zéro le lendemain.
   * Les trois sont donc couvertes d'un coup.
   */
  for (const family of Object.keys(FORMAT_FAMILIES)) {
    it(`${family} absente refuse le mois`, () => {
      const others = Object.keys(FORMAT_FAMILIES).filter((f) => f !== family);
      const shape = Object.fromEntries([
        [family, 0],
        ...others.map((f, i) => [f, i === 0 ? 15 : 15]),
      ]);
      expect(floorsIn(monthOf(shape))).toContain(`mix.floor.${family}`);
    });
  }

  /*
   * ⚠ SOUS DIX POSTS, LES PROPORTIONS NE VEULENT PLUS RIEN DIRE, et le
   * plancher se tait avec les autres. Un mois court est refusé par
   * `checkCount`, qui est le contrôle qui a quelque chose à en dire.
   */
  it("il se tait sur un mois trop court pour avoir un mélange", () => {
    expect(floorsIn(["carousel", "cycle", "single_statement"])).toEqual([]);
  });
});
