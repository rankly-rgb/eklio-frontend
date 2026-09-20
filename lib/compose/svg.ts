import { CANVAS } from "@/lib/compose/constants";
import { round2 } from "@/lib/compose/measure";
import type { Box, Composition, Placed } from "@/lib/compose/types";

/*
 * ── EMITTING THE SVG, AND WHY IT CARRIES ITS OWN BOXES ──────────────────
 *
 * Every placed element is wrapped in a `<g>` carrying `data-role` and
 * `data-box`. That is not debug output: it is the contract the collision suite
 * reads.
 *
 * The alternative — parsing geometry back out of the emitted paths — means
 * implementing bezier bounds inside the test. A bug there would make the suite
 * pass on cards that collide, which is the exact failure a collision suite
 * exists to prevent. The boxes are computed by whoever drew the thing, printed
 * alongside it, and read back verbatim.
 *
 * ⚠ AND THE OUTPUT IS BYTE-FOR-BYTE REPRODUCIBLE. Every number goes through
 * `round2`, attributes are emitted in a fixed order, and nothing here reads a
 * clock, a random source, or an object key order that is not already sorted.
 * `rendered_assets.content_hash` is a cache key only if that holds.
 */

const FAMILY_STACK = {
  display: "Fraunces",
  sans: "Karla",
  mono: "IBM Plex Mono",
} as const;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boxAttr(b: Box): string {
  return `${round2(b.x)},${round2(b.y)},${round2(b.w)},${round2(b.h)}`;
}

function renderPlaced(p: Placed): string {
  const head = `<g data-role="${p.role}" data-band="${p.band}" data-box="${boxAttr(p.box)}">`;

  if (p.role === "field") {
    return (
      head +
      `<rect x="${round2(p.box.x)}" y="${round2(p.box.y)}" ` +
      `width="${round2(p.box.w)}" height="${round2(p.box.h)}" ` +
      `rx="${round2(p.radius)}" fill="${p.fill}"/>` +
      `</g>`
    );
  }

  if (p.role === "figure") {
    const body = p.strokes
      .map((s) => {
        const common =
          `fill="${s.fill}" stroke="${s.stroke}" stroke-width="${round2(s.strokeWidth)}" ` +
          `stroke-linecap="round" stroke-linejoin="round" ` +
          `data-box="${boxAttr(s.box)}"`;
        return `<path d="${s.d}" ${common}/>`;
      })
      .join("");
    return head + body + `</g>`;
  }

  const body = p.lines
    .map((l) => {
      // ⚠ THE BASELINE, DERIVED FROM THE EM BOX TOP. Boxes are what the
      // clearances are measured between, so the box is what the layout
      // positions; the baseline is arithmetic over it and lives only here.
      const baseline = round2(l.box.y + l.size * 0.8);
      const x = l.anchor === "middle" ? round2(l.box.x + l.box.w / 2) : round2(l.box.x);
      return (
        `<text x="${x}" y="${baseline}" ` +
        `font-family="${FAMILY_STACK[l.family]}" font-size="${round2(l.size)}" ` +
        `font-weight="${l.weight}" fill="${l.fill}" ` +
        `text-anchor="${l.anchor}" ` +
        `data-box="${boxAttr(l.box)}">${esc(l.text)}</text>`
      );
    })
    .join("");

  return head + body + `</g>`;
}

export function toSvg(composition: Composition, paper: string): string {
  const body = composition.placed.map(renderPlaced).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${CANVAS.width}" height="${CANVAS.height}" ` +
    `viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" ` +
    `data-archetype="${esc(composition.archetype)}" ` +
    `data-palette="${esc(composition.paletteKey)}">` +
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${paper}"/>` +
    body +
    `</svg>`
  );
}

/* ── Reading it back, for the suites ─────────────────────────────────── */

export type ParsedBox = { role: string; band: string; box: Box; size?: number };

const G_RE = /<g data-role="([a-z]+)" data-band="([a-z]+)" data-box="([^"]+)">([\s\S]*?)<\/g>/g;
const TEXT_RE = /<text [^>]*font-size="([0-9.]+)"[^>]*data-box="([^"]+)"/g;
const STROKE_RE = /<path [^>]*data-box="([^"]+)"/g;

function parseBox(s: string): Box {
  const [x, y, w, h] = s.split(",").map(Number);
  return { x, y, w, h };
}

/**
 * Every glyph box and every stroke box in the document, flattened.
 *
 * The suites work on this rather than on the composition object on purpose: a
 * bug in `toSvg` that dropped a box, or emitted it in the wrong coordinate
 * space, would be invisible to a test that checked the object it was built
 * from.
 */
export function parseBoxes(svg: string): ParsedBox[] {
  const out: ParsedBox[] = [];
  for (const m of svg.matchAll(G_RE)) {
    const [, role, band, , inner] = m;
    if (role === "text") {
      for (const t of inner.matchAll(TEXT_RE)) {
        out.push({ role: "text", band, box: parseBox(t[2]), size: Number(t[1]) });
      }
    } else if (role === "figure") {
      for (const s of inner.matchAll(STROKE_RE)) {
        out.push({ role: "stroke", band, box: parseBox(s[1]) });
      }
    } else {
      out.push({ role, band, box: parseBox(m[3]) });
    }
  }
  return out;
}

/** The gap between two boxes: 0 when they overlap, otherwise the shortest distance. */
export function gap(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  // ⚠ NOT THE EUCLIDEAN DISTANCE. Two boxes offset on both axes are separated
  // by the larger of the two gaps as far as a reader is concerned — the
  // diagonal is longer, and using it would let a label sit 30px below and 30px
  // left of a stroke and call it 42px of clearance.
  if (dx === 0 && dy === 0) return 0;
  // ⚠ ROUNDED TO THE PRECISION THE DOCUMENT CARRIES. Every coordinate in the
  // SVG is printed to two decimals, so a gap of 47.999999999999886 and a gap
  // of 48 are the same document. Comparing the raw float made three
  // archetypes fail a clearance they met exactly — the accumulated error of
  // adding a rounded row height n times, not a layout mistake.
  return round2(Math.max(dx, dy));
}
