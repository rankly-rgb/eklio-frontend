import { createHash } from "node:crypto";

/*
 * The asset fingerprint (Lot 4.1–4.3, brief §4.2) — one hash per kit,
 * covering everything that could change what any renderer in the catalogue
 * produces. Reused across every asset key for a kit at a point in time
 * (`brand_assets.fingerprint`, `asset_catalog` unique on
 * `(brand_kit_id, key, fingerprint)`).
 *
 * COMPUTED HERE, NOT IN POSTGRES. The renderer (satori/resvg) is
 * eklio-frontend's own code, and RENDERER_VERSION describes ITS output —
 * duplicating this hash in SQL to "verify" what the frontend already
 * computed would be a second implementation that can drift from the first.
 * The three RPCs (`get_brand_asset_manifest`, `request_brand_asset_upload`,
 * `record_brand_asset`) accept this value as opaque and validate only its
 * shape — see FRONTEND_CONTRACT.md §10.4 (eklio-backend).
 *
 * WHAT'S HASHED, AND WHY IT'S SMALLER THAN THE BRIEF'S FULL LIST. An earlier
 * draft of this chantier's brief named the six colour roles, four derived
 * variants, both font families, practice_name, hero copy, "the licence label
 * and number", city/state, and the social template set as inputs. This first
 * version hashes only what Lot 4.1–4.3's one renderer (wordmark_svg_dark)
 * actually reads: the tokens, both font families, and practice_name — hashing
 * a field no renderer consumes yet would be speculative, not correctness.
 * Extend `AssetFingerprintInput` (and this comment) the same lot that adds a
 * renderer reading hero copy, licence/city/state, or the template set. Two
 * more notes for whoever does: `license_number` does not exist anywhere in
 * this schema — only `license_types.label` (a short credential abbreviation,
 * e.g. "LCSW") does; and RENDERER_VERSION already covers "the renderer's
 * output changed", so a new field only needs to be added here once some
 * renderer's OUTPUT actually varies with it.
 */

/**
 * Bump this by hand whenever a renderer's output changes for inputs that
 * would otherwise hash identically — a font-loading fix, a layout change, a
 * satori/resvg version bump that alters pixels. Every asset's fingerprint
 * changes the next time anything in a kit is touched; a bump does not
 * retroactively invalidate assets already rendered under the old value
 * (`brand_assets` rows are content-addressed by fingerprint, not superseded
 * in place), so a bump alone does not force a re-render — the kit's other
 * inputs still have to change too, or a caller has to force one.
 */
export const RENDERER_VERSION = 1;

export type AssetFingerprintInput = {
  tokens: {
    primary: string;
    secondary: string;
    accent: string;
    paper: string;
    light_neutral: string;
    dark_neutral: string;
    primary_text: string;
    secondary_text: string;
    accent_text: string;
    cta_ink: string;
    heading_font: string;
    body_font: string;
  };
  practiceName: string | null;
};

/** Deterministic: same input, same output, regardless of key insertion order. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The single, shared "what would any asset in this catalogue look like" hash. */
export function computeAssetFingerprint(input: AssetFingerprintInput): string {
  const payload = stableStringify({ ...input, rendererVersion: RENDERER_VERSION });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
