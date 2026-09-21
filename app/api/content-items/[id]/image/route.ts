import { authenticate, serverError } from "@/lib/api/handler";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { getContentItem } from "@/lib/data/content";
import { reviewCardFor } from "@/lib/content/review";
import { carouselSlides } from "@/lib/content/slides";
import { render, CompositionError } from "@/lib/compose/engine";
import { BudgetExceededError } from "@/lib/compose/budget";
import { composeFontFiles, composeToPng } from "@/lib/kit/render/compose-raster";

/*
 * GET /api/content-items/[id]/image            — la carte, en PNG, tout de suite.
 * GET /api/content-items/[id]/image?slide=2    — la 2e carte d'un carrousel.
 *
 * ⚠ UNE SLIDE PAR FICHIER, ET PAS D'ARCHIVE. Instagram demande les images
 * d'un carrousel une par une ; un .zip demanderait un paquet de plus et lui
 * demanderait de décompresser avant de publier. Chaque slide est un PNG
 * 1080 × 1350 comme toutes les autres cartes du produit — le moteur ne compose
 * que dans ce cadre (`lib/compose/constants.ts`).
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
  request: Request,
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

    /*
     * ⚠ LA SLIDE EST DEMANDÉE PAR SON NUMÉRO, ET UN NUMÉRO HORS BORNES EST UN
     * REFUS, PAS LA PREMIÈRE CARTE. Servir silencieusement autre chose que ce
     * qui est demandé produit un dossier de téléchargements où deux fichiers
     * portent des noms différents et la même image, et elle le découvre après
     * publication.
     */
    const asked = new URL(request.url).searchParams.get("slide");
    const slides = carouselSlides(card);

    if (slides.kind === "refused") {
      return Response.json(
        { error: { code: "does_not_compose", message: slides.message } },
        { status: 409 }
      );
    }

    if (slides.kind === "slides") {
      const number = asked === null ? 1 : Number(asked);
      const slide = Number.isInteger(number) ? slides.slides[number - 1] : undefined;
      if (!slide) {
        return Response.json(
          {
            error: {
              code: "no_such_slide",
              message: `This carousel has ${slides.slides.length} slides.`,
            },
          },
          { status: 409 }
        );
      }
      const pngSlide = composeToPng(slide.svg, await composeFontFiles());
      return new Response(new Uint8Array(pngSlide), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename(
            item.title,
            `${slide.number}-of-${slides.slides.length}`
          )}"`,
          "Cache-Control": "private, no-store",
        },
      });
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
function filename(title: string | null, suffix?: string): string {
  const slug = (title ?? "post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  /*
   * ⚠ LE RANG EST DANS LE NOM, PAS SEULEMENT DANS L'ORDRE DE
   * TÉLÉCHARGEMENT. Cinq fichiers qui s'appellent « post.png », « post
   * (1).png »… se publient dans le désordre, et un carrousel dans le désordre
   * ne veut plus rien dire.
   */
  return `${slug || "post"}${suffix ? `-${suffix}` : ""}.png`;
}
