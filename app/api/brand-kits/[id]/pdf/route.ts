import type { NextRequest } from "next/server";
import { authenticate, notFound } from "@/lib/api/handler";
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
