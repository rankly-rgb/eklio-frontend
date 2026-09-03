import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, notFound } from "@/lib/api/handler";
import {
  isBrandKitEntitled,
  lockedMessage,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { loadAssetContext } from "@/lib/kit/asset-context";
import { getBrandAssetManifest } from "@/lib/kit/asset-rpc";

/*
 * GET /api/brand-kits/[id]/assets — the full catalogue, marked with what's
 * already generated for this kit's CURRENT fingerprint. Listing only: it
 * never renders, uploads, or signs anything — Lot 3's "Your assets" section
 * calls this once to draw the list, then POSTs to
 * `/api/brand-kits/[id]/assets/[key]` per item, on demand, when someone
 * actually wants a file.
 *
 * Deliberately GET, unlike the per-key route's POST: this one has no side
 * effect, so it's cacheable/prefetchable/safe-to-retry the ordinary way a
 * GET is.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/assets">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { supabase, userId } = auth.session;

  const kit = await loadBrandKit(supabase, id, userId);
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    return NextResponse.json(
      {
        error: lockedMessage(reversed),
        checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
      },
      { status: 402 }
    );
  }

  const assetContext = await loadAssetContext(supabase, kit);
  if (!assetContext.ok) {
    if (assetContext.reason === "no-direction") return notFound();
    return NextResponse.json(
      { error: "Your palette is still being set up. Try again in a moment." },
      { status: 409 }
    );
  }

  const manifest = await getBrandAssetManifest(supabase, id, assetContext.fingerprint);
  if (!manifest.ok) {
    return NextResponse.json({ error: manifest.error.message }, { status: 402 });
  }

  return NextResponse.json({ manifest: manifest.data });
}
