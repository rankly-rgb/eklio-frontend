import { NextResponse } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { contentResponse } from "@/lib/content/respond";
import { getPublishingLog } from "@/lib/data/content";

/*
 * GET /api/brand-kits/[id]/publishing-log — what she has actually posted.
 *
 * The log is append-only in the database and no client can write to it, so
 * this route only reads. Each entry is a real event, not a status field
 * re-read: un-posting leaves its own line rather than erasing the first one.
 */
export const runtime = "nodejs";

const MAX_ENTRIES = 100;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/publishing-log">
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

  const requested = Number(new URL(request.url).searchParams.get("limit") ?? MAX_ENTRIES);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_ENTRIES)
    : MAX_ENTRIES;

  try {
    return contentResponse(await getPublishingLog(supabase, id, limit));
  } catch (error) {
    return serverError("GET /api/brand-kits/[id]/publishing-log", error);
  }
}
