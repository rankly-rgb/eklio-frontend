import type { KitTier } from "@/lib/kit/tiers";

/*
 * ── THE TIER MAP ────────────────────────────────────────────────────────
 *
 * Which surface needs which tier. One row per surface, one file, and the
 * whole of the policy.
 *
 * ⚠ EVERY ROW IS `starter`, AND THAT IS A DECISION, NOT AN OVERSIGHT.
 *
 * `min_tier` has been seeded across `asset_catalog` since 3 September and
 * enforced nowhere: all 35 catalogue rows say `starter`, and a 79 USD buyer
 * receives everything. Turning that into a real distribution is a product
 * decision about what each of three price points contains — it is not a
 * refactor, and it is not this lot's to invent.
 *
 * What this lot builds is the MECHANISM, with the permissive default written
 * down where it can be read and changed. Every surface already consults the
 * guard; raising one is editing one line here, not wiring a second chantier.
 *
 * This is deliberately NOT the permissive default this repo is otherwise full
 * of — the kind where a table has no policies and quietly returns everything.
 * It is an explicit value in a file, and `surface-access.test.ts` fails if a
 * surface is added without a row.
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
  kit_overview: "starter",
  kit_identity: "starter",
  kit_colors: "starter",
  kit_type: "starter",
  kit_site: "starter",
  kit_words: "starter",
  kit_assets: "starter",
  site_editor: "starter",
  assets_download: "starter",
  assets_sizes_and_formats: "starter",
  assets_version_history: "starter",
  assets_in_situ: "starter",
  brand_kit_pdf: "starter",
  brand_kit_zip: "starter",
  designer_handoff: "starter",
  own_uploads: "starter",
  ethics_check: "starter",
  ethics_rewrite: "starter",
  image_regeneration: "starter",
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
