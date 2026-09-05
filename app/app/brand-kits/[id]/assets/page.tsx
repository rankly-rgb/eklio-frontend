import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadAssetStats } from "@/lib/data/asset-stats";
import { AssetLibraryView } from "@/components/kit/asset-library-view";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { track } from "@/lib/analytics";

/*
 * /app/brand-kits/[id]/assets — the asset library (Lot 4). A route, not a
 * section: filter, sort, view mode, selection, and the open detail panel
 * all belong in the URL (?group=&sort=&view=&asset=&keys=&status=), which
 * a scroll position on the kit page can't carry.
 */
export default async function AssetLibraryPage({
  params,
}: PageProps<"/app/brand-kits/[id]/assets">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/assets`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const stats = await loadAssetStats(supabase, kit);
  track("asset_library_opened", { brandKitId: id });

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb
        items={[
          { label: kit.practiceName ?? "Your brand", href: `/app/brand-kits/${id}` },
          { label: "All assets" },
        ]}
      />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        All assets
      </h1>

      {stats ? (
        <AssetLibraryView brandKitId={id} manifest={stats.manifest} staleKeys={stats.staleKeys} />
      ) : (
        <p className="mt-8 text-body text-ink-2">
          Your palette is still being set up. This page fills in as soon as it&rsquo;s ready.
        </p>
      )}
    </main>
  );
}
