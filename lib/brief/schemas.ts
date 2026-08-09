import { z } from "zod";

/*
 * Un schéma zod par étape du brief, plus un schéma global composé.
 * Chaque message d'erreur dit quoi corriger. La validation stricte s'exécute
 * côté serveur (server action) au passage à l'étape suivante, et côté client
 * pour l'affichage immédiat ; la sauvegarde automatique au blur utilise la
 * version assouplie (briefDataSchema) pour accepter un brouillon incomplet.
 */

const texteRequis = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(2000, "Restez sous 2000 caractères, l'essentiel suffit.");
const texteLibre = z
  .string()
  .trim()
  .max(2000, "Restez sous 2000 caractères, l'essentiel suffit.")
  .optional();
const curseur = z.number().int().min(1).max(5).default(3);

export const METIERS = [
  "coach",
  "therapeute",
  "consultant",
  "formateur",
  "freelance",
  "artisan",
  "autre",
] as const;

export const STADES = ["lancement", "restructuration", "evolution"] as const;

export const CONTEXTES_ACHAT = [
  "urgence",
  "projet_reflechi",
  "impulsion",
  "recommandation",
] as const;

export const OBJECTIONS = [
  "prix",
  "credibilite",
  "manque_de_temps",
  "peur_du_resultat",
  "deja_essaye",
  "autre",
] as const;

export const EMOTIONS = [
  "confiance",
  "calme",
  "energie",
  "rigueur",
  "proximite",
  "elegance",
  "audace",
  "douceur",
  "autorite",
] as const;

export const FAMILLES_CHROMATIQUES = [
  "neutres_chauds",
  "neutres_froids",
  "terres_et_ocres",
  "verts_naturels",
  "bleus_profonds",
  "pastels",
  "contrastes_vifs",
  "monochrome_noir_blanc",
] as const;

export const NIVEAUX_CONTRASTE = ["doux", "equilibre", "marque"] as const;

export const STYLES_TYPOGRAPHIQUES = [
  "serif_editorial",
  "sans_serif_neutre",
  "sans_serif_geometrique",
  "melange_serif_sans",
  "caractere_marque",
] as const;

export const NIVEAUX_CARACTERE = ["discret", "affirme", "singulier"] as const;

export const OBJECTIFS_SITE = [
  "rendez_vous",
  "vente_en_ligne",
  "emails",
  "credibilite",
] as const;

export const PAGES_SOUHAITEES = [
  "accueil",
  "a_propos",
  "offres",
  "tarifs",
  "temoignages",
  "contact",
  "blog",
] as const;

export const PREUVES_DISPONIBLES = [
  "temoignages",
  "resultats_chiffres",
  "certifications",
  "portfolio",
  "aucune",
] as const;

export const step1Schema = z
  .object({
    nom_activite: texteRequis(
      "Indiquez le nom de votre activité, même provisoire."
    ),
    metier: z.enum(METIERS, {
      error: "Choisissez le métier qui se rapproche le plus du vôtre.",
    }),
    metier_autre: texteLibre,
    offre_principale: texteRequis(
      "Décrivez en une ou deux phrases ce que vous vendez."
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
        message: "Précisez votre métier en quelques mots.",
        path: ["metier_autre"],
        input: ctx.value.metier_autre,
      });
    }
  });

export const step2Schema = z.object({
  probleme_resolu: texteRequis(
    "Décrivez le problème que vous résolvez pour vos clients."
  ),
  resultat_client: texteRequis(
    "Décrivez ce que votre client obtient à la fin."
  ),
  alternatives: texteLibre,
  differenciation: texteLibre,
});

export const step3Schema = z.object({
  cible_description: texteRequis(
    "Décrivez la personne à qui vous vous adressez."
  ),
  contexte_achat: z.enum(CONTEXTES_ACHAT).optional(),
  objections: z
    .array(z.enum(OBJECTIONS))
    .max(3, "Gardez les 3 objections les plus fréquentes.")
    .default([]),
});

export const step4Schema = z.object({
  ton_sobre_audacieux: curseur,
  ton_chaleureux_professionnel: curseur,
  ton_classique_contemporain: curseur,
  ton_minimal_expressif: curseur,
  emotions: z
    .array(z.enum(EMOTIONS))
    .length(3, "Choisissez exactement 3 émotions, ni plus ni moins."),
  a_eviter_ton: texteLibre,
});

export const step5Schema = z.object({
  familles_chromatiques: z
    .array(z.enum(FAMILLES_CHROMATIQUES))
    .min(1, "Choisissez au moins une famille de couleurs.")
    .max(3, "Gardez 3 familles de couleurs au maximum."),
  niveau_contraste: z.enum(NIVEAUX_CONTRASTE).optional(),
  couleurs_a_eviter: texteLibre,
  univers_admires: texteLibre,
});

export const step6Schema = z.object({
  style_typographique: z.enum(STYLES_TYPOGRAPHIQUES, {
    error: "Choisissez le style typographique qui vous ressemble.",
  }),
  niveau_caractere: z.enum(NIVEAUX_CARACTERE, {
    error: "Choisissez le niveau de caractère souhaité.",
  }),
});

export const step7Schema = z.object({
  objectif_site: z.enum(OBJECTIFS_SITE, {
    error: "Choisissez l'objectif principal de votre site.",
  }),
  action_attendue: texteRequis(
    "Indiquez le texte exact de votre bouton principal."
  ),
  pages_souhaitees: z.array(z.enum(PAGES_SOUHAITEES)).default([]),
  preuves_disponibles: z.array(z.enum(PREUVES_DISPONIBLES)).default([]),
  contraintes: texteLibre,
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
