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
  getBrandAssetPreviousInputs,
  getBrandAssetVersionPath,
  recordAssetDownload,
  recordBrandAsset,
  requestBrandAssetUpload,
} from "@/lib/kit/asset-rpc";
import { describeAssetChange } from "@/lib/kit/asset-change-summary";
import { getRenderer } from "@/lib/kit/render/registry";
import { renderVariant } from "@/lib/kit/render/variants";
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
  /*
   * `?size=` / `?format=` ask for one of the renditions the catalogue row
   * itself offers — a width she needs after the fact, or the same mark as a
   * vector. It is the SAME rendering, re-rasterized from the same source
   * under the SAME fingerprint, so it costs her nothing: no branch below
   * calls `consume_generation_credit`, and
   * `__tests__/download-is-never-a-generation.test.ts` fails if one ever
   * starts to. What's offered is decided by `asset_catalog`, and enforced
   * by the two RPCs — never by this route and never by the client, so an
   * edited URL cannot ask for a width nobody seeded.
   */
  const requestedSize = Number.parseInt(request.nextUrl.searchParams.get("size") ?? "", 10);
  const rendition = {
    size: Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : 0,
    format: request.nextUrl.searchParams.get("format") ?? "",
  };
  const isVariant = rendition.size !== 0 || rendition.format !== "";
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

  /*
   * `?version=` hands back an OLDER version of this asset — the file she
   * had before a colour moved. It is served from what was stored, never
   * re-rendered: the inputs that produced it are gone by definition, so
   * "re-render the old version" would silently produce the new one. No
   * stored row means no version, and that is a 404 like any other.
   *
   * This runs before the site spec is even loaded: an old version needs no
   * render context, and a request for one should not fail because the
   * current spec is mid-edit.
   */
  const requestedVersion = request.nextUrl.searchParams.get("version");
  if (requestedVersion) {
    const version = await getBrandAssetVersionPath(supabase, id, key, requestedVersion);
    if (!version.ok) {
      return version.error.code === "not_found"
        ? notFound()
        : NextResponse.json({ error: version.error.message }, { status: 402 });
    }
    const signed = await supabase.storage
      .from("brand-assets")
      .createSignedUrl(version.data.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data) {
      return serverError("assets:sign-version", signed.error);
    }
    if (isDownload) {
      await recordAssetDownload(supabase, id, key, requestedVersion);
      track("asset_downloaded", { key, version: requestedVersion });
    }
    return NextResponse.json({ url: signed.data.signedUrl });
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

  if (isVariant) {
    /*
     * The manifest holds one row per key — the native rendition — so a
     * variant's cache state is not in it. Asking the database for the path
     * first is what settles both questions at once: it refuses a size or
     * format the catalogue does not offer, and the path it returns is
     * either already an object (cached, under this same fingerprint) or
     * where the render is about to go.
     */
    const upload = await requestBrandAssetUpload(supabase, id, key, fingerprint, rendition);
    if (!upload.ok) {
      return NextResponse.json({ error: upload.error.message }, { status: 400 });
    }
    const stored = { size: upload.data.size, format: upload.data.format };

    const cached = await supabase.storage
      .from(upload.data.bucket)
      .createSignedUrl(upload.data.storage_path, SIGNED_URL_TTL_SECONDS);
    if (!cached.error && cached.data) {
      if (isDownload) {
        await recordAssetDownload(supabase, id, key, fingerprint, stored);
        track("asset_downloaded", { key, size: stored.size, format: stored.format || entry.kind });
      }
      return NextResponse.json({ url: cached.data.signedUrl });
    }

    let variant;
    try {
      // No key with variants reads `siteSetupMd` (only site_setup_md and
      // the zip do, and neither has a vector source), so the extra RPC that
      // fills it is skipped rather than paid for on every size she picks.
      variant = await renderVariant(key, { ...renderCtx, siteSetupMd: null }, stored);
    } catch (err) {
      return serverError("assets:render-variant", err);
    }
    // The catalogue offered a rendition this repo has no vector source for.
    // Seeded not to happen; a 404 rather than a 500 if it ever does.
    if (!variant) return notFound();

    const put = await supabase.storage
      .from(upload.data.bucket)
      .upload(upload.data.storage_path, variant.bytes, {
        contentType: variant.contentType,
        upsert: true,
      });
    if (put.error) {
      return serverError("assets:upload-variant", put.error);
    }

    const recorded = await recordBrandAsset(
      supabase,
      id,
      key,
      fingerprint,
      upload.data.storage_path,
      variant.bytes.byteLength,
      variant.width,
      variant.height,
      stored
    );
    if (!recorded.ok) {
      return NextResponse.json({ error: recorded.error.message }, { status: 400 });
    }

    const freshly = await supabase.storage
      .from(upload.data.bucket)
      .createSignedUrl(upload.data.storage_path, SIGNED_URL_TTL_SECONDS);
    if (freshly.error || !freshly.data) {
      return serverError("assets:sign-variant", freshly.error);
    }

    if (isDownload) {
      await recordAssetDownload(supabase, id, key, fingerprint, stored);
      track("asset_downloaded", { key, size: stored.size, format: stored.format || entry.kind });
    }
    return NextResponse.json({ url: freshly.data.signedUrl });
  }

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

  /*
   * THE REBUILD PATH — the one place that knows a new version is being
   * made, and therefore the only place that can say why. It reads the
   * inputs behind the version it is replacing and diffs them against the
   * ones this render was fingerprinted from; the sentence and the inputs
   * both go down with the row, so the NEXT rebuild has something to diff in
   * turn. A first render has nothing to compare against and gets an empty
   * summary, which the history shows as "Original".
   *
   * A failure here degrades to no summary rather than failing the render:
   * she asked for a file, not for an explanation.
   */
  const previous = await getBrandAssetPreviousInputs(supabase, id, key, fingerprint);
  const changeSummary = previous.ok
    ? describeAssetChange(previous.data.inputs, assetContext.fingerprintInputs)
    : "";

  const record = await recordBrandAsset(
    supabase,
    id,
    key,
    fingerprint,
    upload.data.storage_path,
    rendered.bytes.byteLength,
    rendered.width,
    rendered.height,
    undefined,
    { changeSummary, fingerprintInputs: assetContext.fingerprintInputs }
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
