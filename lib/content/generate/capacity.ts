import type { ContentArchetype } from "@/lib/data/content";

/*
 * ── WHAT THE LAYOUT PHYSICALLY HOLDS ────────────────────────────────────
 *
 * These are not editorial preferences. They are MEASUREMENTS, produced by
 * `scripts/content/measure-archetype-capacity.ts`: real typefaces fetched from
 * Google, the real geometry of `lib/kit/render/social-posts.ts`, real English
 * sentences, binary-searched until satori's own laid-out height stopped fitting
 * the box the layout reserves.
 *
 * ⚠ FLOOR, NOT AVERAGE, AND NOT HER OWN PAIRING'S NUMBER.
 *
 * Capacity varies by 60% between typefaces — `cormorant_source` holds 234
 * characters in the `question` layout where `caslon_inter` holds 168, because
 * Cormorant Garamond is a narrow face. The generator does not get to choose her
 * typeface, and she may change it after the post exists. So it writes to the
 * SMALLEST capacity across all six pairings. A few characters cheaper, and a
 * typeface change can never overflow a post that has already been made.
 *
 * Re-run the script when a layout or a pairing changes and paste the new
 * numbers here. They are facts about a rendering, not constants someone chose.
 */
export const ARCHETYPE_FLOOR: Record<ContentArchetype, number> = {
  statement: 144,
  question: 168,
  signature: 195,
  story: 431,
  notes: 472,
};

/*
 * ── AND WHAT A HUMAN WILL ACTUALLY READ ─────────────────────────────────
 *
 * The floor is the ceiling of the box. It is not a target. A `notes` layout
 * holds 472 characters, and 472 characters of type on an Instagram tile is a
 * wall nobody reads at thumbnail size.
 *
 * Six to forty words is the ruled range for the line on the image, and it
 * binds every archetype. Where the two disagree the tighter one wins: a
 * `statement` may not run past 144 characters even at 20 words, and a `notes`
 * may not run past 40 words even though 472 characters would fit.
 */
export const ON_IMAGE_MIN_WORDS = 6;
export const ON_IMAGE_MAX_WORDS = 40;

/** Instagram's own limit, mirrored from the column's CHECK. */
export const CAPTION_MAX_CHARS = 2200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export type FitFailure =
  | { reason: "too_few_words"; words: number; min: number }
  | { reason: "too_many_words"; words: number; max: number }
  | { reason: "over_floor"; chars: number; floor: number };

/**
 * Whether a candidate line may be rendered in this archetype.
 *
 * Returns the failure rather than a boolean, because the failure is what goes
 * back to the model on the retry: "too long" produces a shorter line, "too
 * long by 38 characters for a statement" produces a usable one.
 */
export function checkOnImageFit(
  text: string,
  archetype: ContentArchetype
): FitFailure | null {
  const words = countWords(text);
  if (words < ON_IMAGE_MIN_WORDS) {
    return { reason: "too_few_words", words, min: ON_IMAGE_MIN_WORDS };
  }
  if (words > ON_IMAGE_MAX_WORDS) {
    return { reason: "too_many_words", words, max: ON_IMAGE_MAX_WORDS };
  }

  const floor = ARCHETYPE_FLOOR[archetype];
  if (text.trim().length > floor) {
    return { reason: "over_floor", chars: text.trim().length, floor };
  }
  return null;
}

/** The failure, said to the model in the words it needs to act on. */
export function describeFit(failure: FitFailure, archetype: ContentArchetype): string {
  switch (failure.reason) {
    case "too_few_words":
      return `That is ${failure.words} words. It needs at least ${failure.min}.`;
    case "too_many_words":
      return `That is ${failure.words} words. It needs at most ${failure.max}.`;
    case "over_floor":
      return (
        `That is ${failure.chars} characters. A ${archetype} layout holds ` +
        `${failure.floor} in the narrowest typeface this practice might use, ` +
        `so it must come in at or under ${failure.floor}. Cut ` +
        `${failure.chars - failure.floor} characters without adding a new idea.`
      );
  }
}
