import type { CSSProperties } from "react";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * Les jetons de la maquette, posés en propriétés custom `--s-*`.
 *
 * ── Pourquoi PAS `previewCssVariables` de `lib/brand/derive.ts` ──────────
 *
 * Cette fonction-là DÉRIVE l'encre, le corps et le filet d'une palette à cinq
 * rôles, parce que le rail du brief n'a rien d'autre. Ici, la base a déjà
 * calculé les quatre variantes (`primary_text`, `secondary_text`,
 * `accent_text`, `cta_ink`), sur la vraie surface, et les a mises dans
 * `preview.tokens`. Les recalculer serait exactement ce que le §8 du contrat
 * interdit : deux implémentations d'un même modèle, qui finissent par ne plus
 * dire la même chose.
 *
 * Le préfixe est donc différent (`--s-`, pour *site spec*) : les deux
 * maquettes coexistent dans l'application, elles ne doivent pas se marcher
 * dessus.
 *
 * ── LA RÈGLE, sur chaque surface ────────────────────────────────────────
 *
 *   du TEXTE  → la variante (`--s-primary-text`, `--s-secondary-text`,
 *               `--s-accent-text`, et `--s-cta-ink` pour le libellé du bouton)
 *   un APLAT  → la couleur de marque (`--s-primary`, `--s-secondary`,
 *               `--s-accent`) : fond, bouton, bande, filet, bordure, pastille
 *
 * Là où la couleur de marque lit déjà comme texte, la variante EST la couleur
 * de marque, chaîne identique. Dix des dix-huit couleurs livrées sont dans ce
 * cas : traiter la variante comme « toujours différente » est faux.
 */
export function siteTokenVariables(tokens: SitePreviewTokens): CSSProperties {
  return {
    "--s-primary": tokens.primary,
    "--s-secondary": tokens.secondary,
    "--s-accent": tokens.accent,
    "--s-paper": tokens.paper,
    "--s-light": tokens.light_neutral,
    "--s-dark": tokens.dark_neutral,
    "--s-primary-text": tokens.primary_text,
    "--s-secondary-text": tokens.secondary_text,
    "--s-accent-text": tokens.accent_text,
    "--s-cta-ink": tokens.cta_ink,
    "--s-heading": `"${tokens.heading_font}", Georgia, serif`,
    "--s-body": `"${tokens.body_font}", system-ui, sans-serif`,
  } as CSSProperties;
}

/*
 * Le PLANCHER de taille du libellé du bouton (annexe du contrat).
 *
 * « Do not set the call-to-action label below 18px bold, or 24px if it is not
 * bold. » Les deux couleurs du bouton ont été vérifiées pour du texte à cette
 * taille ; en dessous, la même paire cesse d'être assez lisible. La consigne
 * part dans la sortie ET s'applique ici : un aperçu de bouton rendu à 11px
 * montrerait quelque chose que la praticienne n'a pas le droit de reproduire.
 */
export const CTA_LABEL_FLOOR_PX = 18;
export const CTA_LABEL_FLOOR_WEIGHT = 700;
