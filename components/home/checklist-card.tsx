import { MonoLabel } from "@/components/ui/mono-label";
import { LaunchChecklist, type LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { LaunchProgress } from "@/lib/data/checklist";
import type { BrandKit } from "@/lib/data/brand-kit";

/*
 * "Your first week" (Écran 7) — the primary card, the home aggregate's slot
 * for the launch checklist. When every step is done or skipped it collapses
 * to one line (`LaunchChecklist` itself renders that state) — the home slot
 * this card fills goes to Monthly Presence's card from that point on
 * (Lot 8, not this lot).
 */
export function ChecklistCard({
  brandKit,
  progress,
}: {
  brandKit: BrandKit;
  progress: LaunchProgress;
}) {
  const context: LaunchStepContext = {
    practiceName: brandKit.practiceName,
    practitionerLine: brandKit.row.practitioner_line,
    aboutExcerpt: brandKit.selectedDirection?.about_excerpt ?? null,
    // Home doesn't carry the site spec (an extra RPC this frequent a read
    // shouldn't pay for) — the credential/location and booking-link detail
    // that need it show their "finish this in the site editor" fallback
    // here, and appear for real on the kit page's row, which already loads
    // the site spec for other cards.
    practiceDetails: null,
    bookingUrl: null,
    assetsHref: `/app/brand-kits/${brandKit.row.id}#kit-assets`,
    siteHref: `/app/brand-kits/${brandKit.row.id}/site`,
  };

  return (
    <section
      aria-labelledby="launch-checklist"
      className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
    >
      <MonoLabel tracking="16" as="h2" id="launch-checklist">
        Your first week
      </MonoLabel>

      <div className="mt-4">
        <LaunchChecklist brandKitId={brandKit.row.id} initial={progress} context={context} />
      </div>
    </section>
  );
}
