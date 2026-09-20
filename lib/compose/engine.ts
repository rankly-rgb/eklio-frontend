import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { BODY, EYEBROW, FOOTER } from "@/lib/compose/constants-bands";
import { CLEARANCE, TYPE } from "@/lib/compose/constants";
import { BudgetExceededError, budgetErrors } from "@/lib/compose/budget";
import { fitText, linesFrom, splitBody } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { gap } from "@/lib/compose/svg";
import { toSvg } from "@/lib/compose/svg";
import type { Box, Composition, Palette, Placed, RenderInput } from "@/lib/compose/types";


/*
 * ── THE OVERFLOW RESOLVER, IN ORDER, AND ONLY IN THAT ORDER ─────────────
 *
 *   1. shrink the illustration
 *   2. cut words
 *   3. break to a carousel
 *
 * ⚠ SETTING THE BODY SMALLER IS NOT ON THE LIST and never becomes step 4. A
 * card that fits because the labels went to 24px has not solved the problem, it
 * has moved it onto a phone screen where nobody will report it — they will just
 * not read it. `fitText` refuses below the floor, so the resolver cannot take
 * that step even by accident.
 *
 * ── AND THE CLEARANCES ARE CHECKED HERE, NOT ONLY IN THE SUITE ──────────
 *
 * `violations()` runs on every render. A composition that breaks a clearance is
 * not emitted; the resolver moves to its next step, and if it runs out of
 * steps, `render` throws. A constraint that only a test enforces is a
 * constraint that holds until somebody renders something the test did not
 * think of.
 */

export class CompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositionError";
  }
}

export type Violation = { kind: string; a: Box; b: Box; measured: number; required: number };

/**
 * One hundredth of a pixel.
 *
 * ⚠ THIS IS NOT A TOLERANCE ON THE CLEARANCE, it is the precision of the
 * document. Coordinates are emitted with two decimals, so two values closer
 * than 0.01 produce identical output — and a rounded row height added three
 * times lands 0.0000001 short of an exact 48. Judging that as a violation
 * would mean the engine refuses layouts that are, in the file it writes,
 * exactly right.
 */
const EPSILON = 0.01;

function short(measured: number, required: number): boolean {
  return measured < required - EPSILON;
}

/**
 * Every clearance this composition breaks.
 *
 * ⚠ GLYPHS INSIDE A FIELD ARE EXEMPT FROM THAT FIELD. They are 32px from its
 * edge by construction (`cell`), which is the `glyphToFieldEdge` rule, and
 * measuring them against their own background would report every cell on every
 * card as a collision.
 */
export function violations(placed: Placed[]): Violation[] {
  const out: Violation[] = [];
  const fields = placed.filter((p) => p.role === "field");
  const figures = placed.filter((p) => p.role === "figure");
  const texts = placed.filter((p) => p.role === "text");

  // 1. glyph box vs drawn stroke
  for (const t of texts) {
    for (const l of (t as Extract<Placed, { role: "text" }>).lines) {
      for (const f of figures) {
        for (const s of (f as Extract<Placed, { role: "figure" }>).strokes) {
          const d = gap(l.box, s.box);
          if (short(d, CLEARANCE.glyphToStroke)) {
            out.push({ kind: "glyphToStroke", a: l.box, b: s.box, measured: d, required: CLEARANCE.glyphToStroke });
          }
        }
      }
    }
  }

  // 2. two tinted fields
  for (let i = 0; i < fields.length; i += 1) {
    for (let j = i + 1; j < fields.length; j += 1) {
      const d = gap(fields[i].box, fields[j].box);
      if (short(d, CLEARANCE.fieldToField)) {
        out.push({ kind: "fieldToField", a: fields[i].box, b: fields[j].box, measured: d, required: CLEARANCE.fieldToField });
      }
    }
  }

  /*
   * 3. anything above the footer.
   *
   * ⚠ EVERY STROKE'S OWN BOX, NOT THE FIGURE'S. A figure's box is where the
   * drawing was allotted; a stroke's box is where its ink actually is, and a
   * 4px line drawn on the allotment's bottom edge sticks 2px past it. The
   * first version checked only the figure and passed a composition whose rule
   * ran 62px above the footer — which the suite caught, because the suite
   * reads the strokes.
   */
  for (const p of placed) {
    if (p.band === "footer") continue;
    const boxes: Box[] =
      p.role === "figure"
        ? (p as Extract<Placed, { role: "figure" }>).strokes.map((s) => s.box)
        : [p.box];
    for (const box of boxes) {
      const d = round2(FOOTER.y - (box.y + box.h));
      if (short(d, CLEARANCE.aboveFooter)) {
        out.push({ kind: "aboveFooter", a: box, b: FOOTER, measured: d, required: CLEARANCE.aboveFooter });
      }
    }
  }

  return out;
}

/** Strip every gloss, for the resolver's second step. Non-destructive. */
function withoutGlosses(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(withoutGlosses);
  if (payload !== null && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = k === "gloss" ? "" : withoutGlosses(v);
    }
    return out;
  }
  return payload;
}

const FIGURE_SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

function bandText(
  band: "eyebrow" | "footer",
  box: Box,
  text: string,
  palette: Palette,
  secondaryMax: number
): Placed | null {
  const range = {
    min: TYPE.mono.min,
    max: Math.min(TYPE.mono.max, secondaryMax),
    floor: TYPE.mono.floor,
  };
  if (range.max < range.floor) return null;
  const fit = fitText(text, "mono", box.w, box.h, range);
  if (!fit) return null;
  return {
    role: "text",
    band,
    box: { ...box, h: fit.height },
    lines: linesFrom(fit, box.x, box.y, box.w, "mono", 500, palette.ink, "start"),
  };
}

export type RenderResult = { svg: string; composition: Composition; smallestSize: number };

export function render(input: RenderInput): RenderResult {
  const archetype = ARCHETYPES[input.archetype];
  if (!archetype) throw new CompositionError(`unknown archetype: ${input.archetype}`);

  // ── STEP 0: the word budget, before anything is measured ────────────────
  const errors = budgetErrors(input.archetype, input.payload);
  if (errors.length > 0) throw new BudgetExceededError(input.archetype, errors);

  const parsed = archetype.parse(input.payload);
  if (parsed === null) throw new CompositionError(`${input.archetype}: payload does not parse`);

  const display = archetype.displayText ? archetype.displayText(parsed) : input.headline;
  const resolution: string[] = [];

  /*
   * ⚠ A THIRD OF THE BODY, NOT A HALF.
   *
   * `fitText` takes the LARGEST size that fits, so the bound handed to it is
   * what decides the headline's size — and through it, everything the diagram
   * has left. At 55% a three-line headline at 110px was legal, it ate 389px,
   * and every archetype with three rows of cells then failed to reach its own
   * label floor. The failure surfaced as "does not fit, break to a carousel",
   * which is a true sentence about a card whose real problem was upstream.
   *
   * A third leaves the content band about 700px, which is three cells with
   * their glosses, or five without. That is the shape of this product's cards.
   */
  const displayFit = fitText(display, "display", BODY.w, BODY.h * 0.34, TYPE.display);
  if (!displayFit) {
    throw new CompositionError(`${input.archetype}: the display line will not set above ${TYPE.display.min}px`);
  }

  /*
   * ⚠ THE DISPLAY IS SET FIRST, AND EVERYTHING ELSE IS CAPPED AT A THIRD OF
   * IT. That order is the rule "display ≥ 3 × the smallest thing on the card",
   * and it is the only order in which the rule is enforceable rather than
   * merely checkable afterwards.
   */
  const secondaryMax = Math.floor(displayFit.size / TYPE.minDisplayRatio);

  const eyebrow = bandText("eyebrow", EYEBROW, input.eyebrow, input.palette, secondaryMax);
  const footer = bandText("footer", FOOTER, input.footer, input.palette, secondaryMax);
  if (!eyebrow || !footer) {
    throw new CompositionError(
      `${input.archetype}: eyebrow or footer will not set between its floor and ${secondaryMax}px`
    );
  }

  const split = splitBody(BODY, displayFit.height);
  const displayBlock: Placed = {
    role: "text",
    band: "headline",
    box: { ...split.headline, h: displayFit.height },
    lines: linesFrom(displayFit, BODY.x, BODY.y, BODY.w, "display", 500, input.palette.ink, "start"),
  };

  // ── STEPS 1 AND 2, in order ─────────────────────────────────────────────
  for (const [pass, payload] of [
    ["full", parsed] as const,
    ["glossless", archetype.parse(withoutGlosses(input.payload))] as const,
  ]) {
    if (payload === null) continue;
    if (pass === "glossless") resolution.push("cut words: glosses dropped");

    for (const figureScale of FIGURE_SCALES) {
      const content = archetype.compose({
        payload,
        palette: input.palette,
        content: split.content,
        figureScale,
        secondaryMax,
      });
      if (content === null) continue;

      const placed = [eyebrow, displayBlock, ...content, footer];
      if (violations(placed).length > 0) continue;

      if (figureScale < 1) resolution.push(`illustration shrunk to ${figureScale}`);

      const composition: Composition = {
        archetype: input.archetype,
        paletteKey: input.palette.key,
        placed,
        overflowedToCarousel: false,
        resolution,
      };
      return {
        svg: toSvg(composition, input.palette.paper),
        composition,
        smallestSize: smallest(placed),
      };
    }
  }

  // ── STEP 3 ──────────────────────────────────────────────────────────────
  // Nothing was set below a floor to get here, and nothing will be. The caller
  // is told to break to a carousel, which is the last step and the only one
  // left.
  throw new CompositionError(
    `${input.archetype}: does not fit one card at the typographic floors — break to a carousel`
  );
}

/** The smallest type size on the card. The display/smallest ratio is checked against it. */
export function smallest(placed: Placed[]): number {
  let min = Infinity;
  for (const p of placed) {
    if (p.role !== "text") continue;
    for (const l of p.lines) min = Math.min(min, l.size);
  }
  return min === Infinity ? 0 : min;
}

/**
 * A carousel, card by card.
 *
 * Each card goes through `render` on its own archetype, which means each card
 * gets the same floors, the same clearances and the same resolver. A carousel
 * is more cards, not weaker cards.
 */
export function renderCarousel(input: RenderInput): RenderResult[] {
  const archetype = ARCHETYPES.carousel;
  const parsed = archetype.parse(input.payload) as { cards: Array<{ archetype_key: string; payload: unknown }> } | null;
  if (!parsed) throw new CompositionError("carousel: payload does not parse");

  return parsed.cards.map((card, i) =>
    render({
      ...input,
      archetype: card.archetype_key,
      payload: card.payload,
      eyebrow: `${input.eyebrow} ${i + 1}/${parsed.cards.length}`,
    })
  );
}
