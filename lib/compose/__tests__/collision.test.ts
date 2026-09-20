import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { CLEARANCE } from "@/lib/compose/constants";
import { FOOTER } from "@/lib/compose/constants-bands";
import { render, renderCarousel } from "@/lib/compose/engine";
import { gap, parseBoxes } from "@/lib/compose/svg";
import { CARD, LENGTHS, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";

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
 */

const MATRIX = ARCHETYPE_KEYS.flatMap((archetype) =>
  PALETTES.flatMap((palette) =>
    LENGTHS.map((length) => ({ archetype, palette, length }))
  )
);

function svgsFor(archetype: string, palette: (typeof PALETTES)[number], length: (typeof LENGTHS)[number]) {
  const input = { ...CARD, archetype, palette, payload: payloadFor(archetype, length) };
  return archetype === "carousel"
    ? renderCarousel(input).map((r) => r.svg)
    : [render(input).svg];
}

describe("no glyph box comes within 40px of a drawn stroke", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        const boxes = parseBoxes(svg);
        const texts = boxes.filter((b) => b.role === "text");
        const strokes = boxes.filter((b) => b.role === "stroke");

        for (const t of texts) {
          for (const s of strokes) {
            const d = gap(t.box, s.box);
            expect(
              d,
              `glyph box ${JSON.stringify(t.box)} is ${d}px from stroke ${JSON.stringify(s.box)}`
            ).toBeGreaterThanOrEqual(CLEARANCE.glyphToStroke);
          }
        }
      }
    });
  }
});

describe("no two tinted fields come within 48px of each other", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        const fields = parseBoxes(svg).filter((b) => b.role === "field");
        for (let i = 0; i < fields.length; i += 1) {
          for (let j = i + 1; j < fields.length; j += 1) {
            const d = gap(fields[i].box, fields[j].box);
            expect(d, `fields ${i} and ${j} are ${d}px apart`).toBeGreaterThanOrEqual(
              CLEARANCE.fieldToField
            );
          }
        }
      }
    });
  }
});

describe("nothing comes within 64px of the footer band", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const svg of svgsFor(archetype, palette, length)) {
        for (const b of parseBoxes(svg)) {
          if (b.band === "footer") continue;
          const clear = FOOTER.y - (b.box.y + b.box.h);
          expect(clear, `${b.role} in ${b.band} is ${clear}px above the footer`).toBeGreaterThanOrEqual(
            CLEARANCE.aboveFooter
          );
        }
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
