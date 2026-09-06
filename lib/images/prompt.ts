import { IMAGE_SLOTS, type ImageSlot } from "@/lib/images/config";
import type { ImageFingerprintInput } from "@/lib/images/fingerprint";
import { objectRegisterFor } from "@/lib/images/specialties";

/*
 * ── THE DERIVED PROMPT ──────────────────────────────────────────────────
 *
 * Every word sent to the model comes from this file, from the slot brief in
 * `config.ts`, or from her palette hexes. NOTHING she types reaches the
 * model: not the practice name, not the headline, not her specialty label as
 * she wrote it, not her city. There is no free-text prompt anywhere in the
 * paid space, and this is where that rule is actually kept rather than
 * merely stated.
 *
 * ── WHAT THE FIRST REAL GENERATION TAUGHT US ────────────────────────────
 *
 * The pipeline was right and the art direction was wrong. Four defects, and
 * the line of this file that caused each:
 *
 *   1. The whole frame sank into a brown cast, underexposed, nowhere near
 *      her warm off-white `paper`. Cause: "colour grade the image toward
 *      this palette", which tints everything instead of PLACING colour in
 *      objects. That instruction is gone, and `PALETTE_RULE` below ends with
 *      "Do not tint the image."
 *   2. The light contradicted itself — a grey overcast window under a warm
 *      grade, no direction, no cast shadow. Cause: a per-state light register
 *      fighting the grade. The master now fixes ONE light for every image:
 *      warm late-afternoon, upper left, directional enough to cast a shadow.
 *   3. The subject was a lone empty armchair — the most-used stock image in
 *      the therapy category, and it reads melancholy rather than calm. Cause:
 *      `DEFAULT_SETTING`, which every unmapped specialty fell through to.
 *      Furniture is never the subject now, and "no empty armchairs" is an
 *      explicit exclusion.
 *   4. The room was European: panel radiator, tilt-turn window. The audience
 *      is American therapists. The master says so in as many words.
 *
 * ── THE FOUR ABSOLUTE EXCLUSIONS, PLUS THE CATEGORY CLICHÉS ─────────────
 *
 * No face. No person. No hands. No text. Stated positively in the master
 * ("An American interior…", the objects named) and then again as an explicit
 * list, because a generator that reads only one of the two still gets it
 * right. The list now also refuses the therapy-stock vocabulary outright:
 * armchairs, couches, clipboards, lotus flowers, brains, puzzle pieces,
 * meditation imagery.
 *
 * A refusal on any of this is a PROMPT defect: `brand_images` records it as
 * `moderated`, terminally, and never retries it.
 */

/**
 * The master art direction, applied to every slot, ahead of the slot's own
 * brief. Supplied verbatim by the product owner after reviewing the first
 * real generation.
 */
const MASTER_DIRECTION =
  "Editorial interiors photograph for a therapist's brand identity, in the register of an " +
  "architecture or design magazine. Warm late-afternoon daylight entering from the upper left, " +
  "directional enough to cast a soft-edged shadow across a wall. Bright and airy: the plaster wall " +
  "is the lightest area of the frame, and deep shadow is confined to small pockets. Natural " +
  "materials with visible texture — lime plaster, linen, jute, matte ceramic, oiled wood, dried " +
  "botanicals. Fine film grain, gentle vignette, believable contact shadows, shallow depth of " +
  "field. An American interior: no wall-mounted panel radiators, no tilt-turn windows, no European " +
  "fittings. Calm, precise, expensive; unhurried rather than melancholy.";

/**
 * The exclusion sentence — the tail of the same verbatim master, kept as its
 * own constant only so it can be assembled LAST in the finished prompt,
 * after the slot brief and the palette. Every word is the owner's; the split
 * is positional, not editorial.
 */
const MASTER_EXCLUSIONS =
  "Strictly excluded: no people, no faces, no hands, no body parts, no text, no lettering, no " +
  "numbers, no logos, no signage, no watermarks, no brand names, no empty armchairs, no couches, " +
  "no clipboards, no lotus flowers, brains, puzzle pieces or meditation imagery, no pill bottles, " +
  "no scales, no food, no bottles, no journals opened to writing, nothing that depicts a condition.";

/**
 * Her palette, placed in OBJECTS. Never a grade.
 *
 * This is the fix for the defect that mattered most: the previous wording
 * ("colour grade the image toward this palette") tinted the entire frame
 * brown and buried her paper white. Colour belongs to things in the room.
 *
 * Six roles, each with a different AMOUNT of the frame, and no two asking for
 * the same amount. That is the correction the first wording missed: it read
 * "{secondary} as one small accent", which made secondary and accent compete
 * for the same job while secondary's real one — a second material presence —
 * went unsaid. In the six-role system secondary is "supporting headings and
 * surfaces" and accent is "small marks only", so photographically secondary
 * is a MATERIAL (a wood tone, a woven textile, a second ceramic) and accent
 * is ONE SMALL OBJECT (a book spine, a glaze, a stem).
 *
 * `accent` reaching the prompt is also what puts it back in the fingerprint:
 * the invariant in `fingerprint.ts` decides that, not a preference.
 */
function paletteRule(palette: ImageFingerprintInput["palette"]): string {
  return (
    "The palette appears in the objects and never as a grade over the image: " +
    `${palette.primary} once, on a single soft furnishing or ceramic; ` +
    `${palette.secondary} as a supporting material presence — a wood tone, a woven textile, a second ` +
    `ceramic — never the dominant surface; ` +
    `${palette.accent} on one small detail only — a book spine, a glaze, a stem — never a surface; ` +
    `${palette.paper} and ${palette.light_neutral} are the wall and the daylight and dominate the frame; ` +
    `${palette.dark_neutral} only in shadow. Do not tint the image.`
  );
}

/**
 * Her three tone keywords, sanitized to a closed character class before they
 * are used. They are generated copy rather than typed copy, but they are
 * still the only part of this prompt that did not originate in this file or
 * in `config.ts` — so they get the narrowest possible gate rather than trust.
 */
function moodFrom(keywords: string[]): string {
  const clean = keywords
    .map((word) => word.toLowerCase().replace(/[^a-z-]/g, ""))
    .filter((word) => word.length > 1 && word.length <= 20)
    .slice(0, 3);
  return clean.length > 0 ? clean.join(", ") : "calm, plain, unhurried";
}

/*
 * ── EVERY HASHED FIELD REACHES THIS FUNCTION, AND ONLY THOSE ────────────
 *
 * `toneKeywords` become the mood clause, the five palette roles are placed in
 * objects, and `specialty` chooses the object register. Nothing else is
 * hashed, and nothing else is sent — see the invariant in
 * `lib/images/fingerprint.ts`, which a test enforces in both directions.
 *
 * `city` and `state` are gone from both. The per-region light register they
 * drove was the thing fighting the master's single directional light, and
 * "An American interior" already covers what it was for.
 */

/**
 * The prompt for one slot. Deterministic: the same input always produces the
 * same string, which is what makes `computeImageFingerprint` meaningful.
 *
 * Order is load-bearing. The master sets the register before the slot brief
 * can be misread as the whole picture; the palette rule follows the objects
 * it applies to; the exclusions land last, where a long instruction is least
 * likely to be dropped.
 */
export function buildImagePrompt(
  slot: ImageSlot,
  input: ImageFingerprintInput,
  /*
   * A bounded regeneration nudge, appended after the slot brief. Deliberately
   * NOT part of `ImageFingerprintInput`, and so deliberately not hashed: a
   * variation is a one-off request for a DIFFERENT photograph of the same
   * brand, not a change to what the brand is. Hashing it would mean every
   * nudge minted a new permanent identity for the slot, and the row she ends
   * up with would stop matching her kit's fingerprint the moment she used one.
   */
  variationClause = ""
): string {
  // A slot brief carries `{subject}` wherever the specialty's object register
  // belongs. A brief without the token is unaffected -- the six disabled
  // slots keep their own subjects until step 8 rewrites them.
  const brief = IMAGE_SLOTS[slot].brief.replace("{subject}", objectRegisterFor(input.specialty));

  return [
    MASTER_DIRECTION,
    brief,
    variationClause,
    paletteRule(input.palette),
    `Mood: ${moodFrom(input.toneKeywords)}.`,
    MASTER_EXCLUSIONS,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The exclusions, as a list, DERIVED from the sentence the model actually
 * receives — so the guard test and the prompt cannot drift apart. Adding an
 * exclusion to `MASTER_EXCLUSIONS` extends the test automatically.
 */
export const PROMPT_EXCLUSIONS: string[] = MASTER_EXCLUSIONS.replace("Strictly excluded: ", "")
  .replace(/\.$/, "")
  .split(/,\s*|\s+or\s+/)
  .map((entry) => entry.trim())
  .filter(Boolean);
