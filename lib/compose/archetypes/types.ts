import type { Box, Palette, Placed } from "@/lib/compose/types";

/**
 * What every archetype module exports.
 *
 * Four things, as the chantier asks: the shape of its payload (`parse`), the
 * illustration zone it requires (`illustrationZone`), its tint scheme
 * (`tintCount`) and its render function (`compose`).
 *
 * ⚠ `compose` RETURNS `null` RATHER THAN A SMALLER CARD. It is called by the
 * resolver at successively smaller figure scales; returning a composition that
 * broke a floor to fit would make the resolver's ordering — illustration, then
 * words, then carousel — a description of code that does something else.
 */
export type ArchetypeModule<P> = {
  key: string;
  illustrationZone: "none" | "content" | "content_center";
  /** How many distinct tints a full instance uses. Each part of a diagram gets its own. */
  tintCount: number;
  /** Structural parse. Mirrors `content_topic_payload_valid` in the database. */
  parse(payload: unknown): P | null;
  /** The display line, when the archetype supplies its own instead of taking the card's. */
  displayText?(payload: P): string;
  compose(ctx: Ctx<P>): Placed[] | null;
};

export type Ctx<P> = {
  payload: P;
  palette: Palette;
  /** The content band, already separated from the headline. */
  content: Box;
  /**
   * 1 at first call, then 0.9, 0.8 … as the resolver shrinks the illustration.
   * An archetype with no illustration ignores it entirely.
   */
  figureScale: number;
  /**
   * ⚠ THE CEILING FOR EVERYTHING THAT IS NOT THE DISPLAY LINE.
   *
   * The rule is "display ≥ 3 × the smallest thing on the card", and a rule
   * like that has exactly one honest implementation: the display is set
   * first, from the space available, and everything else is capped at a third
   * of it. Stated the other way round it is not a rule at all, it is a hope —
   * which is what it was until the floor suite measured a card at 2.89:1 and
   * the engine had no opinion about it.
   *
   * A cap below a band's own floor means the card cannot be composed. That is
   * a real refusal and the resolver treats it as one.
   */
  secondaryMax: number;
};

export type Item = { label: string; gloss: string };

/** The shared item parse, so eleven modules do not each have their own idea of one. */
export function parseItem(v: unknown): Item | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o.label !== "string" || typeof o.gloss !== "string") return null;
  return { label: o.label, gloss: o.gloss };
}

export function parseItems(v: unknown, min: number, max: number): Item[] | null {
  if (!Array.isArray(v) || v.length < min || v.length > max) return null;
  const items = v.map(parseItem);
  return items.every((i): i is Item => i !== null) ? items : null;
}
