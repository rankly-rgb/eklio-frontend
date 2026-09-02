import type { Catalog } from "@/lib/catalog/types";
import type { PreviewModel } from "@/lib/brand/shapes";
import type { StepDraft } from "@/lib/brief/flow";
import type { ToneCards } from "@/lib/generation/how-you-work-shapes";

/*
 * Prévisualisation OPTIMISTE.
 *
 * `brief_preview()` reste l'autorité : c'est elle qui compose le modèle, et sa
 * réponse remplace ce qui est calculé ici. Mais elle arrive après un débounce
 * de 600 ms plus un aller-retour réseau, et le §5 demande que le rail réagisse
 * INSTANTANÉMENT à la palette, à la typographie et au ton.
 *
 * Cette fonction reproduit donc, côté client, exactement ce que la fonction
 * SQL fait pour ces champs-là — et rien d'autre. Tout ce qui demanderait une
 * règle (le paragraphe « About », l'overline) est laissé au serveur : le
 * dupliquer ici créerait deux vérités qui finiraient par diverger.
 */
export function applyOptimistic(
  base: PreviewModel,
  draft: StepDraft,
  catalog: Catalog,
  generatedToneCards: ToneCards | null = null
): PreviewModel {
  const next: PreviewModel = {
    ...base,
    tokens: { ...base.tokens },
    hero: { ...base.hero },
  };

  const practiceName = draft.practice_name?.trim();
  if (practiceName) next.practice_name = practiceName;

  // La palette « LEADING » est l'élément 1 du tableau : l'ordre est porteur de
  // sens, le commentaire de la colonne le dit.
  const leadingId = draft.palette_family_ids[0];
  if (leadingId) {
    const family = catalog.paletteFamilies.find((entry) => entry.id === leadingId);
    if (family) {
      next.tokens = { ...next.tokens, ...family.preview_tokens };
    }
  }

  if (draft.type_pairing_id) {
    const pairing = catalog.typePairings.find(
      (entry) => entry.id === draft.type_pairing_id
    );
    if (pairing) {
      next.tokens.heading_font = pairing.heading_font;
      next.tokens.body_font = pairing.body_font;
      next.tokens.google_fonts_url = pairing.google_fonts_url;
    }
  }

  /*
   * Une carte GÉNÉRÉE (`data.selected_tone_card_id`) prime sur la carte du
   * catalogue statique : les deux sont mutuellement exclusives (§9.2 du
   * contrat n'a pas de colonne pour la première, voir `briefDataSchema`).
   * Dans les deux cas, `headline_is_sample` : §2.2, tant qu'aucune direction
   * réelle n'est choisie, ce titre reste un échantillon, pas la marque.
   */
  const selectedGeneratedCard = draft.data.selected_tone_card_id
    ? generatedToneCards?.find((card) => card.id === draft.data.selected_tone_card_id)
    : null;

  if (selectedGeneratedCard) {
    next.hero.headline = selectedGeneratedCard.sample_hero;
    next.hero.headline_is_sample = true;
  } else if (draft.tone_card_id) {
    const tone = catalog.toneCards.find((entry) => entry.id === draft.tone_card_id);
    if (tone) {
      next.hero.headline = tone.sample_hero;
      next.hero.headline_is_sample = true;
    }
  }

  if (draft.primary_action_id) {
    const action = catalog.primaryActions.find(
      (entry) => entry.id === draft.primary_action_id
    );
    if (action) next.hero.cta_label = action.label;
  }

  if (draft.specialty_ids.length > 0) {
    const labels = draft.specialty_ids
      .map((id) => catalog.specialties.find((entry) => entry.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    if (labels.length > 0) next.specialties = labels.slice(0, 2);
  }

  return next;
}
