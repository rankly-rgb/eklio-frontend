import { z } from "zod";

/*
 * Un schéma zod par étape du brief, plus un schéma global composé.
 * Chaque message d'erreur dit quoi corriger, en anglais — c'est de l'interface.
 * La validation stricte s'exécute côté serveur (server action) au passage à
 * l'étape suivante, et côté client pour l'affichage immédiat ; la sauvegarde
 * automatique au blur utilise la version assouplie (briefDataSchema) pour
 * accepter un brouillon incomplet.
 *
 * Les clés sont la forme jsonb persistée de `project_briefs.data`. Elles
 * gardent leurs noms d'origine : `lib/ai/directions.ts` les lit et reste gelé
 * jusqu'au Lot 2. Voir l'en-tête de lib/brief/steps.ts.
 */

const requiredText = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(2000, "Keep it under 2,000 characters — the essentials are enough.");
const freeText = z
  .string()
  .trim()
  .max(2000, "Keep it under 2,000 characters — the essentials are enough.")
  .optional();
const slider = z.number().int().min(1).max(5).default(3);

/*
 * Types de licence. `autre` est la branche « other » : la valeur est gelée
 * parce que lib/ai/directions.ts la compare (le Lot 2 la renommera).
 */
export const METIERS = [
  "therapist",
  "lpc",
  "lmft",
  "psychologist",
  "lcsw",
  "autre",
] as const;

export const SPECIALTIES = [
  "anxiety",
  "trauma_emdr",
  "couples",
  "child_teen",
  "depression",
  "grief",
  "addiction",
  "identity_lgbtq",
  "other",
] as const;

export const STADES = ["launching", "restructuring", "premiumizing"] as const;

export const CONTEXTES_ACHAT = [
  "in_crisis",
  "long_considered",
  "referred",
  "directory",
] as const;

export const OBJECTIONS = [
  "cost",
  "will_they_get_me",
  "time",
  "fear_of_judgment",
  "tried_before",
  "other",
] as const;

export const EMOTIONS = [
  "trust",
  "calm",
  "safety",
  "steadiness",
  "warmth",
  "clarity",
  "hope",
  "groundedness",
  "quiet_authority",
] as const;

export const FAMILLES_CHROMATIQUES = [
  "warm_neutrals",
  "cool_neutrals",
  "earth_ochre",
  "natural_greens",
  "deep_blues",
  "soft_pastels",
  "muted_plum_slate",
  "monochrome",
] as const;

export const NIVEAUX_CONTRASTE = ["soft", "balanced", "defined"] as const;

export const STYLES_TYPOGRAPHIQUES = [
  "editorial_serif",
  "neutral_sans",
  "geometric_sans",
  "serif_sans_pairing",
  "distinctive_display",
] as const;

export const NIVEAUX_CARACTERE = [
  "understated",
  "confident",
  "singular",
] as const;

export const OBJECTIFS_SITE = [
  "book_consultations",
  "explain_approach",
  "collect_inquiries",
  "establish_credibility",
] as const;

export const PAGES_SOUHAITEES = [
  "home",
  "about",
  "approach",
  "specialties",
  "fees",
  "faq",
  "contact",
  "blog",
] as const;

/*
 * Pas d'entrée `testimonials`, volontairement : la sollicitation de témoignages
 * clients est interdite aux praticiens licenciés (ACA C.3.a, APA 5.05). Ce sont
 * les diplômes, formations, publications et affiliations qui en tiennent lieu.
 */
export const PREUVES_DISPONIBLES = [
  "credentials",
  "training_certifications",
  "publications",
  "affiliations",
  "none",
] as const;

export const step1Schema = z
  .object({
    nom_activite: requiredText(
      "Enter your practice name, even a provisional one."
    ),
    metier: z.enum(METIERS, {
      error: "Choose the license type closest to yours.",
    }),
    metier_autre: freeText,
    specialties: z.array(z.enum(SPECIALTIES)).default([]),
    offre_principale: requiredText(
      "Describe in a sentence or two what you offer."
    ),
    stade: z.enum(STADES).optional(),
  })
  .check((ctx) => {
    if (
      ctx.value.metier === "autre" &&
      (!ctx.value.metier_autre || ctx.value.metier_autre.trim() === "")
    ) {
      ctx.issues.push({
        code: "custom",
        message: "Tell us your license type in your own words.",
        path: ["metier_autre"],
        input: ctx.value.metier_autre,
      });
    }
  });

export const step2Schema = z.object({
  probleme_resolu: requiredText(
    "Describe the situation you help people with."
  ),
  resultat_client: requiredText(
    "Describe the direction of the work, not a guaranteed result."
  ),
  alternatives: freeText,
  differenciation: freeText,
});

export const step3Schema = z.object({
  cible_description: requiredText(
    "Describe the person you most want to work with."
  ),
  contexte_achat: z.enum(CONTEXTES_ACHAT).optional(),
  objections: z
    .array(z.enum(OBJECTIONS))
    .max(3, "Keep the 3 hesitations you hear most.")
    .default([]),
});

export const step4Schema = z.object({
  ton_sobre_audacieux: slider,
  ton_chaleureux_professionnel: slider,
  ton_classique_contemporain: slider,
  ton_minimal_expressif: slider,
  emotions: z
    .array(z.enum(EMOTIONS))
    .length(3, "Choose exactly 3 feelings — no more, no less."),
  a_eviter_ton: freeText,
});

export const step5Schema = z.object({
  familles_chromatiques: z
    .array(z.enum(FAMILLES_CHROMATIQUES))
    .min(1, "Choose at least one color family.")
    .max(3, "Keep 3 color families at most."),
  niveau_contraste: z.enum(NIVEAUX_CONTRASTE).optional(),
  couleurs_a_eviter: freeText,
  univers_admires: freeText,
});

export const step6Schema = z.object({
  style_typographique: z.enum(STYLES_TYPOGRAPHIQUES, {
    error: "Choose the type style that fits your practice.",
  }),
  niveau_caractere: z.enum(NIVEAUX_CARACTERE, {
    error: "Choose how much character you want.",
  }),
});

export const step7Schema = z.object({
  objectif_site: z.enum(OBJECTIFS_SITE, {
    error: "Choose the main goal of your website.",
  }),
  action_attendue: requiredText(
    "Enter the exact words on your main button."
  ),
  pages_souhaitees: z.array(z.enum(PAGES_SOUHAITEES)).default([]),
  preuves_disponibles: z.array(z.enum(PREUVES_DISPONIBLES)).default([]),
  contraintes: freeText,
});

export const stepSchemas = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
  5: step5Schema,
  6: step6Schema,
  7: step7Schema,
} as const;

export type StepNumber = keyof typeof stepSchemas;

export const STEP_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

export function isStepNumber(value: number): value is StepNumber {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

/* Schéma global composé à partir des sept étapes. */
export const briefSchema = z.object({
  ...step1Schema.shape,
  ...step2Schema.shape,
  ...step3Schema.shape,
  ...step4Schema.shape,
  ...step5Schema.shape,
  ...step6Schema.shape,
  ...step7Schema.shape,
});

export type BriefData = z.infer<typeof briefSchema>;

/*
 * Version assouplie pour la sauvegarde automatique : mêmes clés, mêmes types,
 * mais tout est optionnel — un brouillon incomplet reste enregistrable sans
 * jamais accepter une forme invalide.
 */
export const briefDraftSchema = briefSchema.partial();

export type BriefDraft = z.infer<typeof briefDraftSchema>;

/*
 * Lecture tolérante de ce qui est déjà stocké dans `project_briefs.data`.
 *
 * Un parse de l'objet entier est tout-ou-rien : une seule valeur périmée (une
 * option renommée, une ligne éditée à la main) ferait tomber le brief complet
 * et afficherait un formulaire vide — pire, elle effacerait les autres réponses
 * à la fusion de la sauvegarde suivante. La lecture clé par clé conserve tout
 * champ encore valide et ne laisse tomber que ceux qui ne le sont plus. Les
 * valeurs entrantes du formulaire ne passent PAS par ici : elles restent
 * validées d'un bloc par briefDraftSchema et rejetées en cas d'anomalie.
 */
export function parseStoredBriefDraft(stored: unknown): BriefDraft {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return {};
  }

  const source = stored as Record<string, unknown>;
  const draft: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(briefDraftSchema.shape)) {
    if (!(key in source)) continue;
    const parsed = schema.safeParse(source[key]);
    if (parsed.success && parsed.data !== undefined) {
      draft[key] = parsed.data;
    }
  }

  return draft as BriefDraft;
}
