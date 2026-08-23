import type { ChoiceOption } from "@/components/ui/choice-group";
import type { BriefDraft } from "@/lib/brief/schemas";

/*
 * Configuration déclarative des 7 étapes du brief : question de cadrage,
 * aides, champs et options. Les écrans, le récapitulatif et la fiche de
 * marque se construisent entièrement à partir de ce fichier.
 *
 * Le brief est spécialisé pour les praticiens de santé mentale licenciés en
 * cabinet privé aux États-Unis : l'étape 1 demande un TYPE DE LICENCE et des
 * SPÉCIALITÉS, et non plus un métier générique. Tout le contenu affiché est
 * en anglais américain ; les commentaires restent en français, comme partout
 * ailleurs dans le dépôt.
 *
 * NOMMAGE — délibéré, ne pas « corriger » isolément.
 * Les clés persistées (`nom_activite`, `metier`, `offre_principale`, …) et les
 * tableaux d'options exportés gardent leurs noms d'origine : `lib/ai/directions.ts`
 * les lit et reste gelé jusqu'au Lot 2. `metier` porte désormais le type de
 * licence, et sa branche « other » conserve la valeur littérale `"autre"` pour
 * la même raison (directions.ts la compare). Seuls les libellés affichés, les
 * valeurs d'options et la validation changent ici. C'est le Lot 2 qui renommera
 * les clés en réécrivant la couche de génération.
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

/* Types de licence. `autre` = « other » — valeur gelée jusqu'au Lot 2 (cf. en-tête). */
export const METIER_OPTIONS: ChoiceOption[] = [
  { value: "therapist", label: "therapist (generalist)" },
  { value: "lpc", label: "LPC — licensed professional counselor" },
  { value: "lmft", label: "LMFT — marriage & family therapist" },
  { value: "psychologist", label: "psychologist" },
  { value: "lcsw", label: "LCSW — clinical social worker" },
  { value: "autre", label: "other" },
];

export const SPECIALTY_OPTIONS: ChoiceOption[] = [
  { value: "anxiety", label: "anxiety" },
  { value: "trauma_emdr", label: "trauma & EMDR" },
  { value: "couples", label: "couples" },
  { value: "child_teen", label: "child & teen" },
  { value: "depression", label: "depression" },
  { value: "grief", label: "grief" },
  { value: "addiction", label: "addiction" },
  { value: "identity_lgbtq", label: "identity / LGBTQ+" },
  { value: "other", label: "other" },
];

const STADE_OPTIONS: ChoiceOption[] = [
  { value: "launching", label: "launching the practice" },
  { value: "restructuring", label: "restructuring it" },
  {
    value: "premiumizing",
    label: "premiumizing it — moving toward private pay",
  },
];

const CONTEXTE_ACHAT_OPTIONS: ChoiceOption[] = [
  { value: "in_crisis", label: "in crisis right now" },
  { value: "long_considered", label: "has been considering it for a while" },
  { value: "referred", label: "referred by another provider" },
  { value: "directory", label: "found you through a directory" },
];

const OBJECTION_OPTIONS: ChoiceOption[] = [
  { value: "cost", label: "cost" },
  { value: "will_they_get_me", label: "“will they get me?”" },
  { value: "time", label: "time" },
  { value: "fear_of_judgment", label: "fear of judgment" },
  { value: "tried_before", label: "tried therapy before and it didn’t help" },
  { value: "other", label: "other" },
];

export const EMOTION_OPTIONS: ChoiceOption[] = [
  { value: "trust", label: "trust" },
  { value: "calm", label: "calm" },
  { value: "safety", label: "safety" },
  { value: "steadiness", label: "steadiness" },
  { value: "warmth", label: "warmth" },
  { value: "clarity", label: "clarity" },
  { value: "hope", label: "hope" },
  { value: "groundedness", label: "groundedness" },
  { value: "quiet_authority", label: "quiet authority" },
];

/*
 * Les pastilles sont des données d'aperçu chromatique (contenu du brief),
 * pas des couleurs d'interface : elles ne passent donc pas par les tokens.
 */
export const FAMILLE_CHROMATIQUE_OPTIONS: ChoiceOption[] = [
  {
    value: "warm_neutrals",
    label: "warm neutrals",
    swatches: ["#D9CBB8", "#B8A88F", "#8A7B63"],
  },
  {
    value: "cool_neutrals",
    label: "cool neutrals",
    swatches: ["#D3D6D8", "#A9B0B5", "#7A838A"],
  },
  {
    value: "earth_ochre",
    label: "earth & ochre",
    swatches: ["#C57B45", "#A0522D", "#7C3F21"],
  },
  {
    value: "natural_greens",
    label: "natural greens",
    swatches: ["#8FA98A", "#4C6B4F", "#2F4A38"],
  },
  {
    value: "deep_blues",
    label: "deep blues",
    swatches: ["#41648C", "#2C4A6E", "#16233A"],
  },
  {
    value: "soft_pastels",
    label: "soft pastels",
    swatches: ["#F2C9C9", "#C9DDF2", "#D9F2C9"],
  },
  {
    value: "muted_plum_slate",
    label: "muted plum & slate",
    swatches: ["#9B8AA6", "#6E6076", "#454A57"],
  },
  {
    value: "monochrome",
    label: "monochrome",
    swatches: ["#131313", "#6B6B68", "#FFFFFF"],
  },
];

const NIVEAU_CONTRASTE_OPTIONS: ChoiceOption[] = [
  { value: "soft", label: "soft" },
  { value: "balanced", label: "balanced" },
  { value: "defined", label: "defined" },
];

/* Chaque style est rendu dans sa propre police pour être choisi à l'œil. */
export const STYLE_TYPOGRAPHIQUE_OPTIONS: ChoiceOption[] = [
  {
    value: "editorial_serif",
    label: "editorial serif",
    labelClassName: "text-lg [font-family:Georgia,'Times_New_Roman',serif]",
  },
  {
    value: "neutral_sans",
    label: "neutral sans",
    labelClassName: "text-lg font-sans",
  },
  {
    value: "geometric_sans",
    label: "geometric sans",
    labelClassName:
      "text-lg [font-family:Futura,'Century_Gothic',Verdana,sans-serif]",
  },
  {
    value: "serif_sans_pairing",
    label: "serif + sans pairing",
    labelClassName: "text-lg [font-family:Georgia,serif] [font-style:italic]",
  },
  {
    value: "distinctive_display",
    label: "distinctive display",
    labelClassName: "text-lg font-display",
  },
];

const NIVEAU_CARACTERE_OPTIONS: ChoiceOption[] = [
  { value: "understated", label: "understated" },
  { value: "confident", label: "confident" },
  { value: "singular", label: "singular" },
];

export const OBJECTIF_SITE_OPTIONS: ChoiceOption[] = [
  { value: "book_consultations", label: "book consultations" },
  { value: "explain_approach", label: "explain your approach" },
  { value: "collect_inquiries", label: "collect inquiries" },
  { value: "establish_credibility", label: "establish credibility" },
];

const PAGE_OPTIONS: ChoiceOption[] = [
  { value: "home", label: "home" },
  { value: "about", label: "about" },
  { value: "approach", label: "approach" },
  { value: "specialties", label: "specialties" },
  { value: "fees", label: "fees" },
  { value: "faq", label: "FAQ" },
  { value: "contact", label: "contact" },
  { value: "blog", label: "blog" },
];

/*
 * Les témoignages clients sont volontairement absents de cette liste : leur
 * sollicitation est interdite pour ce public (ACA C.3.a, APA 5.05). L'aide du
 * champ le dit explicitement plutôt que de laisser l'omission inexpliquée.
 */
const PREUVE_OPTIONS: ChoiceOption[] = [
  { value: "credentials", label: "credentials & licensure" },
  { value: "training_certifications", label: "training & certifications" },
  { value: "publications", label: "publications" },
  { value: "affiliations", label: "professional affiliations" },
  { value: "none", label: "none for now" },
];

export const TONE_SLIDERS: SliderDef[] = [
  { name: "ton_sobre_audacieux", left: "reserved", right: "expressive" },
  { name: "ton_chaleureux_professionnel", left: "warm", right: "clinical" },
  { name: "ton_classique_contemporain", left: "classic", right: "contemporary" },
  { name: "ton_minimal_expressif", left: "minimal", right: "rich" },
];

export const STEPS: StepDef[] = [
  {
    step: 1,
    slug: "practice",
    title: "Your practice",
    question: "Tell us about your practice.",
    help: "A few basics, so we know who we are writing for.",
    fields: [
      {
        kind: "text",
        name: "nom_activite",
        label: "Practice name",
        required: true,
      },
      {
        kind: "choice",
        name: "metier",
        label: "License type",
        required: true,
        options: METIER_OPTIONS,
      },
      {
        kind: "text",
        name: "metier_autre",
        label: "Your license type, in your own words",
        required: true,
        visibleIf: (values) => values.metier === "autre",
      },
      {
        kind: "multi",
        name: "specialties",
        label: "Specialty focus",
        help: "Pick the areas you actually work in most.",
        options: SPECIALTY_OPTIONS,
      },
      {
        kind: "textarea",
        name: "offre_principale",
        label: "What you offer",
        help: "In a sentence or two — individual therapy, couples intensives, groups.",
        required: true,
      },
      {
        kind: "choice",
        name: "stade",
        label: "Stage",
        options: STADE_OPTIONS,
      },
    ],
  },
  {
    step: 2,
    slug: "positioning",
    title: "Positioning",
    question: "What makes your practice the right fit for the people you help?",
    help: "What they are carrying, where the work goes, and what sets you apart.",
    fields: [
      {
        kind: "textarea",
        name: "probleme_resolu",
        label: "Problem you help with",
        help: "Describe it as a situation someone is living, not a diagnostic label.",
        required: true,
      },
      {
        kind: "textarea",
        name: "resultat_client",
        label: "What the client gains",
        // Garde-fou rédactionnel (Lot 0) : oriente vers une formulation sans
        // promesse de résultat, ce que la génération vérifiera au Lot 2.
        help: "Describe the direction of the work, not a guaranteed result.",
        required: true,
      },
      {
        kind: "text",
        name: "alternatives",
        label: "What clients do instead today",
        help: "Other therapists, directories, or putting it off entirely.",
      },
      {
        kind: "textarea",
        name: "differenciation",
        label: "What sets you apart",
      },
    ],
  },
  {
    step: 3,
    slug: "ideal-client",
    title: "Ideal client",
    question: "Who do you most want to work with?",
    help: "The person you do your best work with, and how they arrive.",
    fields: [
      {
        kind: "textarea",
        name: "cible_description",
        label: "Your ideal client",
        help: "A situation tells us more than a label — “first-gen professionals carrying success guilt” rather than “anxiety”.",
        required: true,
      },
      {
        kind: "choice",
        name: "contexte_achat",
        label: "Decision context",
        options: CONTEXTE_ACHAT_OPTIONS,
      },
      {
        kind: "multi",
        name: "objections",
        label: "Common hesitations",
        help: "Keep the 3 you hear most.",
        options: OBJECTION_OPTIONS,
        max: 3,
      },
    ],
  },
  {
    step: 4,
    slug: "voice-and-tone",
    title: "Voice & tone",
    question: "How should your practice sound?",
    help: "Move the sliders on instinct, then choose 3 feelings.",
    fields: [
      {
        kind: "sliders",
        name: "curseurs_de_ton",
        label: "Tone sliders",
        sliders: TONE_SLIDERS,
      },
      {
        kind: "multi",
        name: "emotions",
        label: "Feelings to convey",
        help: "Choose exactly 3.",
        required: true,
        options: EMOTION_OPTIONS,
        max: 3,
      },
      {
        kind: "text",
        name: "a_eviter_ton",
        label: "Avoid",
        help: "Words or postures you do not want anywhere near your practice.",
      },
    ],
  },
  {
    step: 5,
    slug: "palette",
    title: "Palette",
    question: "Which colors feel like your practice?",
    help: "Choose 1 to 3 families; we refine the exact tones for you.",
    fields: [
      {
        kind: "multi",
        name: "familles_chromatiques",
        label: "Color families",
        help: "Sage and dusty blue are the directory default — standing apart is allowed.",
        required: true,
        options: FAMILLE_CHROMATIQUE_OPTIONS,
        max: 3,
      },
      {
        kind: "choice",
        name: "niveau_contraste",
        label: "Contrast level",
        options: NIVEAU_CONTRASTE_OPTIONS,
      },
      {
        kind: "text",
        name: "couleurs_a_eviter",
        label: "Colors to avoid",
      },
      {
        kind: "textarea",
        name: "univers_admires",
        label: "Admired worlds",
        help: "Brands, places or objects whose atmosphere speaks to you.",
      },
    ],
  },
  {
    step: 6,
    slug: "typography",
    title: "Typography",
    question: "What character for your words?",
    help: "Each style is shown in its own typeface — trust your eye.",
    fields: [
      {
        kind: "choice",
        name: "style_typographique",
        label: "Type style",
        required: true,
        options: STYLE_TYPOGRAPHIQUE_OPTIONS,
      },
      {
        kind: "choice",
        name: "niveau_caractere",
        label: "Character level",
        required: true,
        options: NIVEAU_CARACTERE_OPTIONS,
      },
    ],
  },
  {
    step: 7,
    slug: "website",
    title: "Your website",
    question: "What should your website do?",
    help: "The main goal, the action you want, and the pages worth building.",
    fields: [
      {
        kind: "choice",
        name: "objectif_site",
        label: "Site goal",
        required: true,
        options: OBJECTIF_SITE_OPTIONS,
      },
      {
        kind: "text",
        name: "action_attendue",
        label: "Primary action",
        help: "The exact words on your main button — for example: book a consultation.",
        required: true,
      },
      {
        kind: "multi",
        name: "pages_souhaitees",
        label: "Pages wanted",
        options: PAGE_OPTIONS,
      },
      {
        kind: "multi",
        name: "preuves_disponibles",
        label: "Available proof",
        // Garde-fou rédactionnel (Lot 0) : l'absence de « témoignages » est
        // une contrainte déontologique, pas un oubli — on l'explique.
        help: "Client testimonials are intentionally left out: ACA and APA advertising rules prohibit soliciting them. Credentials and training carry that weight instead.",
        options: PREUVE_OPTIONS,
      },
      {
        kind: "text",
        name: "contraintes",
        label: "Constraints",
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
