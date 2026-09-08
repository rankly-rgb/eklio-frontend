import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadBrandKit, type BrandKit } from "@/lib/data/brand-kit";
import { loadLaunchProgress, type LaunchProgress } from "@/lib/data/checklist";
import { siteSpecGet } from "@/lib/site/rpc";
import { bookingUrlFrom, practiceDetailsFrom } from "@/lib/kit/launch-context";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";

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
};

export async function loadLaunchFlow(
  supabase: Client,
  brandKitId: string,
  userId: string
): Promise<LaunchFlow | null> {
  const kit = await loadBrandKit(supabase, brandKitId, userId);
  if (!kit) return null;

  const [progress, siteSpec] = await Promise.all([
    loadLaunchProgress(supabase, brandKitId),
    siteSpecGet(supabase, brandKitId).catch(() => null),
  ]);

  const spec = siteSpec && siteSpec.ok ? siteSpec.data.spec : null;

  return {
    kit,
    progress,
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
