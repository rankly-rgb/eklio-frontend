import type { KitTier } from "@/lib/kit/tiers";

/*
 * ── THE TIER MAP ────────────────────────────────────────────────────────
 *
 * Which surface needs which tier. One row per surface, one file, and the
 * whole of the policy.
 *
 * ⚠ THE DISTRIBUTION IS THE OWNER'S, TAKEN ON 9 SEPTEMBER. Six rows sit above
 * `starter`; the other thirteen are `starter` because a 79 USD buyer is meant
 * to have them, not because nobody decided.
 *
 * Read it as three sentences. STARTER is a whole brand kit she can use: every
 * section, every file, the PDF, the archive, her own uploads, and the ethics
 * scan. PRACTICE adds the things that let her keep working on it — editing
 * the site specification, other sizes and formats of a file, seeing an asset
 * in place, and asking the model to fix what the scan found. SIGNATURE adds
 * the two that matter when someone else touches her brand: every past version
 * of a file, and the handoff sheet.
 *
 * This file is the whole of the policy. Raising or lowering a surface is one
 * word on one line; if it ever also needs a code edit somewhere, the guard has
 * been bypassed and that is the bug. `surface-access.test.ts` pins every row
 * and fails both if one moves and if a surface arrives without one.
 *
 * ⚠ THE AXIS IS SURFACE COVERED, NOT NUMBER OF REGENERATIONS. How many
 * regenerations a tier buys already lives in `plans.regenerations_limit`, in
 * the database, and it is a different question with a different answer. This
 * file only ever says "is this thing included".
 *
 * ⚠ THE 39 USD/MONTH SUBSCRIPTION IS NOT A TIER AND IS NOT IN THIS FILE.
 * `KIT_TIERS` are three ONE-TIME purchases recorded in `purchases`;
 * Monthly Presence is a recurring `subscriptions` row answered by
 * `isEntitledToMonthlyPresence`. A surface gated on the subscription asks that
 * function, not this one. Folding them together would make an expired card
 * look like a downgrade of a thing she bought outright.
 */

/**
 * Every surface a tier could gate.
 *
 * Named for what she sees, not for the route that renders it: two routes can
 * show one surface, and a route can move. `assets_sizes_and_formats` is one
 * entry rather than thirty-four because the decision is "may she re-render at
 * other sizes", not "may she have `favicon_32`" — per-key gating is what
 * `asset_catalog.min_tier` is for, and it reads its own column.
 */
export const SURFACES = [
  "kit_overview",
  "kit_identity",
  "kit_colors",
  "kit_type",
  "kit_site",
  "kit_words",
  "kit_assets",
  "site_editor",
  "assets_download",
  "assets_sizes_and_formats",
  "assets_version_history",
  "assets_in_situ",
  "brand_kit_pdf",
  "brand_kit_zip",
  "designer_handoff",
  "own_uploads",
  "ethics_check",
  "ethics_rewrite",
  "image_regeneration",
] as const;

export type Surface = (typeof SURFACES)[number];

/**
 * Surface → the lowest tier that includes it.
 *
 * ⚠ EDIT THIS TABLE, NOTHING ELSE. Changing what a tier contains is one word
 * per row here. If a change ever needs a code edit somewhere as well, the
 * guard has been bypassed and that is the bug.
 */
export const SURFACE_MIN_TIER: Record<Surface, KitTier> = {
  // ── Starter: the brand kit itself, whole and usable ──────────────────
  kit_overview: "starter",
  kit_identity: "starter",
  kit_colors: "starter",
  kit_type: "starter",
  kit_site: "starter",
  kit_words: "starter",
  kit_assets: "starter",
  assets_download: "starter",
  brand_kit_pdf: "starter",
  brand_kit_zip: "starter",
  ethics_check: "starter",
  image_regeneration: "starter",
  /*
   * ⚠ UPLOADS ARE A QUOTA QUESTION, NOT AN ACCESS ONE, and the quota is
   * global rather than per-tier today (`app_settings`: 10 MiB a file,
   * 50 MiB and 24 files a kit). Keeping her own portrait beside the
   * generated files is not a feature to withhold from someone who paid.
   */
  own_uploads: "starter",

  // ── Practice: continuing to work on it ───────────────────────────────
  site_editor: "practice",
  assets_sizes_and_formats: "practice",
  assets_in_situ: "practice",
  ethics_rewrite: "practice",

  // ── Signature: what matters when someone else touches her brand ──────
  assets_version_history: "signature",
  designer_handoff: "signature",
};

/** What each surface is called when the product has to name it to her. */
export const SURFACE_LABEL: Record<Surface, string> = {
  kit_overview: "Your brand kit",
  kit_identity: "Identity",
  kit_colors: "Colors",
  kit_type: "Type",
  kit_site: "Your site",
  kit_words: "Your words",
  kit_assets: "Your assets",
  site_editor: "The site editor",
  assets_download: "Downloading your files",
  assets_sizes_and_formats: "Other sizes and formats",
  assets_version_history: "Version history",
  assets_in_situ: "Seeing an asset in place",
  brand_kit_pdf: "Your brand kit as a PDF",
  brand_kit_zip: "Download everything",
  designer_handoff: "The designer handoff",
  own_uploads: "Your own files",
  ethics_check: "Check your words",
  ethics_rewrite: "Rewriting what Check found",
  image_regeneration: "New photographs",
};

export function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}
