import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import {
  isBrandKitEntitled,
  lockedMessage,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { siteOutputGet } from "@/lib/site/rpc";
import { loadAssetContext } from "@/lib/kit/asset-context";
import {
  getBrandAssetManifest,
  recordAssetDownload,
  recordBrandAsset,
  requestBrandAssetUpload,
} from "@/lib/kit/asset-rpc";
import { getRenderer } from "@/lib/kit/render/registry";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/assets/[key] — ensure one rendered brand asset
 * is current, then hand back a short-lived signed download URL.
 *
 * The round trip this route exists to prove (brief §4.3): manifest lookup →
 * render (if the current fingerprint has no row yet) → the validated path
 * from `request_brand_asset_upload` → upload with the caller's own session
 * (the storage.objects RLS policies are what authorize it, not this route —
 * see FRONTEND_CONTRACT.md §10, eklio-backend) → `record_brand_asset` →
 * `createSignedUrl` for the download. Every write here goes through the
 * caller's own session client — never `createAdminClient` — so a bug that
 * bypassed one of these checks would fail the same way a hand-crafted
 * request would, not open a wider door.
 *
 * `satori`/`@resvg/resvg-js` are native/Node-only: `runtime = "nodejs"` is
 * load-bearing, not decorative — see
 * `__tests__/renderer-not-in-client-bundle.test.ts` for the assertion that
 * neither package reaches a client bundle.
 */
export const runtime = "nodejs";
/*
 * Measured, not guessed — a real cold-cache run against the live Google
 * Fonts endpoint, in this environment, timed end to end (see the commit
 * this landed in for the exact numbers): CSS + ttf fetch ~160ms, satori
 * render ~50ms, first resvg rasterize (native-binary/fontdb init cost, the
 * expensive part) ~385ms — total ~600ms for the render itself. Add a
 * Supabase Storage upload and the three RPC round trips and cold total is
 * well under 5s locally.
 *
 * That ~385ms is a PER-LAMBDA-INSTANCE cost (native-binary/fontdb init),
 * not a per-request one — it recurs on every Vercel cold start, not on a
 * warm invocation reusing the same instance, and this sandbox's "cold" is
 * not the same as Vercel's: a real serverless cold start (container boot,
 * native binary load from a fresh filesystem) is typically slower than a
 * process that already had the binary loaded once this run. 600ms
 * end-to-end here is not the worst case there. 15s keeps real headroom
 * over the local number without repeating the earlier pure guess of 30 —
 * replace with the actual observed number the first time this route is
 * hit cold on a deployed preview.
 */
export const maxDuration = 15;

const SIGNED_URL_TTL_SECONDS = 300;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/assets/[key]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id, key } = await ctx.params;
  /*
   * A thumbnail preview (the kit page's six-card grid, an in-situ frame)
   * calls this exact route to get a signed URL to DISPLAY an image -- that
   * is not her downloading it. Only a real "Download" affordance passes
   * `?intent=download`; anything else (including no param, matching every
   * caller before this lot) does not count.
   */
  const isDownload = request.nextUrl.searchParams.get("intent") === "download";
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

  const renderer = getRenderer(key);
  if (!renderer) return notFound();

  const assetContext = await loadAssetContext(supabase, kit);
  if (!assetContext.ok) {
    if (assetContext.reason === "no-direction") return notFound();
    return NextResponse.json(
      { error: "Your palette is still being set up. Try again in a moment." },
      { status: 409 }
    );
  }
  const { ctx: renderCtx, fingerprint } = assetContext;

  const manifest = await getBrandAssetManifest(supabase, id, fingerprint);
  if (!manifest.ok) {
    return NextResponse.json({ error: manifest.error.message }, { status: 402 });
  }
  const entry = manifest.data.find((e) => e.key === key);
  if (!entry) return notFound();

  if (entry.current && entry.asset) {
    const signed = await supabase.storage
      .from("brand-assets")
      .createSignedUrl(entry.asset.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data) {
      return serverError("assets:sign-existing", signed.error);
    }
    if (isDownload) {
      await recordAssetDownload(supabase, id, key, fingerprint);
      track(key === "brand_kit_zip" ? "asset_zip_downloaded" : "asset_downloaded", {
        key,
        size: entry.asset.byte_size,
        format: entry.kind,
      });
    }
    return NextResponse.json({ url: signed.data.signedUrl });
  }

  // Only site_setup_md and the zip that bundles it need the derived `md`
  // output — an extra RPC call every other asset request has no reason to
  // pay for. A fetch failure here degrades to null rather than failing the
  // whole request: brand_kit_zip still ships everything else it has (see
  // its renderer), and site_setup_md alone throws a clear error below.
  let siteSetupMd: string | null = null;
  if (key === "site_setup_md" || key === "brand_kit_zip") {
    const output = await siteOutputGet(supabase, id, assetContext.target, "md");
    siteSetupMd = output.ok && typeof output.data === "string" ? output.data : null;
  }

  let rendered;
  try {
    rendered = await renderer({ ...renderCtx, siteSetupMd });
  } catch (err) {
    return serverError("assets:render", err);
  }

  const upload = await requestBrandAssetUpload(supabase, id, key, fingerprint);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error.message }, { status: 400 });
  }

  const put = await supabase.storage
    .from(upload.data.bucket)
    .upload(upload.data.storage_path, rendered.bytes, {
      contentType: rendered.contentType,
      upsert: true,
    });
  if (put.error) {
    return serverError("assets:upload", put.error);
  }

  const record = await recordBrandAsset(
    supabase,
    id,
    key,
    fingerprint,
    upload.data.storage_path,
    rendered.bytes.byteLength,
    rendered.width,
    rendered.height
  );
  if (!record.ok) {
    return NextResponse.json({ error: record.error.message }, { status: 400 });
  }

  const signed = await supabase.storage
    .from("brand-assets")
    .createSignedUrl(upload.data.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data) {
    return serverError("assets:sign-new", signed.error);
  }

  if (isDownload) {
    await recordAssetDownload(supabase, id, key, fingerprint);
    track(key === "brand_kit_zip" ? "asset_zip_downloaded" : "asset_downloaded", {
      key,
      size: rendered.bytes.byteLength,
      format: rendered.contentType,
    });
  }
  return NextResponse.json({ url: signed.data.signedUrl });
}
