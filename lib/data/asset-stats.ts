import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { loadAssetContext } from "@/lib/kit/asset-context";
import { getBrandAssetManifest, type AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * The kit band's counts — real numbers, each from a query that already
 * exists, none of them a metric this product can't measure.
 *
 * The band showed FOUR tiles before the section split, two of which
 * (`Brand assets` and `Downloadable files`) were the same number by
 * construction: one file per catalogue key. Two tiles carrying the same
 * count is one tile and a decoration, so there is now one — `Total assets` —
 * beside two that say something it does not.
 *
 * "Needs rebuilding" is NOT `!entry.current` on its own: that's also true
 * of a catalog key that has never been rendered at all, which isn't stale,
 * it's just unstarted — not the same thing, and not what "N assets need
 * rebuilding" should alarm her about. A key needs a REBUILD only if it was
 * rendered before, under a fingerprint that no longer matches: present in
 * `brand_assets` at all, but not among the manifest's `current` rows.
 */

export type AssetStats = {
  /** Rendered and up to date under the kit's current fingerprint. */
  currentCount: number;
  /**
   * How many distinct catalogue groups those current assets fall into.
   *
   * Derived from the SAME rows as `currentCount`, never from the length of a
   * hard-coded group list: a constant would keep saying six on a kit whose
   * palette has only ever produced four.
   */
  categoryCount: number;
  /** ISO timestamp of the most recently rendered current asset, or null if none exist yet. */
  lastUpdated: string | null;
  /** Rendered before, but stale under the current fingerprint. */
  staleKeys: string[];
  manifest: AssetManifestEntry[];
};

export async function loadAssetStats(
  supabase: SupabaseClient<Database>,
  kit: BrandKit
): Promise<AssetStats | null> {
  const assetContext = await loadAssetContext(supabase, kit);
  if (!assetContext.ok) return null;

  const manifestResult = await getBrandAssetManifest(supabase, kit.row.id, assetContext.fingerprint);
  if (!manifestResult.ok) return null;

  const manifest = manifestResult.data;
  const currentKeys = new Set(manifest.filter((entry) => entry.current).map((entry) => entry.key));

  const { data: everRendered } = await supabase
    .from("brand_assets")
    .select("key")
    .eq("brand_kit_id", kit.row.id);

  const everKeys = new Set((everRendered ?? []).map((row) => row.key));

  return {
    ...summarizeManifest(manifest),
    staleKeys: [...everKeys].filter((key) => !currentKeys.has(key)),
    manifest,
  };
}

/**
 * The three counts the band shows, from the manifest and nothing else.
 *
 * Pulled out as a pure function so the numbers can be tested without a
 * database — and so there is one place to read when asking "where does that
 * figure come from", which is the question this product keeps having to be
 * able to answer.
 */
export function summarizeManifest(manifest: AssetManifestEntry[]): {
  currentCount: number;
  categoryCount: number;
  lastUpdated: string | null;
} {
  const current = manifest.filter((entry) => entry.current);

  return {
    currentCount: current.length,
    categoryCount: new Set(current.map((entry) => entry.group)).size,
    lastUpdated: current.reduce<string | null>((max, entry) => {
      const createdAt = entry.asset?.created_at ?? null;
      if (!createdAt) return max;
      return !max || createdAt > max ? createdAt : max;
    }, null),
  };
}
