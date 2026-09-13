import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * The three things the Lovable prompt needs that the launch flow does not
 * already carry: her tone words, her wordmark, and which photographs exist.
 *
 * Read ONLY for `site_setup`. Every other step screen would be paying for a
 * fingerprint computation and an image read it never renders.
 */

type Client = SupabaseClient<Database>;

/** The wordmark keys the catalogue offers, best first. */
const WORDMARK_KEYS = ["wordmark_svg_dark", "wordmark_png_dark", "wordmark_svg_light"];

export type SiteSetupMaterial = {
  toneWords: string[];
  wordmark: { label: string; format: string } | null;
  /** Slot keys with a current, stored photograph — `hero`, `ambient_a`, … */
  imageSlots: string[];
};

export async function loadSiteSetupMaterial(
  supabase: Client,
  kit: BrandKit,
  manifest: AssetManifestEntry[]
): Promise<SiteSetupMaterial> {
  const wordmarkEntry =
    WORDMARK_KEYS.map((key) => manifest.find((entry) => entry.key === key && entry.current)).find(
      (entry): entry is AssetManifestEntry => Boolean(entry)
    ) ?? null;

  /*
   * The same read the home canvas uses for its photograph — context,
   * fingerprint, rows — kept to the slot names here because the prompt names
   * slots and does not display them.
   */
  let imageSlots: string[] = [];
  const context = await loadImageContext(supabase, kit);
  if (context.ok) {
    const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
    imageSlots = rows
      .filter((row) => row.current && row.storage_path)
      .map((row) => row.slot)
      .sort();
  }

  return {
    toneWords: kit.selectedDirection?.tone_keywords ?? [],
    wordmark: wordmarkEntry ? { label: wordmarkEntry.label, format: wordmarkEntry.kind } : null,
    imageSlots,
  };
}
