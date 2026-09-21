import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import {
  aboveFooterFindings,
  fieldToFieldFindings,
  glyphToStrokeFindings,
} from "@/lib/compose/audit";
import { gap, parseBoxes } from "@/lib/compose/svg";
import { composedFor, LENGTHS, PALETTES } from "@/lib/compose/__tests__/fixtures";

/*
 * ── THE COLLISION SUITE ─────────────────────────────────────────────────
 *
 * ⚠ IT PARSES THE EMITTED SVG, not the composition object the SVG was built
 * from. A bug in `toSvg` that dropped a box, or wrote it in the wrong
 * coordinate space, is invisible to a test that reads the object — and that is
 * the bug that ships a broken card while the suite stays green.
 *
 * ⚠ AND IT FAILS. It does not warn, it does not log, and there is no
 * tolerance: a card that puts a label 39px from a stroke is a card that gets
 * posted to a stranger's feed at 1080px, and the only moment anybody can
 * cheaply notice is this one.
 *
 * ⚠ LES RÈGLES ELLES-MÊMES VIVENT DANS `lib/compose/audit.ts`, ET C'EST
 * DÉLIBÉRÉ. Une règle écrite à l'intérieur d'un `expect` ne peut pas être mise
 * en échec volontairement : on ne peut donc pas prouver qu'elle attraperait la
 * régression qu'elle est censée attraper. `negatives.test.ts` appelle CES
 * fonctions-ci sur des documents fabriqués pour les violer. Les deux moitiés
 * sont nécessaires : celle-ci dit que les cartes sont propres, l'autre dit que
 * le contrôle sait voir une carte sale.
 */

const MATRIX = ARCHETYPE_KEYS.flatMap((archetype) =>
  PALETTES.flatMap((palette) =>
    LENGTHS.map((length) => ({ archetype, palette, length }))
  )
);

/*
 * ⚠ CE QUE LE PRODUIT LIVRE, PAS LA PREMIÈRE FORME ESSAYÉE. Depuis le
 * contrôle de lisibilité en vignette, une fixture au plafond d'items peut
 * légitimement se replier ; c'est la carte repliée qui sera publiée, et c'est
 * donc elle qui doit être propre.
 */
function svgsFor(archetype: string, palette: (typeof PALETTES)[number], length: (typeof LENGTHS)[number]) {
  return composedFor(archetype, palette, length).map((r) => r.svg);
}

describe("no glyph box comes within 40px of a drawn stroke", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        expect(glyphToStrokeFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("no two tinted fields come within 48px of each other", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        expect(fieldToFieldFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("nothing comes within 64px of the footer band", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        expect(aboveFooterFindings(svg)).toEqual([]);
      }
    });
  }
});

describe("anti-vacuity", () => {
  /*
   * The suite above proves nothing if the parser finds no boxes. This asserts
   * that the matrix actually produces text AND strokes to compare — and it
   * names the archetypes that legitimately draw nothing, so adding a twelfth
   * that silently drew nothing would fail here rather than pass everywhere.
   */
  const DRAWS_NOTHING = new Set(["single_statement", "practitioner_card", "carousel"]);

  for (const archetype of ARCHETYPE_KEYS) {
    it(`${archetype} emits the boxes the suite measures`, () => {
      const svg = svgsFor(archetype, PALETTES[0], "nominal")[0];
      const boxes = parseBoxes(svg);
      expect(boxes.filter((b) => b.role === "text").length).toBeGreaterThan(0);
      if (!DRAWS_NOTHING.has(archetype)) {
        expect(boxes.filter((b) => b.role === "stroke").length).toBeGreaterThan(0);
      }
    });
  }

  it("the collision check can fail", () => {
    // Two boxes 10px apart must measure as 10, not as "far enough".
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(10);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(0);
  });
});
