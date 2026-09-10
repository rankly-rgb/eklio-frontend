import { MASTER_DIRECTION, MASTER_EXCLUSIONS } from "@/lib/images/prompt";

/*
 * ── THE GROUND: ONE PHOTOGRAPH PER THEME, PER MONTH ─────────────────────
 *
 * Not one per post. Twelve posts a month at 5¢ a photograph would be 60¢ of a
 * 100¢ monthly allowance for pictures nobody asked to be different, and an
 * Instagram grid of twelve unrelated interiors reads as a stock library.
 * Three themes, three grounds, and the posts within a theme share theirs —
 * which is also what makes the month look like a month.
 *
 * A theme whose posts are all `notes` gets no ground at all: `notes` is
 * typographic, and a photograph under 472 characters of body copy is either
 * invisible or makes the copy unreadable. See `PHOTOGRAPHIC_ARCHETYPES`.
 *
 * ── WHY IT REUSES THE KIT'S MASTER DIRECTION ────────────────────────────
 *
 * These photographs appear on the same grid as her brand photography. A second
 * art direction, written here, would make her feed look like two brands. So
 * the master direction and the master exclusion sentence are IMPORTED from
 * `lib/images/prompt.ts` rather than restated — one edit changes both, and
 * they cannot drift.
 *
 * ⚠ NO FACE, NO PERSON, NO HANDS. This is ruled, and it is already the first
 * three items of the imported exclusion sentence. It is not restated here: a
 * second copy is a second thing to forget, and a test asserts the imported
 * sentence still carries all three rather than trusting this comment.
 */

export type GroundPromptInput = {
  theme: string;
  /** The specialty's object register, as the kit's own prompt builder resolves it. */
  subject: string;
  paletteLine: string;
  mood: string;
};

export function buildGroundPrompt(input: GroundPromptInput): string {
  return [
    MASTER_DIRECTION,
    /*
     * The theme enters as a SUBJECT for the photograph, never as a mood or a
     * grade. "Rest" must become a made bed in afternoon light, not a picture
     * tinted to feel restful — the same correction the kit's palette rule
     * already carries, applied to the theme.
     */
    `The photograph is about ${input.theme}, shown through objects and a room rather than ` +
      `through a mood: ${input.subject}. There is space in the frame, in the upper two thirds, ` +
      `where a line of text will be set over the image.`,
    input.paletteLine,
    `Mood: ${input.mood}.`,
    MASTER_EXCLUSIONS,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
