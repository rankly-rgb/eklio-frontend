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
 * `project_briefs_usp_options_valid` : 2 ou 3 éléments (jamais 1, jamais 0),
 * les cinq clés toutes présentes, `statement` ≤ 200, `rationale` ≤ 240,
 * `evidence` un tableau de chaînes, et les `angle` DISTINCTS entre eux.
 */

/*
 * ── LES TROIS ANGLES, RECADRÉS SUR LES MOTS DE LA PATIENTE ──────────────
 *
 * L'offre du 13 septembre demande « sa niche, formulée dans les mots de ses
 * patients, PAS en modalités ni en démographie ».
 *
 * ⚠ DEUX DES TROIS ANGLES PRÉCÉDENTS ÉTAIENT EXACTEMENT CE QUE L'OFFRE
 * INTERDIT. `population` était la démographie, `method` était la modalité.
 * Les renommer n'aurait rien changé : c'est ce qu'ils demandaient au modèle
 * d'écrire qui était devenu faux.
 *
 * Les trois nouveaux sont trois façons de dire LA MÊME niche, toutes du point
 * de vue de la personne qui cherche :
 *
 *   presenting_problem   ce qu'elle porte, dans ses mots à elle
 *   the_moment           l'instant où quelqu'un se décide à chercher
 *   what_keeps_returning ce qu'elle a déjà essayé, et qui revient
 */
export const USP_ANGLES = [
  "presenting_problem",
  "the_moment",
  "what_keeps_returning",
] as const;
export type UspAngle = (typeof USP_ANGLES)[number];

/*
 * ⚠ CE QUI A DÉJÀ ÉTÉ ÉCRIT RESTE LISIBLE. Des briefs portent des
 * `usp_options` avec les anciens angles, et la validation en base les accepte
 * toujours. Une lecture qui les refuserait ferait disparaître le
 * positionnement de quelqu'un au rechargement d'une page — une valeur qui
 * s'efface sans erreur, le défaut que ce dépôt documente depuis le lot 6.
 *
 * On GÉNÈRE les trois nouveaux ; on LIT les six.
 */
export const LEGACY_USP_ANGLES = [
  "population",
  "method",
  "lived_experience",
] as const;

export const READABLE_USP_ANGLES = [
  ...USP_ANGLES,
  ...LEGACY_USP_ANGLES,
] as const;
export type ReadableUspAngle = (typeof READABLE_USP_ANGLES)[number];

export const uspOptionSchema = z.object({
  id: z.string().min(1),
  // Lecture : les six. Cf. READABLE_USP_ANGLES ci-dessus.
  angle: z.enum(READABLE_USP_ANGLES),
  statement: z.string().max(200),
  rationale: z.string().max(240),
  /** Noms de COLONNES de `project_briefs` — jamais affichés bruts, §9.9. */
  evidence: z.array(z.string()),
});
export type UspOption = z.infer<typeof uspOptionSchema>;

/*
 * ⚠ CE QUE LE MODÈLE A LE DROIT DE PRODUIRE, plus étroit que ce qu'on LIT.
 * `uspOptionSchema` accepte les six angles parce que des briefs en portent
 * d'anciens ; une génération qui rendrait un angle retiré est, elle, un échec
 * — le prompt ne les propose plus, donc les voir revenir voudrait dire que le
 * modèle a inventé. La gate 1 valide la forme avec celui-ci.
 */
export const generatedUspOptionSchema = uspOptionSchema.extend({
  angle: z.enum(USP_ANGLES),
});
export type GeneratedUspOption = z.infer<typeof generatedUspOptionSchema>;

export const uspOptionsSchema = z
  .array(uspOptionSchema)
  .min(2)
  .max(3)
  .refine(
    (list) => new Set(list.map((option) => option.angle)).size === list.length,
    "The USP options carry distinct angles"
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

/**
 * `evidence` → étiquette humaine, pour la ligne « Built from: … » de l'écran
 * de positionnement (§2.4/§9.9). `modality_ids` a besoin du CATALOGUE — le
 * contrat demande le nom réel de la modalité (« EMDR »), pas une phrase
 * générique — donc résolu ici plutôt que dans `EVIDENCE_LABELS`.
 */
export function resolveEvidenceLabel(
  field: string,
  modalityIds: string[],
  modalityCards: { id: string; label: string }[]
): string {
  if (field === "modality_ids") {
    const labels = modalityIds
      .map((id) => modalityCards.find((entry) => entry.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    return labels.length > 0 ? labels.join(", ") : "her training";
  }
  return EVIDENCE_LABELS[field] ?? field;
}
