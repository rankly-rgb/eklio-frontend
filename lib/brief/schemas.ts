import { z } from "zod";

/*
 * Un schéma zod par étape du brief, plus un schéma global composé.
 * Chaque message d'erreur dit quoi corriger, en anglais — c'est de l'interface.
 * La validation stricte s'exécute côté serveur (server action) au passage à
 * l'étape suivante, et côté client pour l'affichage immédiat ; la sauvegarde
 * automatique au blur utilise la version assouplie (briefDataSchema) pour
 * accepter un brouillon incomplet.
 *
 * NOMMAGE (Lot 2) — les clés sont la forme jsonb persistée de
 * `project_briefs.data`. Elles sont désormais toutes en anglais, alignées sur
 * les libellés affichés. Les briefs déjà enregistrés portent les anciennes
 * clés françaises : `normalizeBriefDraft()` plus bas les traduit à la lecture,
 * ce qui évite toute migration backend (`project_briefs.data` est un jsonb
 * libre, sans contrainte de schéma côté base).
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
 * Types de licence. Le champ porte le TYPE DE LICENCE du praticien, pas un
 * métier générique : d'où `license_type` plutôt que `profession`, qui laissait
 * croire à une profession libre. `other` est la branche libre, précisée par
 * `license_type_other`.
 */
export const LICENSE_TYPES = [
  "therapist",
  "lpc",
  "lmft",
  "psychologist",
  "lcsw",
  "other",
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

export const STAGES = ["launching", "restructuring", "premiumizing"] as const;

export const DECISION_CONTEXTS = [
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

export const COLOR_FAMILIES = [
  "warm_neutrals",
  "cool_neutrals",
  "earth_ochre",
  "natural_greens",
  "deep_blues",
  "soft_pastels",
  "muted_plum_slate",
  "monochrome",
] as const;

export const CONTRAST_LEVELS = ["soft", "balanced", "defined"] as const;

export const TYPE_STYLES = [
  "editorial_serif",
  "neutral_sans",
  "geometric_sans",
  "serif_sans_pairing",
  "distinctive_display",
] as const;

export const CHARACTER_LEVELS = [
  "understated",
  "confident",
  "singular",
] as const;

export const SITE_GOALS = [
  "book_consultations",
  "explain_approach",
  "collect_inquiries",
  "establish_credibility",
] as const;

export const PAGES_WANTED = [
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
export const AVAILABLE_PROOF = [
  "credentials",
  "training_certifications",
  "publications",
  "affiliations",
  "none",
] as const;

export const step1Schema = z
  .object({
    practice_name: requiredText(
      "Enter your practice name, even a provisional one."
    ),
    license_type: z.enum(LICENSE_TYPES, {
      error: "Choose the license type closest to yours.",
    }),
    license_type_other: freeText,
    specialties: z.array(z.enum(SPECIALTIES)).default([]),
    offer: requiredText("Describe in a sentence or two what you offer."),
    stage: z.enum(STAGES).optional(),
  })
  .check((ctx) => {
    if (
      ctx.value.license_type === "other" &&
      (!ctx.value.license_type_other ||
        ctx.value.license_type_other.trim() === "")
    ) {
      ctx.issues.push({
        code: "custom",
        message: "Tell us your license type in your own words.",
        path: ["license_type_other"],
        input: ctx.value.license_type_other,
      });
    }
  });

export const step2Schema = z.object({
  problem_addressed: requiredText(
    "Describe the situation you help people with."
  ),
  client_gains: requiredText(
    "Describe the direction of the work, not a guaranteed result."
  ),
  alternatives: freeText,
  differentiation: freeText,
});

export const step3Schema = z.object({
  ideal_client: requiredText(
    "Describe the person you most want to work with."
  ),
  decision_context: z.enum(DECISION_CONTEXTS).optional(),
  objections: z
    .array(z.enum(OBJECTIONS))
    .max(3, "Keep the 3 hesitations you hear most.")
    .default([]),
});

export const step4Schema = z.object({
  tone_reserved_expressive: slider,
  tone_warm_clinical: slider,
  tone_classic_contemporary: slider,
  tone_minimal_rich: slider,
  emotions: z
    .array(z.enum(EMOTIONS))
    .length(3, "Choose exactly 3 feelings — no more, no less."),
  tone_to_avoid: freeText,
});

export const step5Schema = z.object({
  color_families: z
    .array(z.enum(COLOR_FAMILIES))
    .min(1, "Choose at least one color family.")
    .max(3, "Keep 3 color families at most."),
  contrast_level: z.enum(CONTRAST_LEVELS).optional(),
  colors_to_avoid: freeText,
  admired_worlds: freeText,
});

export const step6Schema = z.object({
  type_style: z.enum(TYPE_STYLES, {
    error: "Choose the type style that fits your practice.",
  }),
  character_level: z.enum(CHARACTER_LEVELS, {
    error: "Choose how much character you want.",
  }),
});

export const step7Schema = z.object({
  site_goal: z.enum(SITE_GOALS, {
    error: "Choose the main goal of your website.",
  }),
  primary_action: requiredText("Enter the exact words on your main button."),
  pages_wanted: z.array(z.enum(PAGES_WANTED)).default([]),
  available_proof: z.array(z.enum(AVAILABLE_PROOF)).default([]),
  constraints: freeText,
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
 * Correspondance ancienne clé française → nouvelle clé anglaise.
 *
 * Point unique de la rétrocompatibilité : aucun `?? draft.ancienne_cle` ne doit
 * être dispersé ailleurs dans le code. Tout ce qui lit `project_briefs.data`
 * passe par `normalizeBriefDraft()` ; l'écriture, elle, ne produit que les
 * clés anglaises.
 *
 * TODO(post-test-data): retirer le fallback FR une fois les données de test
 * purgées — supprimer LEGACY_KEY_ALIASES, LEGACY_VALUE_ALIASES et le corps de
 * normalizeBriefDraft().
 */
const LEGACY_KEY_ALIASES: Record<string, keyof BriefDraft> = {
  // 1 — Your practice
  nom_activite: "practice_name",
  metier: "license_type",
  metier_autre: "license_type_other",
  offre_principale: "offer",
  stade: "stage",
  // 2 — Positioning
  probleme_resolu: "problem_addressed",
  resultat_client: "client_gains",
  differenciation: "differentiation",
  // 3 — Ideal client
  cible_description: "ideal_client",
  contexte_achat: "decision_context",
  // 4 — Voice & tone
  ton_sobre_audacieux: "tone_reserved_expressive",
  ton_chaleureux_professionnel: "tone_warm_clinical",
  ton_classique_contemporain: "tone_classic_contemporary",
  ton_minimal_expressif: "tone_minimal_rich",
  a_eviter_ton: "tone_to_avoid",
  // 5 — Palette
  familles_chromatiques: "color_families",
  niveau_contraste: "contrast_level",
  couleurs_a_eviter: "colors_to_avoid",
  univers_admires: "admired_worlds",
  // 6 — Typography
  style_typographique: "type_style",
  niveau_caractere: "character_level",
  // 7 — Your website
  objectif_site: "site_goal",
  action_attendue: "primary_action",
  pages_souhaitees: "pages_wanted",
  preuves_disponibles: "available_proof",
  contraintes: "constraints",
};

/*
 * Valeurs littérales renommées, par clé. Seule `license_type` en a une : la
 * branche « other » était persistée `"autre"` avant le Lot 2.
 */
const LEGACY_VALUE_ALIASES: Partial<Record<keyof BriefDraft, Record<string, string>>> =
  {
    license_type: { autre: "other" },
  };

/**
 * Traduit les anciennes clés (et valeurs) françaises vers leur équivalent
 * anglais. Une clé anglaise déjà présente l'emporte toujours sur son alias :
 * un brief mixte ne doit pas voir sa réponse à jour écrasée par l'ancienne.
 *
 * Ne valide rien — c'est `parseStoredBriefDraft()` qui repasse zod derrière.
 */
export function normalizeBriefDraft(
  stored: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(stored)) {
    const target = LEGACY_KEY_ALIASES[key] ?? key;
    if (target !== key && target in stored) continue;

    const valueAliases = LEGACY_VALUE_ALIASES[target as keyof BriefDraft];
    normalized[target] =
      valueAliases && typeof value === "string" && value in valueAliases
        ? valueAliases[value]
        : value;
  }

  return normalized;
}

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

  const source = normalizeBriefDraft(stored as Record<string, unknown>);
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
