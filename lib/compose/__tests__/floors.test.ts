import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { TYPE } from "@/lib/compose/constants";
import { render, renderCarousel } from "@/lib/compose/engine";
import { parseBoxes } from "@/lib/compose/svg";
import { CARD, LENGTHS, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";

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
 */

const MATRIX = ARCHETYPE_KEYS.flatMap((archetype) =>
  PALETTES.flatMap((palette) => LENGTHS.map((length) => ({ archetype, palette, length })))
);

function resultsFor(archetype: string, palette: (typeof PALETTES)[number], length: (typeof LENGTHS)[number]) {
  const input = { ...CARD, archetype, palette, payload: payloadFor(archetype, length) };
  return archetype === "carousel" ? renderCarousel(input) : [render(input)];
}

/** The absolute wall: nothing on any card, in any band, may be under this. */
const ABSOLUTE_FLOOR = Math.min(TYPE.label.floor, TYPE.mono.floor);

describe("no glyph is set below the absolute floor", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        const sizes = parseBoxes(svg)
          .filter((b) => b.role === "text")
          .map((b) => b.size ?? 0);
        expect(sizes.length).toBeGreaterThan(0);
        for (const size of sizes) {
          expect(size, `a glyph is set at ${size}px`).toBeGreaterThanOrEqual(ABSOLUTE_FLOOR);
        }
      }
    });
  }
});

describe("the display line stays inside its own range", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        const display = parseBoxes(svg).filter((b) => b.role === "text" && b.band === "headline");
        expect(display.length).toBeGreaterThan(0);
        for (const d of display) {
          expect(d.size!).toBeGreaterThanOrEqual(TYPE.display.min);
          expect(d.size!).toBeLessThanOrEqual(TYPE.display.max);
        }
      }
    });
  }
});

describe("the display is at least three times the smallest thing on the card", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      for (const { svg } of resultsFor(archetype, palette, length)) {
        const texts = parseBoxes(svg).filter((b) => b.role === "text");
        const display = Math.max(...texts.filter((t) => t.band === "headline").map((t) => t.size!));
        const smallest = Math.min(...texts.map((t) => t.size!));
        expect(
          display / smallest,
          `display ${display}px against smallest ${smallest}px`
        ).toBeGreaterThanOrEqual(TYPE.minDisplayRatio);
      }
    });
  }
});

describe("anti-vacuity", () => {
  it("the floors are the ones the constants declare, not softer ones", () => {
    // If somebody lowers a floor to make a card fit, this is the line that
    // turns that into a failing test rather than a quiet regression.
    expect(TYPE.label.floor).toBe(28);
    expect(TYPE.mono.floor).toBe(20);
    expect(TYPE.display.min).toBe(64);
    expect(TYPE.minDisplayRatio).toBe(3);
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
