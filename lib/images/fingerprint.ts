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
 * both directions: an asset fingerprint that moved when a city changed would
 * needlessly re-render thirty deterministic files, and an image fingerprint
 * that moved when a headline changed would spend $0.25 re-photographing a
 * room the headline was never in.
 *
 * ── WHAT IS HASHED, AND WHY IT IS EXACTLY THE PROMPT'S INPUTS ────────────
 *
 * The rule is not "everything about the kit". It is: hash exactly what
 * `buildImagePrompt` reads, and nothing else. Anything the prompt reads that
 * is NOT hashed would leave a stale image on screen; anything hashed that the
 * prompt does NOT read would throw away a good image for free.
 *
 *   direction          — id, name, tone keywords. The mood the photograph is
 *                        of. Not `rationale`, not `about_excerpt`: prose the
 *                        prompt never sees.
 *   the six colour roles — the photograph is graded toward them.
 *   specialty          — chooses the setting register, through a closed map.
 *   city, state        — state chooses the light and landscape register.
 *   IMAGE_PROMPT_VERSION — the prompt builder's own output changing.
 *
 * NOT the practice name. NOT the headline or overline. NOT any copy, any
 * font, any social template, any credential line. None of it reaches the
 * prompt, and none of it should cost her an image when she edits it.
 *
 * (One deliberate asymmetry, named rather than hidden: `city` is hashed but
 * the prompt uses only `state`. A move within the same state therefore
 * invalidates an image whose prompt would be identical. That is the brief's
 * specified input list, kept as specified; it costs one regeneration in a
 * rare case, and the alternative — silently dropping an input the owner
 * named — is worse.)
 */

export type ImageFingerprintInput = {
  direction: {
    id: string;
    name: string;
    tone_keywords: string[];
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    paper: string;
    light_neutral: string;
    dark_neutral: string;
  };
  /** The practice's primary specialty label, or null when the brief named none. */
  specialty: string | null;
  city: string | null;
  state: string | null;
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
   * a headline would end up costing her a photograph. The five fields below
   * are the hash, and adding one here is a deliberate act that belongs with
   * an IMAGE_PROMPT_VERSION bump.
   */
  const payload = stableStringify({
    direction: {
      id: input.direction.id,
      name: input.direction.name,
      tone_keywords: input.direction.tone_keywords,
    },
    palette: {
      primary: input.palette.primary,
      secondary: input.palette.secondary,
      accent: input.palette.accent,
      paper: input.palette.paper,
      light_neutral: input.palette.light_neutral,
      dark_neutral: input.palette.dark_neutral,
    },
    specialty: input.specialty,
    city: input.city,
    state: input.state,
    promptVersion: IMAGE_PROMPT_VERSION,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
