/*
 * ── REGENERATION IS FOUR BUTTONS, NEVER A TEXT FIELD ────────────────────
 *
 * There is no free-text prompt anywhere in the paid space. When a photograph
 * is not quite right, she does not describe what she wants — she picks one of
 * four bounded nudges, and the prompt is rebuilt from the same closed
 * vocabulary as the first attempt with one extra sentence appended.
 *
 * That is not a limitation dressed up as a feature. A free-text field would
 * be a channel from her keyboard to an external model, in a product that has
 * spent this entire chantier keeping her words out of one — and it would be
 * the one place the four absolute exclusions could be argued with.
 *
 * ⚠ A VARIATION NAMES NO LIGHT. Same rule as the registers and the briefs:
 * "Lighter" is about EXPOSURE OF THE FRAME, which the master already fixes,
 * so it is expressed as more of the wall and less shadow — an amount, not a
 * new light. `__tests__/variations.test.ts` holds that.
 */

export const IMAGE_VARIATIONS = ["lighter", "warmer", "fewer_objects", "different_framing"] as const;

export type ImageVariation = (typeof IMAGE_VARIATIONS)[number];

export function isImageVariation(value: string): value is ImageVariation {
  return (IMAGE_VARIATIONS as readonly string[]).includes(value);
}

/** What she reads on the button. American English, no exclamation marks. */
export const VARIATION_LABEL: Record<ImageVariation, string> = {
  lighter: "Lighter",
  warmer: "Warmer",
  fewer_objects: "Fewer objects",
  different_framing: "Different framing",
};

/**
 * The sentence appended to the prompt. Closed vocabulary, one per variation,
 * and never anything she typed.
 */
export const VARIATION_CLAUSE: Record<ImageVariation, string> = {
  lighter:
    "Open the frame up: more of the pale plaster wall, less of the frame in deep tone, the whole image airier than a first read would suggest.",
  warmer:
    "Push the whole set toward the warm end of her palette: more of the wood and the clay tones, less of the cool neutral.",
  fewer_objects:
    "Take objects away rather than adding them: one fewer piece in the arrangement, more empty surface, the composition quieter.",
  different_framing:
    "Frame the same set differently: step back, change the angle of approach, and let the objects sit elsewhere in the frame than the obvious place.",
};

/** The clause for a variation, or "" for a first generation. */
export function variationClause(variation: ImageVariation | null): string {
  return variation ? VARIATION_CLAUSE[variation] : "";
}

/**
 * How many regenerations of THIS slot her remaining budget still buys.
 *
 * Divided by the price of the slot she is looking at, never by an average: a
 * hero regeneration costs five times a texture, and "3 left" on two adjacent
 * screens would otherwise mean two different things.
 */
export function regenerationsRemaining(remainingCents: number, slotPriceCents: number): number {
  if (slotPriceCents <= 0) return 0;
  return Math.max(0, Math.floor(remainingCents / slotPriceCents));
}
