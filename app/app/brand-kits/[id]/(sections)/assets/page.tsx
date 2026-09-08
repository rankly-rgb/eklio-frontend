import { requireKitPage } from "@/lib/data/kit-page";
import { SectionHeader } from "@/components/ui/section-header";
import { AssetLibraryView } from "@/components/kit/asset-library-view";
import { track } from "@/lib/analytics";

/*
 * Your assets — the library, relocated.
 *
 * It was already a route and it stays one: filter, sort, view mode,
 * selection and the open detail panel all belong in the URL
 * (?group=&sort=&view=&asset=&keys=&status=), which is exactly why it could
 * never have been a scroll position on a single page. What changed is that
 * it now renders inside the kit's shell instead of behind a breadcrumb, so
 * the library is a section of her kit rather than a place she leaves it for.
 *
 * ⚠ NO SECOND QUERY. The manifest comes from `requireKitPage`, which the
 * header band already needed for its counts — this route reads the same
 * cached aggregate rather than calling `loadAssetStats` again. The library's
 * own group counts are then derived from that same array, in the component,
 * which is what keeps a chip's number and its grid from ever disagreeing.
 */
export default async function KitAssetsPage({
  params,
}: PageProps<"/app/brand-kits/[id]/assets">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  track("asset_library_opened", { brandKitId: id });

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Your assets" id="kit-assets-heading" />

      {model.assetStats ? (
        <AssetLibraryView
          brandKitId={id}
          manifest={model.assetStats.manifest}
          staleKeys={model.assetStats.staleKeys}
          practiceName={model.kit.practiceName ?? "Your practice"}
        />
      ) : (
        <p className="text-body text-ink-2">
          Your palette is still being set up. This section fills in as soon as
          it&rsquo;s ready.
        </p>
      )}
    </section>
  );
}
