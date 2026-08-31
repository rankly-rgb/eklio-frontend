import { z } from "zod";

/*
 * Les formes des deux payloads générés par ce lot — `project_briefs.tone_cards`
 * et `project_briefs.usp_options` — telles que les CHECK d'eklio-backend les
 * contraignent (FRONTEND_CONTRACT.md §9.4 et §9.5, projet
 * `fobgdsupyfslxbswfuay`). Distinct de `lib/brand/shapes.ts`, qui transcrit
 * les CHECK du brand_kit (projet US, autre lot) : deux schémas différents pour
 * deux tables différentes, même s'ils partagent un vocabulaire.
 *
 * Les valider ICI, avant l'écriture, est ce qui évite qu'un CHECK rejeté
 * remonte en 500 après une minute d'attente sur l'étape 5 ou l'écran de
 * positionnement.
 */

/* ── `tone_cards` (§9.4) ────────────────────────────────────────────────── */
/*
 * `project_briefs_tone_cards_valid` : exactement 6 éléments, les cinq clés
 * toutes présentes, `keywords` à trois éléments exactement, `sample_hero` ≤
 * 46 caractères (pas 90 : cette carte rend dans le même emplacement que
 * `hero.headline` d'une direction, §9.4), 6 `id` distincts.
 */

export const toneCardSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()).length(3),
  sample_hero: z.string().max(46),
  generated: z.literal(true),
});
export type ToneCard = z.infer<typeof toneCardSchema>;

export const toneCardsSchema = z
  .array(toneCardSchema)
  .length(6)
  .refine(
    (list) => new Set(list.map((card) => card.id)).size === 6,
    "The six tone cards carry distinct ids"
  );
export type ToneCards = z.infer<typeof toneCardsSchema>;

/* ── `usp_options` (§9.5) ───────────────────────────────────────────────── */
/*
 * `project_briefs_usp_options_valid` : exactement 3 éléments, les cinq clés
 * toutes présentes, `statement` ≤ 200, `rationale` ≤ 240, `evidence` un
 * tableau de chaînes, et les trois `angle` DISTINCTS.
 */

export const USP_ANGLES = ["population", "method", "lived_experience"] as const;
export type UspAngle = (typeof USP_ANGLES)[number];

export const uspOptionSchema = z.object({
  id: z.string().min(1),
  angle: z.enum(USP_ANGLES),
  statement: z.string().max(200),
  rationale: z.string().max(240),
  /** Noms de COLONNES de `project_briefs` — jamais affichés bruts, §9.9. */
  evidence: z.array(z.string()),
});
export type UspOption = z.infer<typeof uspOptionSchema>;

export const uspOptionsSchema = z
  .array(uspOptionSchema)
  .length(3)
  .refine(
    (list) => new Set(list.map((option) => option.angle)).size === 3,
    "The three USP options carry distinct angles"
  );
export type UspOptions = z.infer<typeof uspOptionsSchema>;

/*
 * Correspondance nom de colonne → étiquette humaine (§9.9), pour la ligne
 * « Built from: … » de l'écran de positionnement. Table illustrative côté
 * contrat, pas exhaustive : à étendre si une génération cite un autre champ.
 *
 * `modality_ids` n'a PAS d'entrée statique ici : le contrat demande le NOM de
 * la modalité choisie (« EMDR »), pas une phrase générique — ça exige le
 * catalogue au moment du rendu, donc c'est résolu dans l'écran de
 * positionnement, pas ici.
 */
export const EVIDENCE_LABELS: Record<string, string> = {
  referral_quote: "what a colleague would say",
  not_a_fit_text: "who this isn't for",
  not_a_fit_ids: "who this isn't for",
  session_style_ids: "how sessions work",
  prior_career: "her background",
};
