import type { Band } from "@/lib/compose/constants-bands";

export type { Band };

/** A rectangle in canvas coordinates. Top-left origin, as SVG has. */
export type Box = { x: number; y: number; w: number; h: number };

/** One set line, already measured. */
export type Line = {
  text: string;
  /** Baseline-independent: `y` is the TOP of the em box, as boxes are. */
  box: Box;
  size: number;
  family: FontRole;
  weight: number;
  fill: string;
  anchor: "start" | "middle";
};

export type FontRole = "display" | "sans" | "mono";

/**
 * A placed element. `role` is what the collision test reads: a `text` box may
 * not come within `glyphToStroke` of a `figure`'s strokes, and two `field`s may
 * not come within `fieldToField` of each other.
 */
export type Placed =
  | { role: "text"; band: Band; box: Box; lines: Line[] }
  | { role: "field"; band: Band; box: Box; fill: string; radius: number }
  | { role: "figure"; band: Band; box: Box; strokes: Stroke[] };

/**
 * A drawn stroke, in canvas coordinates, with its own bounding box already
 * computed. The box is what the clearance test uses; `d` is what the SVG gets.
 *
 * ⚠ THE BOX IS COMPUTED BY WHOEVER DREW IT, not parsed back out of the path.
 * Parsing a path to find its extent means implementing bezier bounds, and a
 * bug there would make the collision test pass on cards that collide.
 */
export type Stroke = {
  kind: "path" | "circle" | "line" | "rect";
  d: string;
  box: Box;
  stroke: string;
  strokeWidth: number;
  fill: string;
};

/** What a palette gives a card. */
export type Palette = {
  key: string;
  /** The paper tone. Every card has one; a dark card's paper IS the dark tone. */
  paper: string;
  /** Two or three tints. Never more: a fourth is a second brand. */
  tints: string[];
  ink: string;
  /** Ink on a tinted field, which is not always the same as ink on paper. */
  inkOnTint: string;
  dark: boolean;
};

export type RenderInput = {
  archetype: string;
  payload: unknown;
  palette: Palette;
  eyebrow: string;
  headline: string;
  footer: string;
};

export type Composition = {
  archetype: string;
  paletteKey: string;
  placed: Placed[];
  /** Set when the resolver gave up on a single card and asked for a carousel. */
  overflowedToCarousel: boolean;
  /** What the resolver did, in order, so a caller can say why a card looks how it does. */
  resolution: string[];
};
