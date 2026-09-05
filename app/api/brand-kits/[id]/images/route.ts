import { NextResponse } from "next/server";
import { authenticate, notFound } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";

/*
 * GET /api/brand-kits/[id]/images — every slot, its state, and a signed URL
 * for the ones that are ready AND current.
 *
 * A read, so a GET: nothing here generates, uploads or spends. Its sibling
 * route is a POST because it may cost real money.
 *
 * A slot that is not an image carries `failure_reason`, because a gradient
 * must always be explainable — that is the whole point of the departure from
 * `direction_assets` recorded in this session's log.
 */
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/images">
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

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) return NextResponse.json({ images: [] });

  const fingerprint = computeImageFingerprint(context.input);
  const rows = await getBrandImages(supabase, id, fingerprint);

  const images = await Promise.all(
    rows.map(async (row) => {
      if (!row.current || !row.storage_path) {
        return { slot: row.slot, status: row.status, failureReason: row.failure_reason, url: null };
      }
      const signed = await supabase.storage
        .from("brand-assets")
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        slot: row.slot,
        status: row.status,
        failureReason: row.failure_reason,
        url: signed.data?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({ images });
}
