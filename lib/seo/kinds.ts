/*
 * ══════════════════════════════════════════════════════════════════════════
 *  PAGES SEO MENSUELLES — LES CONSTANTES DU LIVRABLE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chaque mois, une abonnée Monthly Presence reçoit une page locale de service et
 * deux articles de psychoéducation, prêts à coller sur SON site. Eklio n'héberge
 * pas son site (décision du 2026-08-29) : rien ici ne publie.
 *
 * ⚠ LE QUOTA N'EST PAS ICI. Il vit en base (`seo_quota_config`) et ne se lit que
 * par `seo_quota_for` / `claim_seo_slot`. Ces constantes décrivent la FORME d'une
 * pièce, pas combien elle en reçoit.
 */

export const SEO_KINDS = ["local_page", "article"] as const;
export type SeoKind = (typeof SEO_KINDS)[number];

/** Le corps, en mots (FAQ exclue). Écrit dans la consigne ET vérifié après. */
export const WORD_RANGE: Record<SeoKind, { min: number; max: number }> = {
  local_page: { min: 700, max: 1100 },
  article: { min: 1000, max: 1600 },
};

/** Une FAQ de 4 à 6 vraies questions. */
export const FAQ_RANGE = { min: 4, max: 6 } as const;

/** Les contrôles SEO déterministes. */
export const TITLE_MAX = 60;
export const META_RANGE = { min: 140, max: 160 } as const;

/**
 * Le plafond de dépense d'UN mois d'UNE abonnée, en dollars. Le compteur réserve
 * le pire coût de chaque appel avant de l'envoyer : trois pièces, chacune avec une
 * réécriture possible, tiennent largement dessous (≈ 0,07 $ l'appel mesuré).
 */
export const SEO_MONTH_CAP_USD = 1.5;

/** Le libellé d'interface d'un genre de pièce — sans jargon SEO. */
export const KIND_LABEL: Record<SeoKind, string> = {
  local_page: "Local service page",
  article: "Article",
};
