import { BudgetExceededError, budgetErrors } from "@/lib/compose/budget";
import { CompositionError, renderCarousel } from "@/lib/compose/engine";
import type { ReviewCard } from "@/lib/content/review";

/*
 * ── UN CARROUSEL, CARTE PAR CARTE ───────────────────────────────────────
 *
 * ⚠ UN CARROUSEL N'EST PAS UNE MISE EN PAGE, C'EST UN NOMBRE DE CARTES.
 * `layoutAlternatives` l'écarte explicitement pour cette raison — on ne
 * propose pas « la même chose autrement » quand la réponse est « plus de
 * cartes ». Conséquence non voulue : sur un carrousel, l'écran de relecture
 * n'avait ni carte ni bouton de téléchargement, alors que c'est précisément
 * un format que « Write it » sait produire.
 *
 * Ce module est la moitié manquante. Il ne compose rien de neuf : il appelle
 * `renderCarousel`, qui rend CHAQUE carte par son propre archétype, avec son
 * propre budget de mots et ses propres clearances de zone.
 *
 * ⚠ ET IL NE DÉPENSE RIEN. Composer est de l'arithmétique, comme partout
 * ailleurs sur cet écran : le texte des cartes est déjà écrit.
 */

export const CAROUSEL_KEY = "carousel";

export type Slide = {
  /** 1-indexé, parce que c'est ce qu'elle lit : « Slide 2 of 5 ». */
  number: number;
  svg: string;
  /** Ce que le résolveur a dû faire sur CETTE carte. Vide quand rien. */
  resolution: string[];
};

/*
 * ⚠ TROIS RÉPONSES, PAS UN TABLEAU VIDE POUR TOUT.
 *
 * « ce post n'est pas un carrousel » et « le moteur refuse cette carte » sont
 * deux choses différentes, et les confondre en `[]` rendrait un écran muet sur
 * un vrai refus — c'est-à-dire un carrousel facturé, écrit, et invisible sans
 * que rien ne dise pourquoi.
 */
export type SlidesResult =
  | { kind: "not_a_carousel" }
  | { kind: "slides"; slides: Slide[] }
  | { kind: "refused"; message: string };

export function carouselSlides(card: ReviewCard | null): SlidesResult {
  if (!card || card.archetypeKey !== CAROUSEL_KEY) return { kind: "not_a_carousel" };

  /*
   * ── LE BUDGET DU CONTENEUR D'ABORD, ET IL NOMME LA CARTE ──────────────
   *
   * ⚠ `renderCarousel` NE LE FAIT PAS, ET C'EST CE QUI PERDAIT L'INDEX. Il
   * parse le carrousel puis appelle `render` carte par carte ; chaque carte
   * mesure alors SON budget sous son propre archétype, et le refus qui
   * remonte dit « single_statement: statement has 40, allowed 24 ». Vrai,
   * mais muet sur LAQUELLE des cinq cartes déborde — c'est-à-dire
   * inutilisable pour décider quoi relancer.
   *
   * `budgetErrors("carousel", …)` récurse et rend `cards[2].statement`. C'est
   * exactement l'ordre que `render` applique pour une carte seule — le budget
   * à l'étape 0, avant qu'un glyphe soit mesuré — et c'est le même message
   * que `validateCopy` produit sur le chemin de génération.
   */
  const overBudget = budgetErrors(CAROUSEL_KEY, card.payload);
  if (overBudget.length > 0) {
    return {
      kind: "refused",
      message: new BudgetExceededError(CAROUSEL_KEY, overBudget).message,
    };
  }

  try {
    const rendered = renderCarousel({
      archetype: card.archetypeKey,
      payload: card.payload,
      palette: card.palette,
      eyebrow: card.eyebrow,
      headline: card.headline,
      footer: card.footer,
    });

    return {
      kind: "slides",
      slides: rendered.map((result, index) => ({
        number: index + 1,
        svg: result.svg,
        resolution: result.composition.resolution,
      })),
    };
  } catch (error: unknown) {
    /*
     * ⚠ SEULS LES DEUX REFUS DU MOTEUR SONT RATTRAPÉS. Un budget dépassé et
     * une composition impossible sont des RÉPONSES : le moteur dit que ça ne
     * tient pas. Tout le reste est un bug, et l'avaler ici le ferait
     * disparaître de la page comme des logs à la fois.
     */
    if (error instanceof BudgetExceededError || error instanceof CompositionError) {
      return { kind: "refused", message: (error as Error).message };
    }
    throw error;
  }
}
