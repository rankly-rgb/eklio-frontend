import Link from "next/link";
import { requireKitPage } from "@/lib/data/kit-page";
import { SectionHeader } from "@/components/ui/section-header";
import { PackageHeaderCard } from "@/components/kit/package-header-card";
import { LaunchProgressRow } from "@/components/kit/launch-progress-row";
import { AssetsPreview } from "@/components/kit/assets-preview";
import { DeleteKitSection } from "@/components/kit/delete-kit-section";
import { StateTile } from "@/components/kit/state-tile";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";

/*
 * Overview — the kit's front page, and an OVERVIEW rather than a hub: what
 * she bought, the state it is in, and the one week of work that turns it
 * into a practice people can find. The way to everything else is the rail,
 * not a grid of doors repeated here.
 */
export default async function KitOverviewPage({
  params,
}: PageProps<"/app/brand-kits/[id]">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  const launchContext: LaunchStepContext = {
    practiceName: model.kit.practiceName,
    practitionerLine: model.kit.row.practitioner_line,
    aboutExcerpt: model.kit.selectedDirection?.about_excerpt ?? null,
    practiceDetails: model.practiceDetails,
    bookingUrl: model.bookingUrl,
    assetsHref: `/app/brand-kits/${id}/assets`,
    siteHref: `/app/brand-kits/${id}/site-editor`,
  };

  const stale = model.assetStats?.staleKeys ?? [];

  return (
    <div className="flex flex-col gap-12">
      <PackageHeaderCard
        practiceName={model.kit.practiceName}
        tokens={model.tokens}
        colorLabels={model.colorLabels}
        practiceDetails={model.sitePracticeDetails}
        bookingUrl={model.bookingUrl}
        heroImageUrl={model.heroImageUrl}
        siteEditorHref={`/app/brand-kits/${id}/site-editor`}
      />

      {/*
       * The one state tile left after the counts moved into the band — the
       * only one that was never a count.
       *
       * ⚠ IT CAN SAY MORE THAN "UP TO DATE", which is what earns it its
       * place. `staleKeys` is non-empty whenever a file was rendered under a
       * fingerprint that is no longer current, and the fingerprint is a hash
       * of her thirteen colour and font tokens, her practice name, her hero
       * headline, her social templates, her practitioner line, her practice
       * details and her booking link — every one of which the site editor
       * lets her change. It is empty across production today only because no
       * kit has edited any of them yet.
       *
       * ⚠ AND IT NO LONGER SAYS SHE HAS WORK TO DO. "N assets need
       * rebuilding" read as a chore with no button: nothing here rebuilds
       * anything, and nothing needs to — `ensureAssetRendered` re-renders a
       * stale key the next time it is downloaded, at no cost to her and with
       * no credit consumed. The copy now names what is actually happening.
       */}
      <div className="max-w-[300px]">
        <StateTile label="Status">
          {stale.length > 0 ? (
            <Link
              href={`/app/brand-kits/${id}/assets?status=needs-rebuild`}
              className="text-ink underline decoration-[var(--accent)] underline-offset-4 hover:text-accent"
            >
              Your brand moved — {stale.length}{" "}
              {stale.length === 1 ? "file rebuilds" : "files rebuild"} next time
              you download {stale.length === 1 ? "it" : "them"}
            </Link>
          ) : (
            "Every file matches your brand as it stands now"
          )}
        </StateTile>
      </div>

      <LaunchProgressRow
        brandKitId={id}
        progress={model.launchProgress}
        context={launchContext}
      />

      <section className="flex flex-col gap-5">
        <SectionHeader title="Your assets" id="kit-assets-heading" />
        {model.assetStats ? (
          <AssetsPreview brandKitId={id} manifest={model.assetStats.manifest} />
        ) : (
          <p className="text-body text-ink-2">
            Your palette is still being set up. This section fills in as soon as
            it&rsquo;s ready.
          </p>
        )}
      </section>

      {model.kit.practiceName ? (
        <div id="kit-danger" className="max-w-[720px] scroll-mt-8 border-t border-line pt-6">
          <DeleteKitSection
            brandKitId={id}
            practiceName={model.kit.practiceName}
          />
        </div>
      ) : null}
    </div>
  );
}
