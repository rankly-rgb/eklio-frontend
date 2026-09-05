import type { AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";

/*
 * ── WHAT CHANGED, IN ONE SENTENCE ───────────────────────────────────────
 *
 * `brand_assets` has always kept every version: a rebuild adds a row under
 * a new fingerprint rather than overwriting the old one. What it could not
 * say was WHY. This turns the two fingerprints' inputs into the sentence
 * that goes beside the new version in her history.
 *
 * ⚠ NOTHING HERE PARTICIPATES IN COMPUTING THE FINGERPRINT.
 * `computeAssetFingerprint` is the single definition of that hash and is
 * untouched by this file — a rebuild's summary is written FROM inputs that
 * were already recorded, never the other way round. If a future change
 * makes this file look like it needs to know how the hash is built, it
 * doesn't: it needs the inputs, which it is handed.
 *
 * Copy rules, per the design law: American English, no exclamation marks,
 * no invented numbers. The sentence names fields she recognizes from the
 * editor — "your primary color", not "tokens.primary".
 */

/** The label each hashed field wears in her history, without the leading "your". */
const LABELS: Record<string, string> = {
  "tokens.primary": "primary color",
  "tokens.secondary": "secondary color",
  "tokens.accent": "accent color",
  "tokens.paper": "paper color",
  "tokens.light_neutral": "light neutral",
  "tokens.dark_neutral": "dark neutral",
  "tokens.primary_text": "primary text color",
  "tokens.secondary_text": "secondary text color",
  "tokens.accent_text": "accent text color",
  "tokens.cta_ink": "button ink",
  "tokens.heading_font": "heading font",
  "tokens.body_font": "body font",
  practiceName: "practice name",
  hero: "headline",
  socialTemplates: "post templates",
  practitionerLine: "credential line",
  practiceDetails: "practice details",
  bookingUrl: "booking link",
};

/** Deterministic comparison for the fields hashed as a whole rather than field by field. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function get(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, input);
}

/**
 * Joins the labels the way a sentence does, and stops naming them past
 * three. A list of eleven colour roles is not more informative than
 * "and 8 others" — it is just longer, and she still has to look.
 */
function joinLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  if (labels.length === 3) return `${labels[0]}, ${labels[1]}, and ${labels[2]}`;
  const others = labels.length - 3;
  return `${labels[0]}, ${labels[1]}, ${labels[2]}, and ${others} ${others === 1 ? "other" : "others"}`;
}

/**
 * One sentence naming what moved between two versions, or `""` when there
 * is no previous version to compare against — a first render explains
 * nothing, and an empty summary is what the history renders as "Original".
 *
 * `previous` is whatever was recorded on the version being replaced, so it
 * can legitimately be an empty object (a row written before this column
 * existed). That reads the same as "we can't say", and says so plainly
 * rather than inventing a cause.
 */
export function describeAssetChange(
  previous: Partial<AssetFingerprintInput> | Record<string, unknown>,
  next: AssetFingerprintInput
): string {
  const before = previous as Record<string, unknown>;
  if (Object.keys(before).length === 0) return "";

  const changed = Object.keys(LABELS).filter(
    (path) => !sameValue(get(before, path), get(next as unknown as Record<string, unknown>, path))
  );

  if (changed.length === 0) {
    // The inputs are identical, so the fingerprint moved for the only other
    // reason it can: RENDERER_VERSION was bumped, or a renderer's output
    // changed under it. Named honestly rather than guessed at.
    return "Eklio's renderer was updated.";
  }

  return `Your ${joinLabels(changed.map((path) => LABELS[path]))} changed.`;
}
