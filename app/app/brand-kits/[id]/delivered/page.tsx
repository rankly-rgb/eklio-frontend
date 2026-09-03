import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit, markBrandKitDelivered } from "@/lib/data/brand-kit";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { siteSpecGet } from "@/lib/site/rpc";
import { DeliveryCeremony } from "@/components/delivery/delivery-ceremony";

/*
 * The delivery moment (Lot 2) — reachable exactly once per kit.
 *
 * Same ownership/entitlement/direction guards as the workspace page
 * (`app/app/brand-kits/[id]/page.tsx`), because everything this ceremony
 * shows (the real rendered assets, the real palette) needs exactly what
 * that page needs: a paid kit with a direction selected.
 *
 * `markBrandKitDelivered` is the actual gate on replay: it sets
 * `delivered_seen_at` the first time this loads and reports `firstView`.
 * Every later load — refresh, bookmark, back button, all included — gets
 * `firstView: false` and redirects straight to the workspace. No separate
 * "already seen" check needed before it: the RPC's own `where
 * delivered_seen_at is null` IS that check, atomically.
 */
export default async function DeliveredPage({
  params,
}: PageProps<"/app/brand-kits/[id]/delivered">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/delivered`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  if (!kit.selectedDirection) {
    redirect(`/app/brand-kits/${id}/reveal`);
  }

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(
      `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`
    );
  }

  const marked = await markBrandKitDelivered(supabase, id);
  if (!marked.ok || !marked.firstView) {
    redirect(`/app/brand-kits/${id}`);
  }

  // The ceremony needs the six real roles + two real fonts (`SitePreviewTokens`),
  // not `directions[].palette`'s five-field kit-generation-time shape — same
  // source `brand-kit-view.tsx`'s `canvasTokens` already uses. An entitled,
  // direction-selected kit's site spec is seeded by this point in every real
  // path (reveal -> select direction -> here); the one theoretical gap sends
  // her to the workspace instead of a ceremony with an approximated palette.
  const siteSpec = await siteSpecGet(supabase, id);
  if (!siteSpec.ok) {
    redirect(`/app/brand-kits/${id}`);
  }

  return (
    <DeliveryCeremony
      brandKitId={id}
      practiceName={kit.practiceName}
      direction={kit.selectedDirection}
      tokens={siteSpec.data.preview.tokens}
    />
  );
}
