import { NextResponse } from "next/server";
import { authenticate, notFound } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { getBrandAssetVersions } from "@/lib/kit/asset-rpc";

/*
 * GET /api/brand-kits/[id]/assets/[key]/versions — every version of one
 * asset, newest first, each with the sentence explaining what changed to
 * produce it.
 *
 * A read, so a GET: nothing here renders, uploads or records. Its sibling
 * route (`../route.ts`) is a POST because it may have to render first; this
 * one only ever reads rows the rebuild path already wrote.
 *
 * Another therapist's kit answers 404, never 403 — `loadBrandKit` scopes to
 * the caller and returns null for anything else, so a kit that exists and a
 * kit that does not are indistinguishable from outside.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/assets/[key]/versions">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id, key } = await ctx.params;
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

  const versions = await getBrandAssetVersions(supabase, id, key);
  if (!versions.ok) {
    return NextResponse.json({ error: versions.error.message }, { status: 402 });
  }

  return NextResponse.json({ versions: versions.data });
}
