import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { loadAssetContext } from "@/lib/kit/asset-context";
import { getBrandAssetManifest, type AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * The kit header's four state tiles (Lot 3) — real numbers, each from a
 * query that already exists, none of them a metric this product can't
 * measure.
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
  /** Same number today (one file per catalog key) -- kept as its own field for when sizes/formats add real multiplicity. */
  downloadableFileCount: number;
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
  const current = manifest.filter((entry) => entry.current);
  const currentKeys = new Set(current.map((entry) => entry.key));

  const { data: everRendered } = await supabase
    .from("brand_assets")
    .select("key")
    .eq("brand_kit_id", kit.row.id);

  const everKeys = new Set((everRendered ?? []).map((row) => row.key));
  const staleKeys = [...everKeys].filter((key) => !currentKeys.has(key));

  const lastUpdated = current.reduce<string | null>((max, entry) => {
    const createdAt = entry.asset?.created_at ?? null;
    if (!createdAt) return max;
    return !max || createdAt > max ? createdAt : max;
  }, null);

  return {
    currentCount: current.length,
    downloadableFileCount: current.length,
    lastUpdated,
    staleKeys,
    manifest,
  };
}
