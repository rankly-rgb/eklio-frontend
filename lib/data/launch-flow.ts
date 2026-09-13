import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadBrandKit, type BrandKit } from "@/lib/data/brand-kit";
import { loadLaunchProgress, type LaunchProgress } from "@/lib/data/checklist";
import { siteSpecGet } from "@/lib/site/rpc";
import { bookingUrlFrom, practiceDetailsFrom } from "@/lib/kit/launch-context";
import { loadAssetStats } from "@/lib/data/asset-stats";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { SpecPage } from "@/lib/site/types";

/*
 * Everything the guided launch flow needs, in one read.
 *
 * Both screens — the overview and one step — need the kit, the seven rows and
 * the site spec's two fields, and both need them to agree. Loading them
 * separately in each page would be two chances for the copy blocks on the step
 * screen to disagree with the progress on the overview.
 *
 * The site spec read is TOLERANT: a kit whose spec is not seeded yet still
 * gets the flow, with the steps that need a booking link or a credential
 * showing their honest "finish this in the site editor" fallback rather than
 * failing the page for a missing string.
 */

type Client = SupabaseClient<Database>;

export type LaunchFlow = {
  kit: BrandKit;
  progress: LaunchProgress;
  context: LaunchStepContext;
  /**
   * The asset catalogue as it stands for this kit — label, format, pixels and
   * whether each entry is current.
   *
   * ⚠ THE CATALOGUE DECIDES WHAT EXISTS. A step names the keys it needs; only
   * the ones actually in this manifest get a row. That is what keeps a step
   * screen from offering a download that would 404, and it is why the list is
   * read here rather than assumed from a constant.
   *
   * Empty when the manifest cannot be read — the step then shows its text and
   * its link, and no asset rows. Never a broken button.
   */
  manifest: AssetManifestEntry[];
  /**
   * The builder prompt the DATABASE produced for her spec, verbatim.
   *
   * It is already on the envelope `site_spec_get` returns, which this loader
   * already fetches — so carrying it costs nothing, and re-deriving it in
   * TypeScript would be the second generator this chantier refuses to write.
   * Null when the spec could not be read, or when her target emits a setup
   * sheet rather than a prompt (Squarespace, Wix, Webflow).
   */
  siteOutput: { kind: string; text: string } | null;
  /**
   * Her spec's own pages and sections, from the SAME envelope as `siteOutput`.
   *
   * The prompt's body already describes them in prose, but step 1 needs them as
   * DATA to see which sections arrived empty — a heading with nothing under it
   * is invisible in a paragraph and obvious in a field. Empty when the spec
   * could not be read.
   */
  sitePages: SpecPage[];
};

export async function loadLaunchFlow(
  supabase: Client,
  brandKitId: string,
  userId: string
): Promise<LaunchFlow | null> {
  const kit = await loadBrandKit(supabase, brandKitId, userId);
  if (!kit) return null;

  const [progress, siteSpec, assetStats] = await Promise.all([
    loadLaunchProgress(supabase, brandKitId),
    siteSpecGet(supabase, brandKitId).catch(() => null),
    loadAssetStats(supabase, kit).catch(() => null),
  ]);

  const spec = siteSpec && siteSpec.ok ? siteSpec.data.spec : null;
  const output =
    siteSpec && siteSpec.ok
      ? (siteSpec.data as { output?: { kind?: string; text?: string } }).output
      : null;

  return {
    kit,
    progress,
    manifest: assetStats?.manifest ?? [],
    siteOutput:
      output?.kind && typeof output.text === "string"
        ? { kind: output.kind, text: output.text }
        : null,
    sitePages: spec?.pages ?? [],
    context: {
      practiceName: kit.practiceName,
      practitionerLine: kit.row.practitioner_line,
      aboutExcerpt: kit.selectedDirection?.about_excerpt ?? null,
      practiceDetails: practiceDetailsFrom(spec),
      bookingUrl: bookingUrlFrom(spec),
      assetsHref: `/app/brand-kits/${brandKitId}/assets`,
      siteHref: `/app/brand-kits/${brandKitId}/site-editor`,
    },
  };
}
