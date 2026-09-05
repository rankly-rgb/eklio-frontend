import { IMAGE_SLOTS, type ImageSlot } from "@/lib/images/config";
import type { ImageFingerprintInput } from "@/lib/images/fingerprint";

/*
 * ── THE DERIVED PROMPT ──────────────────────────────────────────────────
 *
 * Every word sent to the model comes from this file or from a closed map in
 * it. NOTHING she types reaches the model: not the practice name, not the
 * headline, not her specialty label as she wrote it, not her city. There is
 * no free-text prompt anywhere in the paid space, and this is where that
 * rule is actually kept rather than merely stated.
 *
 * That is why `specialty` and `state` go through lookup tables below instead
 * of being interpolated. A specialty label is clinical language about her
 * clients; a photograph of a room has no business carrying it, and a string
 * that reaches an external API is a string that can be steered.
 *
 * ── THE FOUR ABSOLUTE EXCLUSIONS ────────────────────────────────────────
 *
 * No face. No person. No hands. No text. They are stated positively (an
 * EMPTY room, an UNOCCUPIED table) and then again as an explicit exclusion
 * list, because a generator that reads only one of the two still gets it
 * right. A refusal on these is a PROMPT defect: `brand_images` records it as
 * `moderated`, terminally, and never retries it.
 */

/** Every prompt ends with these, verbatim. Not configurable, not per-slot. */
const EXCLUSIONS = [
  "no people",
  "no faces",
  "no hands",
  "no body parts",
  "no text",
  "no lettering",
  "no numbers",
  "no logos",
  "no signage",
  "no watermarks",
  "no brand names",
];

/*
 * Specialty → a SETTING register, never the clinical word itself.
 *
 * The keys are lowercased catalogue labels; anything unmatched falls back to
 * the neutral register, which is also what a practice with no named specialty
 * gets. Adding a specialty to the catalogue without adding it here is safe by
 * construction: it photographs as the default room rather than as nothing.
 */
const SETTING_BY_SPECIALTY: Record<string, string> = {
  "couples therapy": "two armchairs angled slightly toward each other",
  "family therapy": "a low table with seating arranged loosely around it",
  "child therapy": "a low shelf of simple wooden objects beside a small rug",
  "trauma": "a deep armchair beside a window with a heavy curtain drawn half across",
  "anxiety": "an uncluttered chair beside a window with a long, calm view",
  "depression": "a chair in a room where the daylight is warm and even",
  "grief": "a quiet armchair beside a side table holding a single closed book",
  "adhd": "an orderly desk corner with everything squared away",
  "eating disorders": "a plain, calm seating corner with soft textiles",
  "substance use": "a steady armchair in a room with clear, open floor",
};

const DEFAULT_SETTING = "a single armchair beside a window";

/*
 * State → a LIGHT and LANDSCAPE register. The city is never sent: a named
 * city invites a recognisable landmark, and a landmark is a photograph of
 * somewhere that is not her practice.
 */
const REGION_BY_STATE: Record<string, string> = {
  WA: "pacific northwest", OR: "pacific northwest", AK: "pacific northwest",
  CA: "west coast", HI: "west coast",
  NV: "desert southwest", AZ: "desert southwest", NM: "desert southwest", UT: "desert southwest",
  CO: "mountain west", ID: "mountain west", MT: "mountain west", WY: "mountain west",
  TX: "south central", OK: "south central", AR: "south central", LA: "south central",
  ND: "upper midwest", SD: "upper midwest", MN: "upper midwest", WI: "upper midwest",
  NE: "midwest", KS: "midwest", IA: "midwest", MO: "midwest",
  IL: "midwest", IN: "midwest", MI: "midwest", OH: "midwest",
  FL: "southeast", GA: "southeast", AL: "southeast", MS: "southeast",
  SC: "southeast", NC: "southeast", TN: "southeast", KY: "southeast",
  VA: "mid-atlantic", WV: "mid-atlantic", MD: "mid-atlantic", DE: "mid-atlantic",
  PA: "mid-atlantic", NJ: "mid-atlantic", DC: "mid-atlantic",
  NY: "northeast", CT: "northeast", RI: "northeast", MA: "northeast",
  VT: "northeast", NH: "northeast", ME: "northeast",
};

const LIGHT_BY_REGION: Record<string, string> = {
  "pacific northwest": "soft overcast daylight, cool and diffuse",
  "west coast": "clear low afternoon light, warm and dry",
  "desert southwest": "bright dry light with long, defined shadows",
  "mountain west": "crisp high-altitude daylight, clean shadows",
  "south central": "warm hazy afternoon light",
  "upper midwest": "pale even winter daylight",
  "midwest": "plain even daylight, unremarkable and steady",
  "southeast": "humid golden light, softened at the edges",
  "mid-atlantic": "temperate daylight through a tall window",
  "northeast": "cool northern daylight, slightly grey",
};

const DEFAULT_LIGHT = "even, unremarkable natural daylight";

function settingFor(specialty: string | null): string {
  if (!specialty) return DEFAULT_SETTING;
  return SETTING_BY_SPECIALTY[specialty.trim().toLowerCase()] ?? DEFAULT_SETTING;
}

function lightFor(state: string | null): string {
  if (!state) return DEFAULT_LIGHT;
  const region = REGION_BY_STATE[state.trim().toUpperCase()];
  return region ? LIGHT_BY_REGION[region] : DEFAULT_LIGHT;
}

/**
 * Her three tone keywords, sanitized to a closed character class before they
 * are used. They are generated copy rather than typed copy, but they are
 * still the only part of this prompt that did not originate in this file —
 * so they get the narrowest possible gate rather than trust.
 */
function moodFrom(keywords: string[]): string {
  const clean = keywords
    .map((word) => word.toLowerCase().replace(/[^a-z-]/g, ""))
    .filter((word) => word.length > 1 && word.length <= 20)
    .slice(0, 3);
  return clean.length > 0 ? clean.join(", ") : "calm, plain, unhurried";
}

/**
 * The prompt for one slot. Deterministic: the same input always produces the
 * same string, which is what makes `computeImageFingerprint` meaningful.
 */
export function buildImagePrompt(slot: ImageSlot, input: ImageFingerprintInput): string {
  const config = IMAGE_SLOTS[slot];
  const { palette } = input;

  return [
    `A photograph for a therapy practice's brand. ${config.subject}.`,
    slot === "hero" ? `The room contains ${settingFor(input.specialty)}.` : "",
    `${config.composition}.`,
    `Lighting: ${lightFor(input.state)}.`,
    `Mood: ${moodFrom(input.direction.tone_keywords)}.`,
    `Colour grade the image toward this palette: ${palette.primary} as the dominant hue,`,
    `${palette.secondary} and ${palette.accent} as secondary notes,`,
    `${palette.paper} and ${palette.light_neutral} in the highlights,`,
    `${palette.dark_neutral} in the shadows.`,
    "Realistic photography, natural materials, nothing staged or stock-like.",
    "The room is empty and unoccupied.",
    `Strictly excluded: ${EXCLUSIONS.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exported for the guard test that every prompt carries every exclusion. */
export const PROMPT_EXCLUSIONS = EXCLUSIONS;
