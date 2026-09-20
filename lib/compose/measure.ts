import type { FontRole } from "@/lib/compose/types";

/*
 * ── MEASURING TEXT WITHOUT A FONT FILE ──────────────────────────────────
 *
 * ⚠ WHY NOT SATORI, WHICH THIS REPO ALREADY USES.
 *
 * Two reasons, and the second is the one that decided it.
 *
 * 1. satori needs real font bytes, which come from Google over the network via
 *    the `fonts` bucket. `lib/kit/__tests__/render-composition.test.ts` already
 *    stubs satori out for exactly this reason. A collision suite that stubs the
 *    thing it is measuring measures nothing.
 *
 * 2. satori is a flexbox engine. It cannot be told "keep 40px between any glyph
 *    box and any drawn stroke", and it does not hand back the boxes it
 *    computed. The four suites this chantier requires — collision, floors,
 *    determinism, budget — all need those boxes. An engine that cannot show its
 *    work cannot be held to a clearance.
 *
 * So the geometry is computed here and the SVG is emitted directly, with each
 * box written into the output as `data-box`. satori stays where it already
 * earns its place: the identity assets in `lib/kit/render/`.
 *
 * ── ⚠ THE ESTIMATOR IS DELIBERATELY WIDE ────────────────────────────────
 *
 * These ratios are not the true advance widths of Fraunces, Karla and IBM Plex
 * Mono. They are an upper bound on them, and `SAFETY` widens them again.
 *
 * That direction is the whole point and it is not a detail. If the estimate
 * were narrow, a line that measures as fitting would overflow in the real
 * render, and the collision suite would go green on cards that collide. Being
 * wide costs a slightly smaller type size on a handful of cards; being narrow
 * costs the guarantee. The test suite asserts the direction, so nobody can
 * "improve" the table into being tight.
 */

/** Per-family multiplier over the class ratios below, in ems. */
const FAMILY: Record<FontRole, number> = {
  // Fraunces is a display serif with generous sidebearings at optical size.
  display: 1.0,
  sans: 0.95,
  // IBM Plex Mono: every glyph is the same width, so the classes below do not
  // apply at all — handled as a special case in `advance`.
  mono: 0.6,
};

/** Characters far narrower than the norm. */
const NARROW = new Set("ijltfrI.,'\"`!|()[]{}:;-".split(""));
/** Characters far wider than the norm. */
const WIDE = new Set("mwMW@%&".split(""));

/**
 * A single 1.06 multiplier over every measurement.
 *
 * It exists because the classes above are coarse: a string of all-caps in a
 * serif can beat the "uppercase" ratio on an unlucky pair, and kerning is not
 * modelled at all. 6% is roughly one character in a sixteen-character line,
 * which is the granularity the wrapper works at anyway.
 */
const SAFETY = 1.06;

function classRatio(ch: string): number {
  if (ch === " ") return 0.28;
  if (NARROW.has(ch)) return 0.34;
  if (WIDE.has(ch)) return 0.92;
  if (ch >= "A" && ch <= "Z") return 0.68;
  if (ch >= "0" && ch <= "9") return 0.58;
  return 0.55;
}

/** The advance of one character, in ems, for this family. Never below zero. */
export function advance(ch: string, family: FontRole): number {
  if (family === "mono") return FAMILY.mono;
  return classRatio(ch) * FAMILY[family];
}

/** The width of `text` at `size`, in px. Deterministic and family-aware. */
export function measure(text: string, family: FontRole, size: number): number {
  let ems = 0;
  for (const ch of text) ems += advance(ch, family);
  return round2(ems * size * SAFETY);
}

/**
 * Greedy wrap at `maxWidth`. Returns the lines, never an empty array for
 * non-empty input.
 *
 * ⚠ A WORD LONGER THAN THE LINE IS NOT BROKEN. It is returned on a line of its
 * own and overflows, and `layout.ts` sees that overflow and shrinks. Breaking
 * it would hide the one case where the word budget was wrong, and hyphenating
 * a therapist's own phrasing is not this engine's decision to make.
 */
export function wrap(text: string, family: FontRole, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate, family, size) <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/** The widest of the wrapped lines, in px. */
export function blockWidth(lines: string[], family: FontRole, size: number): number {
  return lines.reduce((widest, line) => Math.max(widest, measure(line, family, size)), 0);
}

/**
 * Round to two decimals.
 *
 * ⚠ THIS IS WHAT MAKES THE OUTPUT BYTE-FOR-BYTE REPRODUCIBLE, and byte-for-byte
 * reproducibility is what makes `rendered_assets.content_hash` a cache key
 * rather than a coincidence. Unrounded floats differ in their last digit
 * between two arithmetically equivalent orders of operations, and the SVG
 * prints every digit.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
