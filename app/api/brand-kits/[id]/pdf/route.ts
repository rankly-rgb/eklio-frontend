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
import { readSiteCatalog } from "@/lib/site/catalog";
import { builderOf } from "@/lib/site/output";
import { renderBrandGuidePdf, type BrandGuideData } from "@/lib/kit/pdf/brand-guide";
import { track } from "@/lib/analytics";

/*
 * GET /api/brand-kits/[id]/pdf — the fourteen-page brand guide (Lot 5),
 * composed on the fly with pdf-lib + fontkit — no headless browser, no
 * stored file. `brand_kits.pdf_url` stays empty on purpose: a URL pointing
 * at a stale file would be worse than none.
 *
 * ── LA ROUTE LA PLUS IMPORTANTE À GARDER DE TOUT LE PRODUIT ──────────────
 *
 * C'est LE livrable, et il QUITTE le produit à la seconde où il est composé.
 * Une révocation ne le rattrape jamais. Gardée par `isBrandKitEntitled`,
 * explicitement — jamais par un effet de bord d'écriture.
 *
 * Measured, not guessed — end-to-end in this environment, fonts NOT yet
 * cached in the `fonts` Storage bucket (the worst case: every one of the
 * five satori/resvg sub-renders — the site mockup, four social template
 * thumbnails — plus the two embedded text fonts, each doing a real Google
 * Fonts round trip): 1.5s–3.3s across repeated runs (network variance, not
 * a cold/warm difference — this sandbox has no real Storage cache to warm).
 * With fonts already cached — the normal case after the first PDF for a
 * given font pairing — expect meaningfully faster, since every one of those
 * calls skips Google Fonts entirely. 60s keeps very wide headroom over the
 * worst case actually observed; replace with the real number the first time
 * this route is hit cold on a deployed preview.
 */
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/pdf">
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

  if (!kit.selectedDirection) return notFound();

  const [siteSpec, siteCatalog] = await Promise.all([
    siteSpecGet(supabase, id),
    readSiteCatalog(supabase).catch(() => null),
  ]);
  if (!siteSpec.ok) {
    return NextResponse.json(
      { error: "Your palette is still being set up. Try again in a moment." },
      { status: 409 }
    );
  }

  const practiceName = kit.practiceName ?? "Your practice";
  const words = practiceName.trim().split(/\s+/).filter(Boolean);
  const monogram =
    words.length <= 1 ? (words[0]?.[0] ?? "").toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();

  const siteBuilderLabel =
    siteCatalog ? builderOf(siteCatalog.builder_targets, siteSpec.data.spec.target).label : null;

  const data: BrandGuideData = {
    practiceName,
    monogram,
    tokens: siteSpec.data.preview.tokens,
    googleFontsUrl: kit.selectedDirection.typography.google_fonts_url,
    contrast: siteSpec.data.contrast,
    direction: kit.selectedDirection,
    voiceGuide: kit.voiceGuide,
    socialTemplates: kit.socialTemplates,
    sitePages: siteSpec.data.spec.pages,
    siteBuilderLabel,
    practitionerLine: kit.row.practitioner_line,
  };

  let pdf: Uint8Array;
  try {
    pdf = await renderBrandGuidePdf(data);
  } catch (err) {
    return serverError("pdf:render", err);
  }

  track("pdf_downloaded", { brandKitId: id });
  const name = practiceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name || "brand-kit"}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
