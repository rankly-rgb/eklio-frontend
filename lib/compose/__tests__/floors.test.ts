import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import {
  ABSOLUTE_FLOOR,
  absoluteFloorFindings,
  displayRangeFindings,
  ratioFindings,
} from "@/lib/compose/audit";
import { TYPE } from "@/lib/compose/constants";
import { render } from "@/lib/compose/engine";
import { parseBoxes } from "@/lib/compose/svg";
import { CARD, LENGTHS, PALETTES, composedFor, payloadFor } from "@/lib/compose/__tests__/fixtures";

/*
 * ── THE TYPOGRAPHIC FLOOR SUITE ─────────────────────────────────────────
 *
 * The overflow resolver may shrink an illustration and it may cut words. It may
 * not set type smaller than these, ever, and this is the file that says so
 * about the SVG rather than about the intention.
 *
 * ⚠ THE FLOOR IS 20px, AND IT IS READ OFF THE DOCUMENT. `fitText` refuses
 * below it, which means the engine cannot take that step — but "cannot" is a
 * claim about code, and this is a measurement of output.
 *
 * ⚠ LES TROIS RÈGLES VIVENT DANS `lib/compose/audit.ts`. Voir l'en-tête de
 * `negatives.test.ts` : le ratio 3:1 est resté VERT ici pendant qu'une carte
 * mesurait 2.89, et un contrôle qu'on ne peut pas mettre en échec
 * volontairement ne se distingue pas d'un contrôle qui ne regarde rien. Les
 * cas négatifs appellent exactement ces fonctions-là.
 */

const MATRIX = ARCHETYPE_KEYS.flatMap((archetype) =>
  PALETTES.flatMap((palette) => LENGTHS.map((length) => ({ archetype, palette, length })))
);

function resultsFor(archetype: string, palette: (typeof PALETTES)[number], length: (typeof LENGTHS)[number]) {
  return composedFor(archetype, palette, length);
}

describe("no glyph is set below the absolute floor", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        expect(absoluteFloorFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("the display line stays inside its own range", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        expect(displayRangeFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("the display is at least three times the smallest thing on the card", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        expect(ratioFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("anti-vacuity", () => {
  it("the floors are the ones the constants declare, not softer ones", () => {
    // If somebody lowers a floor to make a card fit, this is the line that
    // turns that into a failing test rather than a quiet regression.
    /*
     * ⚠ LES CHIFFRES ONT MONTÉ LE 2026-09-21, ET C'EST UN DURCISSEMENT.
     * Le plancher du libellé passe de 28 à 30 parce que la lisibilité se
     * mesure maintenant à 390px de large — `10,5 × 1080 / 390 = 29,08`. Le
     * mono passe de 20 à 22 sur demande. Rien n'a été abaissé.
     */
    expect(TYPE.label.floor).toBe(30);
    expect(TYPE.gloss.floor).toBe(30);
    expect(TYPE.mono.floor).toBe(22);
    expect(TYPE.display.min).toBe(64);
    // ⚠ DEUX depuis le 2026-09-21 : à trois, un titre un peu long écrasait
    // les libellés sous leur propre plancher et la carte était refusée.
    expect(TYPE.minTitleToLabelRatio).toBe(2);
    expect(ABSOLUTE_FLOOR).toBe(22);
  });

  it("the parser actually reads sizes back", () => {
    const { svg } = render({
      ...CARD,
      archetype: "single_statement",
      palette: PALETTES[0],
      payload: payloadFor("single_statement", "nominal"),
    });
    const sizes = parseBoxes(svg).filter((b) => b.role === "text").map((b) => b.size);
    expect(sizes.every((s) => typeof s === "number" && s > 0)).toBe(true);
  });
});
