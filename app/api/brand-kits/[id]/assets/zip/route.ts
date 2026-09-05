import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, badRequest, notFound, readJson, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { loadAssetContext } from "@/lib/kit/asset-context";
import { getBrandAssetManifest, recordAssetDownload } from "@/lib/kit/asset-rpc";
import { ensureAssetRendered } from "@/lib/kit/render-asset";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/assets/zip — the asset library's "Download
 * selected (.zip)". A NEW bundle of exactly the requested keys, distinct
 * from `brand_kit_zip` (always everything) -- built at request time from
 * signed URLs the caller's own session already has read access to, never
 * proxied through `service_role`.
 *
 * Not a render itself: every entry it bundles is either already current or
 * gets rendered through the exact same path the per-key route uses
 * (`ensureAssetRendered`), so this route never reaches
 * `consume_generation_credit` either.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({ keys: z.array(z.string()).min(1).max(34) });

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/assets/zip">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { supabase, userId } = auth.session;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("Select at least one asset to download.");

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

  const byKey = new Map(manifest.data.map((entry) => [entry.key, entry]));
  const entries: { name: string; data: Buffer }[] = [];

  for (const key of parsed.data.keys) {
    const entry = byKey.get(key);
    if (!entry) continue;

    const result = await ensureAssetRendered(supabase, id, key, entry, assetContext);
    if (!result.ok) continue;

    const download = await supabase.storage.from("brand-assets").download(result.storagePath);
    if (download.error || !download.data) continue;

    const bytes = Buffer.from(await download.data.arrayBuffer());
    entries.push({ name: `${key}.${entry.kind}`, data: bytes });

    await recordAssetDownload(supabase, id, key, assetContext.fingerprint);
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "None of the selected files could be prepared." }, { status: 500 });
  }

  try {
    const { buildZip } = await import("@/lib/kit/render/zip");
    const zipBytes = buildZip(entries);
    track("asset_zip_downloaded", { key: "selection", size: zipBytes.byteLength, format: "zip" });
    return new NextResponse(new Uint8Array(zipBytes), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="brand-assets.zip"`,
      },
    });
  } catch (error) {
    return serverError("assets:zip-selection", error);
  }
}
