/*
 * ── THE ZONE SYSTEM, AS NUMBERS ─────────────────────────────────────────
 *
 * Everything the composition engine is allowed to know about space lives in
 * this file. Not as convention — as constants the layout reads and the tests
 * read back.
 *
 * ⚠ ONE BAND CARRIES TEXT OR DRAWING, NEVER BOTH.
 *
 * The single exception, and it is narrow: an object drawn CENTRED INSIDE a
 * shape that carries no text of its own, whose labels sit outside it. A loop
 * with an icon in the middle and its labels around the rim is the shape this
 * allows; "a faint illustration behind the copy" is the shape it forbids, and
 * that one is forbidden absolutely — there is no opacity at which a drawing
 * behind text is a considered decision rather than a way of avoiding one.
 *
 * ⚠ AND THE CLEARANCES ARE ENGINE CONSTRAINTS, NOT HOUSE STYLE.
 *
 * `layout.ts` refuses to emit a composition that violates them; it shrinks the
 * illustration, then the word count, then breaks to a carousel. A clearance
 * expressed as a guideline is a clearance that is met on the cards somebody
 * looked at.
 */

/** 1080 × 1350 — the 4:5 frame every card is composed in. */
export const CANVAS = { width: 1080, height: 1350 } as const;

/** The outer margin. Nothing is drawn or set outside it, ever. */
export const MARGIN = 72;

/** `eyebrow` — top band, mono only. */
export const EYEBROW_HEIGHT = 90;

/** `footer` — bottom band, handle and mark only. */
export const FOOTER_HEIGHT = 110;

/*
 * ── CLEARANCES, at 1080 wide ────────────────────────────────────────────
 *
 * All four are measured between BOXES, not between the things that drew them:
 * a glyph box is the em box of a set line, not its ink, because ink bounds
 * change with the string and a layout that depends on which letters were typed
 * is a layout that breaks on the next caption.
 */
export const CLEARANCE = {
  /** Between any glyph box and any drawn stroke. */
  glyphToStroke: 40,
  /** Between a glyph box and the edge of its own tinted field. */
  glyphToFieldEdge: 32,
  /** Between two adjacent tinted fields. */
  fieldToField: 48,
  /** Between the `footer` band and whatever sits above it. */
  aboveFooter: 64,
} as const;

/*
 * ── TYPOGRAPHIC FLOORS ──────────────────────────────────────────────────
 *
 * ⚠ THE OVERFLOW RESOLVER MAY NEVER CROSS THESE. When content does not fit,
 * the order is: shrink the illustration, then cut words, then break to a
 * carousel. Setting the body smaller is not on the list — a card nobody can
 * read on a phone has failed at the only thing it was for, and it fails
 * silently, which is worse than refusing to compose it.
 */
export const TYPE = {
  display: { min: 64, max: 110 },
  /** Diagram labels. `floor` is absolute: 30–44 is the range, 28 is the wall. */
  label: { min: 30, max: 44, floor: 28 },
  mono: { min: 22, max: 28, floor: 20 },
  /**
   * The display must be at least three times the smallest thing on the card.
   * Without it, "everything got a bit smaller" reads as a card with no
   * hierarchy rather than a card that did not fit.
   */
  minDisplayRatio: 3,
} as const;

/**
 * How much of the `content` band an illustration may cover — 25% to 45% of
 * THAT BAND, and 0% of every other one.
 *
 * ⚠ CLEARANCE WINS. When the two disagree, coverage is what gives: an
 * illustration at 24% with its clearances met is a card; one at 25% touching a
 * label is a mistake that happens to satisfy a percentage.
 */
export const FIGURE_COVERAGE = { min: 0.25, max: 0.45 } as const;

/**
 * At most three dark-ground cards in twelve.
 *
 * Expressed as a ratio rather than a count so the month's length can change
 * without the rule following it around; the planner reads it, the renderer
 * does not — a single card has no opinion about the month it is in.
 */
export const DARK_CARD_RATIO = 3 / 12;

/** Line height, as a multiple of the font size. One number, every band. */
export const LINE_HEIGHT = 1.18;

/**
 * ⚠ THE ENGINE VERSION IS PART OF EVERY CONTENT HASH.
 *
 * `rendered_assets.content_hash` covers (archetype + payload + palette +
 * typography + THIS). A cache that survives a change to the engine serves last
 * month's bug forever, and nobody would ever find out: the asset is there, it
 * looks like a card, and it is wrong in exactly the way that was fixed.
 *
 * Bump it whenever a change to this directory could move a pixel.
 */
export const ENGINE_VERSION = "compose/1";
