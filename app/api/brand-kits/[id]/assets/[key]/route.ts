import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import {
  isBrandKitEntitled,
  lockedMessage,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { siteSpecGet } from "@/lib/site/rpc";
import { computeAssetFingerprint } from "@/lib/kit/asset-fingerprint";
import {
  getBrandAssetManifest,
  recordBrandAsset,
  requestBrandAssetUpload,
} from "@/lib/kit/asset-rpc";
import { getRenderer } from "@/lib/kit/render/registry";

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
 * well under 5s locally. That is NOT the same measurement as a cold
 * invocation on Vercel, which can carry its own lambda cold-start and
 * native-binary-load cost this environment can't reproduce — 15s keeps
 * meaningful headroom over the local number without just repeating the
 * earlier unmeasured guess. Replace with the actual observed number the
 * first time this route is hit cold on a deployed preview.
 */
export const maxDuration = 15;

const SIGNED_URL_TTL_SECONDS = 300;

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/assets/[key]">
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

  const renderer = getRenderer(key);
  if (!renderer) return notFound();

  if (!kit.selectedDirection) return notFound();

  const siteSpec = await siteSpecGet(supabase, id);
  if (!siteSpec.ok) {
    return NextResponse.json(
      { error: "Your palette is still being set up. Try again in a moment." },
      { status: 409 }
    );
  }
  const tokens = siteSpec.data.preview.tokens;

  const fingerprint = computeAssetFingerprint({
    tokens: {
      primary: tokens.primary,
      secondary: tokens.secondary,
      accent: tokens.accent,
      paper: tokens.paper,
      light_neutral: tokens.light_neutral,
      dark_neutral: tokens.dark_neutral,
      primary_text: tokens.primary_text,
      secondary_text: tokens.secondary_text,
      accent_text: tokens.accent_text,
      cta_ink: tokens.cta_ink,
      heading_font: tokens.heading_font,
      body_font: tokens.body_font,
    },
    practiceName: kit.practiceName,
  });

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
    return NextResponse.json({ url: signed.data.signedUrl });
  }

  let rendered;
  try {
    rendered = await renderer({
      tokens,
      practiceName: kit.practiceName,
      googleFontsUrl: kit.selectedDirection.typography.google_fonts_url,
    });
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

  return NextResponse.json({ url: signed.data.signedUrl });
}
