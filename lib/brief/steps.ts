import type { ChoiceOption } from "@/components/ui/choice-group";
import type { BriefDraft } from "@/lib/brief/schemas";

/*
 * Configuration déclarative des 7 étapes du brief : titres de question,
 * aides, champs et options. Les écrans et la fiche de marque se construisent
 * entièrement à partir de ce fichier.
 */

export type SliderDef = {
  name: keyof BriefDraft & string;
  left: string;
  right: string;
};

export type FieldDef =
  | {
      kind: "text";
      name: keyof BriefDraft & string;
      label: string;
      help?: string;
      required?: boolean;
      visibleIf?: (values: BriefDraft) => boolean;
    }
  | {
      kind: "textarea";
      name: keyof BriefDraft & string;
      label: string;
      help?: string;
      required?: boolean;
      rows?: number;
    }
  | {
      kind: "choice";
      name: keyof BriefDraft & string;
      label: string;
      help?: string;
      required?: boolean;
      options: ChoiceOption[];
    }
  | {
      kind: "multi";
      name: keyof BriefDraft & string;
      label: string;
      help?: string;
      required?: boolean;
      options: ChoiceOption[];
      max?: number;
    }
  | {
      kind: "sliders";
      name: "curseurs_de_ton";
      label: string;
      sliders: SliderDef[];
    };

export type StepDef = {
  step: number;
  slug: string;
  title: string;
  question: string;
  help: string;
  fields: FieldDef[];
};

export const METIER_OPTIONS: ChoiceOption[] = [
  { value: "coach", label: "coach" },
  { value: "therapeute", label: "thérapeute ou praticien bien-être" },
  { value: "consultant", label: "consultant" },
  { value: "formateur", label: "formateur indépendant" },
  { value: "freelance", label: "freelance créa/tech" },
  { value: "artisan", label: "artisan" },
  { value: "autre", label: "autre" },
];

const STADE_OPTIONS: ChoiceOption[] = [
  { value: "lancement", label: "je lance mon activité" },
  { value: "restructuration", label: "je la restructure" },
  { value: "evolution", label: "je la fais évoluer" },
];

const CONTEXTE_ACHAT_OPTIONS: ChoiceOption[] = [
  { value: "urgence", label: "urgence" },
  { value: "projet_reflechi", label: "projet réfléchi" },
  { value: "impulsion", label: "achat d'impulsion" },
  { value: "recommandation", label: "recommandation" },
];

const OBJECTION_OPTIONS: ChoiceOption[] = [
  { value: "prix", label: "prix" },
  { value: "credibilite", label: "crédibilité" },
  { value: "manque_de_temps", label: "manque de temps" },
  { value: "peur_du_resultat", label: "peur du résultat" },
  { value: "deja_essaye", label: "déjà essayé ailleurs" },
  { value: "autre", label: "autre" },
];

export const EMOTION_OPTIONS: ChoiceOption[] = [
  { value: "confiance", label: "confiance" },
  { value: "calme", label: "calme" },
  { value: "energie", label: "énergie" },
  { value: "rigueur", label: "rigueur" },
  { value: "proximite", label: "proximité" },
  { value: "elegance", label: "élégance" },
  { value: "audace", label: "audace" },
  { value: "douceur", label: "douceur" },
  { value: "autorite", label: "autorité" },
];

/*
 * Les pastilles sont des données d'aperçu chromatique (contenu du brief),
 * pas des couleurs d'interface : elles ne passent donc pas par les tokens.
 */
export const FAMILLE_CHROMATIQUE_OPTIONS: ChoiceOption[] = [
  {
    value: "neutres_chauds",
    label: "neutres chauds",
    swatches: ["#D9CBB8", "#B8A88F", "#8A7B63"],
  },
  {
    value: "neutres_froids",
    label: "neutres froids",
    swatches: ["#D3D6D8", "#A9B0B5", "#7A838A"],
  },
  {
    value: "terres_et_ocres",
    label: "terres et ocres",
    swatches: ["#C57B45", "#A0522D", "#7C3F21"],
  },
  {
    value: "verts_naturels",
    label: "verts naturels",
    swatches: ["#8FA98A", "#4C6B4F", "#2F4A38"],
  },
  {
    value: "bleus_profonds",
    label: "bleus profonds",
    swatches: ["#41648C", "#2C4A6E", "#16233A"],
  },
  {
    value: "pastels",
    label: "pastels",
    swatches: ["#F2C9C9", "#C9DDF2", "#D9F2C9"],
  },
  {
    value: "contrastes_vifs",
    label: "contrastes vifs",
    swatches: ["#E63312", "#131313", "#F5D90A"],
  },
  {
    value: "monochrome_noir_blanc",
    label: "monochrome noir et blanc",
    swatches: ["#131313", "#6B6B68", "#FFFFFF"],
  },
];

const NIVEAU_CONTRASTE_OPTIONS: ChoiceOption[] = [
  { value: "doux", label: "doux" },
  { value: "equilibre", label: "équilibré" },
  { value: "marque", label: "marqué" },
];

/* Chaque style est rendu dans sa propre police pour être lisible visuellement. */
export const STYLE_TYPOGRAPHIQUE_OPTIONS: ChoiceOption[] = [
  {
    value: "serif_editorial",
    label: "serif éditorial",
    labelClassName: "text-lg [font-family:Georgia,'Times_New_Roman',serif]",
  },
  {
    value: "sans_serif_neutre",
    label: "sans-serif neutre",
    labelClassName: "text-lg font-sans",
  },
  {
    value: "sans_serif_geometrique",
    label: "sans-serif géométrique",
    labelClassName:
      "text-lg [font-family:Futura,'Century_Gothic',Verdana,sans-serif]",
  },
  {
    value: "melange_serif_sans",
    label: "mélange serif + sans",
    labelClassName:
      "text-lg [font-family:Georgia,serif] [font-style:italic]",
  },
  {
    value: "caractere_marque",
    label: "caractère marqué",
    labelClassName: "text-lg font-display",
  },
];

const NIVEAU_CARACTERE_OPTIONS: ChoiceOption[] = [
  { value: "discret", label: "discret" },
  { value: "affirme", label: "affirmé" },
  { value: "singulier", label: "singulier" },
];

export const OBJECTIF_SITE_OPTIONS: ChoiceOption[] = [
  { value: "rendez_vous", label: "obtenir des rendez-vous" },
  { value: "vente_en_ligne", label: "vendre en ligne" },
  { value: "emails", label: "collecter des emails" },
  { value: "credibilite", label: "gagner en crédibilité" },
];

const PAGE_OPTIONS: ChoiceOption[] = [
  { value: "accueil", label: "accueil" },
  { value: "a_propos", label: "à propos" },
  { value: "offres", label: "offres" },
  { value: "tarifs", label: "tarifs" },
  { value: "temoignages", label: "témoignages" },
  { value: "contact", label: "contact" },
  { value: "blog", label: "blog" },
];

const PREUVE_OPTIONS: ChoiceOption[] = [
  { value: "temoignages", label: "témoignages" },
  { value: "resultats_chiffres", label: "résultats chiffrés" },
  { value: "certifications", label: "certifications" },
  { value: "portfolio", label: "portfolio" },
  { value: "aucune", label: "aucune pour l'instant" },
];

export const TONE_SLIDERS: SliderDef[] = [
  { name: "ton_sobre_audacieux", left: "sobre", right: "audacieux" },
  {
    name: "ton_chaleureux_professionnel",
    left: "chaleureux",
    right: "professionnel",
  },
  {
    name: "ton_classique_contemporain",
    left: "classique",
    right: "contemporain",
  },
  { name: "ton_minimal_expressif", left: "minimal", right: "expressif" },
];

export const STEPS: StepDef[] = [
  {
    step: 1,
    slug: "activite",
    title: "Activité",
    question: "Parlez-nous de votre activité.",
    help: "Quelques repères simples pour situer ce que vous faites.",
    fields: [
      {
        kind: "text",
        name: "nom_activite",
        label: "Nom de l'activité",
        required: true,
      },
      {
        kind: "choice",
        name: "metier",
        label: "Métier",
        required: true,
        options: METIER_OPTIONS,
      },
      {
        kind: "text",
        name: "metier_autre",
        label: "Votre métier, en quelques mots",
        required: true,
        visibleIf: (values) => values.metier === "autre",
      },
      {
        kind: "textarea",
        name: "offre_principale",
        label: "Offre principale",
        help: "En une ou deux phrases, ce que vous vendez concrètement.",
        required: true,
      },
      {
        kind: "choice",
        name: "stade",
        label: "Où en êtes-vous ?",
        options: STADE_OPTIONS,
      },
    ],
  },
  {
    step: 2,
    slug: "positionnement",
    title: "Positionnement",
    question: "Qu'est-ce qui rend votre offre nécessaire ?",
    help: "Le problème, le résultat, et ce qui vous distingue.",
    fields: [
      {
        kind: "textarea",
        name: "probleme_resolu",
        label: "Problème résolu",
        required: true,
      },
      {
        kind: "textarea",
        name: "resultat_client",
        label: "Résultat client",
        help: "Ce que votre client obtient à la fin.",
        required: true,
      },
      {
        kind: "text",
        name: "alternatives",
        label: "Alternatives",
        help: "Ce que font vos clients aujourd'hui, à défaut de vous.",
      },
      {
        kind: "textarea",
        name: "differenciation",
        label: "Différenciation",
      },
    ],
  },
  {
    step: 3,
    slug: "audience",
    title: "Audience",
    question: "À qui vous adressez-vous ?",
    help: "Décrivez votre client idéal et son contexte de décision.",
    fields: [
      {
        kind: "textarea",
        name: "cible_description",
        label: "Votre cible",
        required: true,
      },
      {
        kind: "choice",
        name: "contexte_achat",
        label: "Contexte d'achat",
        options: CONTEXTE_ACHAT_OPTIONS,
      },
      {
        kind: "multi",
        name: "objections",
        label: "Objections fréquentes",
        options: OBJECTION_OPTIONS,
        max: 3,
      },
    ],
  },
  {
    step: 4,
    slug: "ton",
    title: "Ton",
    question: "Quel ton doit prendre votre marque ?",
    help: "Placez les curseurs à l'instinct, puis choisissez 3 émotions.",
    fields: [
      {
        kind: "sliders",
        name: "curseurs_de_ton",
        label: "Curseurs de ton",
        sliders: TONE_SLIDERS,
      },
      {
        kind: "multi",
        name: "emotions",
        label: "Émotions à transmettre",
        help: "Choisissez exactement 3 émotions.",
        required: true,
        options: EMOTION_OPTIONS,
        max: 3,
      },
      {
        kind: "text",
        name: "a_eviter_ton",
        label: "À éviter",
        help: "Les mots ou postures que vous ne voulez pas dans votre communication.",
      },
    ],
  },
  {
    step: 5,
    slug: "palette",
    title: "Palette",
    question: "Vers quelles couleurs votre marque penche-t-elle ?",
    help: "Choisissez 1 à 3 familles, on affine ensuite pour vous.",
    fields: [
      {
        kind: "multi",
        name: "familles_chromatiques",
        label: "Familles de couleurs",
        required: true,
        options: FAMILLE_CHROMATIQUE_OPTIONS,
        max: 3,
      },
      {
        kind: "choice",
        name: "niveau_contraste",
        label: "Niveau de contraste",
        options: NIVEAU_CONTRASTE_OPTIONS,
      },
      {
        kind: "text",
        name: "couleurs_a_eviter",
        label: "Couleurs à éviter",
      },
      {
        kind: "textarea",
        name: "univers_admires",
        label: "Univers admirés",
        help: "Des marques, des lieux, des objets dont l'ambiance vous parle.",
      },
    ],
  },
  {
    step: 6,
    slug: "typographies",
    title: "Typographies",
    question: "Quel caractère pour vos lettres ?",
    help: "Chaque style est affiché dans sa propre police, fiez-vous à l'œil.",
    fields: [
      {
        kind: "choice",
        name: "style_typographique",
        label: "Style typographique",
        required: true,
        options: STYLE_TYPOGRAPHIQUE_OPTIONS,
      },
      {
        kind: "choice",
        name: "niveau_caractere",
        label: "Niveau de caractère",
        required: true,
        options: NIVEAU_CARACTERE_OPTIONS,
      },
    ],
  },
  {
    step: 7,
    slug: "site",
    title: "Site",
    question: "Que doit accomplir votre site ?",
    help: "L'objectif principal, l'action attendue, et les pages utiles.",
    fields: [
      {
        kind: "choice",
        name: "objectif_site",
        label: "Objectif du site",
        required: true,
        options: OBJECTIF_SITE_OPTIONS,
      },
      {
        kind: "text",
        name: "action_attendue",
        label: "Action attendue",
        help: "Le texte exact du bouton principal, par exemple : réserver un appel.",
        required: true,
      },
      {
        kind: "multi",
        name: "pages_souhaitees",
        label: "Pages souhaitées",
        options: PAGE_OPTIONS,
      },
      {
        kind: "multi",
        name: "preuves_disponibles",
        label: "Preuves disponibles",
        options: PREUVE_OPTIONS,
      },
      {
        kind: "text",
        name: "contraintes",
        label: "Contraintes",
      },
    ],
  },
];

export function getStep(step: number): StepDef | undefined {
  return STEPS.find((s) => s.step === step);
}

/* Libellé lisible d'une valeur d'option, pour la fiche de marque et le récapitulatif. */
export function optionLabel(
  options: ChoiceOption[],
  value: string | undefined
): string | undefined {
  return options.find((o) => o.value === value)?.label;
}
