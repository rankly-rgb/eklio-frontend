import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, notFound } from "@/lib/api/handler";
import {
  isBrandKitEntitled,
  lockedMessage,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { renderBrandKitPdf } from "@/lib/kit/pdf";
import { track } from "@/lib/analytics";

/*
 * GET /api/brand-kits/[id]/pdf — le kit de marque en PDF.
 *
 * Rendu à la volée, sans dépendance de rendu headless : `lib/kit/pdf.ts`
 * compose le document directement. `brand_kits.pdf_url` reste vide tant qu'on
 * ne stocke rien — une URL qui pointerait vers un fichier périmé serait pire
 * qu'une absence.
 *
 * ── LA ROUTE LA PLUS IMPORTANTE À GARDER DE TOUT LE PRODUIT ──────────────
 *
 * C'est LE livrable, et il QUITTE le produit à la seconde où il est composé.
 * Une révocation ne le rattrape jamais : le fichier est sur son disque, il est
 * peut-être déjà envoyé à un prestataire. Toutes les autres surfaces peuvent
 * se refermer après coup ; celle-ci, une seule fois suffit.
 *
 * Elle était gardée par `selected_direction_id` — c'est-à-dire par un EFFET
 * DE BORD du fait qu'une praticienne non payante ne pouvait pas écrire cette
 * colonne. Ça tient tant que la colonne est vide, et ça tombe le jour où une
 * ligne existe déjà : un kit choisi avant ce lot, une fixture, un geste de
 * support, une fonctionnalité qui poserait une direction pour elle.
 */
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/pdf">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const kit = await loadBrandKit(auth.session.supabase, id, auth.session.userId);
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(auth.session.supabase, id))) {
    /*
     * Le texte change selon qu'elle n'a jamais payé ou que l'achat a été
     * annulé — mais PAS selon la raison de l'annulation : carte volée et
     * litige de mauvaise foi lisent la même phrase. Nous ne savons pas lequel
     * des deux nous avons en face.
     */
    const reversed = await purchaseWasReversed(
      auth.session.supabase,
      kit.projectId
    );
    return NextResponse.json(
      {
        error: lockedMessage(reversed),
        checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
      },
      { status: 402 }
    );
  }

  track("pdf_downloaded", { brandKitId: id });
  const pdf = renderBrandKitPdf(kit);
  const name = (kit.practiceName ?? "brand-kit")
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
