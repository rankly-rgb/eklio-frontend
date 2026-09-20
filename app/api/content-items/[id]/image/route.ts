import { authenticate, serverError } from "@/lib/api/handler";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { getContentItem } from "@/lib/data/content";
import { reviewCardFor } from "@/lib/content/review";
import { render, CompositionError } from "@/lib/compose/engine";
import { BudgetExceededError } from "@/lib/compose/budget";
import { composeFontFiles, composeToPng } from "@/lib/kit/render/compose-raster";

/*
 * GET /api/content-items/[id]/image — la carte, en PNG, tout de suite.
 *
 * ⚠ COMPOSÉE À LA DEMANDE ET RIEN N'EST STOCKÉ. Le seau `content-assets` est
 * en lecture seule pour une cliente, et écrire depuis ici demanderait la clef
 * de service — c'est-à-dire un second chemin d'écriture à côté de
 * `record_rendered_asset`, avec sa propre façon de se tromper. Le pipeline du
 * mois écrira ; cette route sert la relecture, qui est un acte unitaire.
 *
 * ⚠ ET RIEN N'EST FACTURÉ. Composer est de l'arithmétique : le texte est déjà
 * écrit, la palette est déjà choisie, et le moteur ne touche aucun modèle.
 * Aucune réservation de crédit n'est prise ici, ni au succès ni à l'échec.
 *
 * Trois refus, et ils sont différents :
 *   404  l'item n'est pas à elle, ou n'existe pas — la base décide, pas nous
 *   409  il n'y a rien à composer, ou ça ne tient pas aux planchers
 *        typographiques. C'est une réponse du système, pas une panne.
 *   500  les polices manquent. Rendre sans elles produirait une carte dont les
 *        clearances ont été prouvées sur un autre document, ce qui est pire
 *        qu'une erreur visible.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/content-items/[id]/image">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const supabase = auth.session.supabase;

  try {
    const result = await getContentItem(supabase, id);
    if (!result.ok) {
      return Response.json(
        { error: { code: result.code, message: result.message } },
        { status: result.code === "payment_required" ? 402 : 404 }
      );
    }

    const item = result.data;
    const kit = await loadBrandKit(supabase, item.brand_kit_id, auth.session.userId);
    if (!kit) {
      return Response.json({ error: { code: "not_found" } }, { status: 404 });
    }

    const direction = kit.selectedDirection?.palette ?? kit.directions?.[0]?.palette ?? null;
    const card = await reviewCardFor(supabase, item, direction, kit.practiceName);
    if (!card) {
      return Response.json(
        {
          error: {
            code: "nothing_to_compose",
            message: "There is no diagram on this one yet.",
          },
        },
        { status: 409 }
      );
    }

    let svg: string;
    try {
      svg = render({
        archetype: card.archetypeKey,
        payload: card.payload,
        palette: card.palette,
        eyebrow: card.eyebrow,
        headline: card.headline,
        footer: card.footer,
      }).svg;
    } catch (error: unknown) {
      if (error instanceof CompositionError || error instanceof BudgetExceededError) {
        /*
         * ⚠ UN REFUS DE COMPOSITION EST UNE RÉPONSE, PAS UNE 500. Le moteur dit
         * que ça ne tient pas à ces planchers ; le message est le sien, et il
         * est exactement ce que l'écran de relecture affiche déjà sous la
         * variante refusée.
         */
        return Response.json(
          { error: { code: "does_not_compose", message: (error as Error).message } },
          { status: 409 }
        );
      }
      throw error;
    }

    const png = composeToPng(svg, await composeFontFiles());

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename(item.title)}"`,
        /*
         * ⚠ PRIVÉ, ET SANS CACHE PARTAGÉ. C'est le post d'une cliente, servi
         * derrière son cookie de session ; un cache intermédiaire qui le garde
         * le sert à la requête suivante, qui peut être celle d'une autre.
         */
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return serverError("GET /api/content-items/[id]/image", error);
  }
}

/** Un nom de fichier qu'elle reconnaît dans son dossier de téléchargements. */
function filename(title: string | null): string {
  const slug = (title ?? "post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "post"}.png`;
}
