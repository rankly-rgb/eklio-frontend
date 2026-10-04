/*
 * ── LE CATALOGUE SANS VALIDATEUR (2026-10-04) ───────────────────────────
 *
 * Ces trois listes vivaient dans `lib/data/content.ts`, qui importe `zod` pour
 * ses schémas de lecture. `lib/content/generate/plan.ts` — du calcul pur, les
 * dates et la mise en page d'un mois — les importait par là, et tirait donc `zod`
 * dans toute chaîne qui planifie un mois, y compris celles qui ne lisent rien.
 *
 * Elles sont déplacées ici telles quelles, et `lib/data/content.ts` les
 * réexporte : aucun appelant existant ne change d'import.
 */

/*
 * ⚠ DEUX LISTES, PARCE QUE `google_post` NE PORTE PAS D'IMAGE.
 *
 * Les cinq premiers sont des posts Instagram : un fond, un texte posé DESSUS
 * (`on_image_text`), une légende. Un post de fiche Google est du texte court et
 * un bouton — et la base le refuse désormais s'il porte un `image_slot` ou un
 * `on_image_text` (`content_items_google_post_has_no_image`).
 *
 * La distinction n'est pas cosmétique : `ARCHETYPE_FLOOR` est une mesure de
 * capacité D'UNE IMAGE, en caractères, relevée par un script de rendu. Donner
 * un plancher à `google_post` serait écrire un chiffre qui ne mesure rien.
 */
export const IMAGE_ARCHETYPES = [
  "statement",
  "question",
  "notes",
  "signature",
  "story",
] as const;
export type ImageArchetype = (typeof IMAGE_ARCHETYPES)[number];

/*
 * ── REGISTER IS NOT ARCHETYPE ────────────────────────────────────────────
 *
 * `archetype` above is a LAYOUT — it maps to the satori renderer's catalogue
 * keys. A register is an EDITORIAL SHAPE with its own safety rule, governing
 * what a caption may say and what it may never say. A named feeling can be
 * laid out as a statement or as notes; a practical note usually lands in notes
 * but does not have to.
 *
 * The two value sets are DISJOINT by construction — note `reflective_question`
 * rather than `question` — and a guard rail in the creating migration fails if
 * they ever overlap. That is the `min_tier` lesson applied in advance: two
 * vocabularies that agree only because both are currently permissive will
 * eventually disagree, silently.
 *
 * The catalogue itself lives in `content_registers`, with each register's
 * safety rule stored as data. This array is the TypeScript mirror of its ids;
 * the labels and rules are read from the table, never duplicated here.
 */
export const CONTENT_REGISTERS = [
  "named_feeling",
  "reflective_question",
  "how_the_work_works",
  "permission",
  "practical_note",
  "seasonal_note",
] as const;
export type ContentRegister = (typeof CONTENT_REGISTERS)[number];

/** 1, 2 or 3 posts a week. Closed: the generation plan is a table indexed by it. */
export const CONTENT_CADENCES = [1, 2, 3] as const;
export type ContentCadence = (typeof CONTENT_CADENCES)[number];
