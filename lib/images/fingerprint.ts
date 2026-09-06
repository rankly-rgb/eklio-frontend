import { createHash } from "node:crypto";
import { IMAGE_PROMPT_VERSION } from "@/lib/images/config";

/*
 * ── THE IMAGE FINGERPRINT ───────────────────────────────────────────────
 *
 * A SECOND fingerprint, deliberately, and a NARROWER one.
 *
 * ⚠ `computeAssetFingerprint` (lib/kit/asset-fingerprint.ts) is untouched by
 * this file and must stay byte-identical. The two hash different things
 * because they answer different questions, and merging them would be wrong in
 * both directions: an asset fingerprint that moved when a specialty changed
 * would needlessly re-render thirty deterministic files, and an image
 * fingerprint that moved when a headline changed would spend money
 * re-photographing a room the headline was never in.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────
 *
 *   A FIELD BELONGS IN THIS HASH IF AND ONLY IF IT REACHES THE PROMPT.
 *
 * Both directions of that "if and only if" are failures, and neither one
 * announces itself:
 *
 *   hashed but not prompted — she is billed for a regeneration that produces
 *     a byte-identical photograph. Silent waste, and it looks like a feature
 *     ("her brand changed, so the image was remade") until someone reads the
 *     prompt and finds the field missing from it.
 *   prompted but not hashed — the stored photograph is served forever after
 *     the input that shaped it has moved. Silent staleness, and the product
 *     looks correct from every angle except the one that matters.
 *
 * `lib/images/__tests__/fingerprint.test.ts` tests both directions, field by
 * field, and fails if a new field is added to this type without being covered.
 *
 * Applying that invariant is what removed three fields that used to be here:
 * `direction.id` and `direction.name` (identifiers, never prose — no renderer
 * ever sent them) and `palette.accent` (the palette rule places five roles;
 * two accents in one frame make a composition rather than an identity). It
 * also removed `city` and `state`, whose regional light register was the
 * thing fighting the master's single directional light, and which
 * "An American interior" already covers.
 *
 * ── WHAT IS LEFT, AND WHY EACH ONE EARNS ITS PLACE ──────────────────────
 *
 *   toneKeywords  the mood clause. Her direction's own three words.
 *   palette       the five roles the palette rule places in objects.
 *   specialty     the object register — the one honest axis of variation
 *                 between one therapist's photographs and another's.
 *
 * Plus IMAGE_PROMPT_VERSION, which is the prompt builder's own output
 * changing.
 */

export type ImageFingerprintInput = {
  /** Her direction's three tone keywords — the prompt's mood clause. */
  toneKeywords: string[];
  palette: {
    primary: string;
    secondary: string;
    paper: string;
    light_neutral: string;
    dark_neutral: string;
  };
  /**
   * The practice's primary specialty, as a CATALOGUE ID (`self_esteem`), not
   * as the label she reads (`Self-esteem`). The id is stable, lowercase, and
   * free of the punctuation that made a label-keyed lookup miss silently.
   * Null when the brief named none, which photographs as the neutral register.
   */
  specialty: string | null;
};

/** Deterministic: same input, same output, regardless of key insertion order. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * SHA-256, lowercase hex — the same primitive and shape as every other
 * fingerprint in this repo, and what `brand_images_claim` validates against.
 * Deliberately not md5, which is what the reveal's palette hash uses; that
 * function belongs to the reveal and is not borrowed here.
 */
export function computeImageFingerprint(input: ImageFingerprintInput): string {
  /*
   * PROJECTED, not spread. A caller handing over a wider object -- a whole
   * kit, say -- must not silently widen what is hashed: that is exactly how
   * a headline would end up costing her a photograph. The three fields below
   * are the hash, and adding one here is a deliberate act that belongs with
   * an IMAGE_PROMPT_VERSION bump AND a matching change to the prompt, or it
   * breaks the invariant in this file's header.
   */
  const payload = stableStringify({
    toneKeywords: input.toneKeywords,
    palette: {
      primary: input.palette.primary,
      secondary: input.palette.secondary,
      paper: input.palette.paper,
      light_neutral: input.palette.light_neutral,
      dark_neutral: input.palette.dark_neutral,
    },
    specialty: input.specialty,
    promptVersion: IMAGE_PROMPT_VERSION,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
