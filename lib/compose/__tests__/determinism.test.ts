import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { render, renderCarousel } from "@/lib/compose/engine";
import { contentHash, normalise } from "@/lib/compose/hash";
import { CARD, LENGTHS, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";

/*
 * ── DETERMINISM, WHICH IS A PREREQUISITE AND NOT A NICETY ───────────────
 *
 * `rendered_assets` is keyed on a hash of (archetype + payload + palette +
 * typography + engine version). If two renders of the same input differ by one
 * byte, the hash still matches — so the cache serves the FIRST one forever, and
 * whatever made them differ is now invisible. A cache over a non-deterministic
 * renderer does not fail loudly; it freezes one arbitrary output and hides the
 * rest.
 */

const MATRIX = ARCHETYPE_KEYS.flatMap((archetype) =>
  PALETTES.flatMap((palette) => LENGTHS.map((length) => ({ archetype, palette, length })))
);

function svgsFor(archetype: string, palette: (typeof PALETTES)[number], length: (typeof LENGTHS)[number]) {
  const input = { ...CARD, archetype, palette, payload: payloadFor(archetype, length) };
  return archetype === "carousel" ? renderCarousel(input).map((r) => r.svg) : [render(input).svg];
}

describe("two renders of the same payload are byte-for-byte identical", () => {
  for (const { archetype, palette, length } of MATRIX) {
    it(`${archetype} · ${palette.key} · ${length}`, () => {
      const a = svgsFor(archetype, palette, length);
      const b = svgsFor(archetype, palette, length);
      expect(a).toEqual(b);
      // Not just equal as arrays of equal strings: the same total document.
      expect(a.join("")).toBe(b.join(""));
    });
  }
});

describe("the content hash", () => {
  it("ignores key order in the payload", () => {
    const a = { axis_x: "One two", axis_y: "Three four", items: [{ label: "A b", gloss: "c d" }] };
    const b = { items: [{ gloss: "c d", label: "A b" }], axis_y: "Three four", axis_x: "One two" };
    expect(contentHash("quadrant_model", a, PALETTES[0])).toBe(
      contentHash("quadrant_model", b, PALETTES[0])
    );
  });

  it("does NOT ignore array order, which is meaning", () => {
    // A cycle's nodes are a sequence. Two orders are two different cards, and a
    // hash that normalised them would serve one when the other was asked for.
    const a = { nodes: [{ label: "A", gloss: "x" }, { label: "B", gloss: "y" }] };
    const b = { nodes: [{ label: "B", gloss: "y" }, { label: "A", gloss: "x" }] };
    expect(contentHash("cycle", a, PALETTES[0])).not.toBe(contentHash("cycle", b, PALETTES[0]));
  });

  it("changes with the palette", () => {
    const payload = payloadFor("cycle", "nominal");
    expect(contentHash("cycle", payload, PALETTES[0])).not.toBe(
      contentHash("cycle", payload, PALETTES[1])
    );
  });

  it("changes when one word changes", () => {
    const a = payloadFor("single_statement", "nominal") as { statement: string };
    const b = { statement: a.statement.replace("Rest", "Sleep") };
    expect(contentHash("single_statement", a, PALETTES[0])).not.toBe(
      contentHash("single_statement", b, PALETTES[0])
    );
  });

  it("is a lowercase SHA-256, which is what the column's CHECK demands", () => {
    // `rendered_assets_hash_check` is `~ '^[0-9a-f]{64}$'`. A hash this side
    // that did not match it would fail at the INSERT, after the render.
    expect(contentHash("cycle", payloadFor("cycle", "short"), PALETTES[0])).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  it("normalise sorts keys recursively", () => {
    expect(JSON.stringify(normalise({ b: 1, a: { d: 2, c: 3 } }))).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
});
