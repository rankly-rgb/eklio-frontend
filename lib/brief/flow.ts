import type { BriefData } from "@/lib/data/brief";
import type { BriefRow } from "@/lib/data/brief";
/* Un type, pas du contenu : la règle « aucun catalogue ici » tient. */
import type { ToneCards } from "@/lib/generation/how-you-work-shapes";
import type { LicenseTypeState } from "@/lib/catalog/types";
import { licenseAllowedInState } from "@/lib/brief/license-state";

/*
 * Les sept étapes du brief — cadrage, validation, avancement.
 *
 * Ce module ne porte AUCUN contenu de catalogue : les cartes de ton, les
 * familles de palette, les paires typographiques, les personas, les licences
 * et les spécialités sont lus en base (§6). Il ne porte que ce qui est
 * structurel : la question posée, ce qu'elle écrit, et ce qui la rend valide.
 */

export const STEP_COUNT = 7;

/*
 * Ordre depuis le renumérotage (FRONTEND_CONTRACT.md §9.7) : practice,
 * positioning, client INCHANGÉS — puis how_you_work (NOUVEAU, 4), voice
 * (était 4, devient 5), look (fusion de palette + typography, était 5 et 6,
 * devient 6), website INCHANGÉ à 7.
 */
export type StepId =
  | "practice"
  | "positioning"
  | "client"
  | "how_you_work"
  | "voice"
  | "look"
  | "website";

export type StepDef = {
  id: StepId;
  /** 1-indexé, aligné sur `project_briefs.progress_step`. */
  number: number;
  eyebrow: string;
  question: string;
  helper: string;
  /** Une étape facultative porte « Skip for now ». */
  optional: boolean;
};

export const STEPS: StepDef[] = [
  {
    id: "practice",
    number: 1,
    eyebrow: "Your practice",
    question: "What should we call your practice?",
    helper:
      "Your license and your specialties shape how the site introduces you. City and state are optional.",
    optional: false,
  },
  {
    id: "positioning",
    number: 2,
    eyebrow: "Positioning",
    question: "What are your clients carrying when they call?",
    helper:
      "Pick what fits, or write it your way. This becomes the line under your headline.",
    optional: false,
  },
  {
    id: "client",
    number: 3,
    eyebrow: "Ideal client",
    question: "Who do you most want to hear from?",
    helper: "Choose up to three. Naming who you serve is allowed; diagnosing them is not.",
    optional: false,
  },
  {
    id: "how_you_work",
    number: 4,
    eyebrow: "How you work",
    question: "How you work.",
    helper:
      "These are clinical questions, not marketing ones. Answer them the way you'd answer a colleague.",
    optional: false,
  },
  {
    id: "voice",
    number: 5,
    eyebrow: "Voice & tone",
    question: "Which of these sounds like you?",
    helper:
      "Each one is a real headline. Pick the voice, not the words — we'll write the rest.",
    optional: false,
  },
  {
    id: "look",
    number: 6,
    eyebrow: "Look",
    question: "Which of these feels like your practice?",
    helper:
      "Sage and dusty blue are the directory default. Standing apart is allowed.",
    optional: false,
  },
  {
    id: "website",
    number: 7,
    eyebrow: "Website",
    question: "What does the site need to do?",
    helper:
      "The primary action is the button that appears in your header and under your headline.",
    optional: true,
  },
];

export function stepByNumber(number: number): StepDef {
  return STEPS[Math.min(STEP_COUNT, Math.max(1, number)) - 1];
}

/*
 * L'ÉTAPE DU PRATICIEN. `project_briefs.progress_step` est canonique (§0.5) :
 * c'est la seule valeur lue pour savoir où il en est.
 * `projects.current_step` existe encore et dérive — on ne le lit pas, on ne
 * l'écrit pas, et on ne le « synchronise » surtout pas.
 */
export function resumeStep(brief: Pick<BriefRow, "progress_step">): number {
  return Math.min(STEP_COUNT, Math.max(1, brief.progress_step));
}

/* ── Validation ─────────────────────────────────────────────────────────── */

/**
 * Le minimum de l'étape 2 : au moins une carte, ou 40 caractères écrits.
 *
 * Le seuil est là pour refuser un « ok » — pas pour exiger un paragraphe. Une
 * réponse trop courte ne bloque pas durement : elle affiche une ligne qui dit
 * ce qui manque.
 */
export const POSITIONING_MIN_CHARS = 40;

export type StepDraft = {
  practice_name: string | null;
  license_type_id: string | null;
  specialty_ids: string[];
  city: string | null;
  state: string | null;
  positioning: string | null;
  problem_card_ids: string[];
  gain_card_ids: string[];
  client_persona_ids: string[];
  /* Étape 4 — « How you work » (contrat §9.2). */
  session_style_ids: string[];
  not_a_fit_ids: string[];
  not_a_fit_text: string | null;
  modality_ids: string[];
  modality_prominence: string | null;
  referral_quote: string | null;
  prior_career: string | null;
  prior_career_public: boolean;
  tone_card_id: string | null;
  palette_family_ids: string[];
  type_pairing_id: string | null;
  primary_action_id: string | null;
  site_goal_ids: string[];
  /* Écran de positionnement — pas une étape du brief, mais son texte édité vit
     sur la même ligne que le reste. `usp_options` (généré) n'est PAS ici :
     lui seul se lit directement sur `brief.usp_options`, jamais patché. */
  usp_statement: string | null;
  selected_usp_id: string | null;
  data: BriefData;
};

/**
 * Ce qui manque à une étape pour être validée, en une phrase qui dit quoi
 * faire. `null` quand l'étape est bonne.
 *
 * `generatedToneCards` est ce que l'étape 5 MONTRE quand la génération a
 * abouti (§2.2) — voir le commentaire du `case "voice"`, qui est la seule
 * raison pour laquelle ce paramètre existe. `null` = l'étape montre le
 * catalogue statique, ce qui est aussi l'état par défaut d'un appelant qui ne
 * valide pas l'étape 5.
 */
export function stepIssue(
  step: StepId,
  draft: StepDraft,
  generatedToneCards: ToneCards | null = null,
  /*
   * La matrice titre/État, pour l'étape 1. Vide par défaut : un appelant qui
   * ne la passe pas ne fait alors AUCUNE vérification de couple, plutôt que de
   * tous les refuser — ce module n'est pas l'autorité, et un refus qu'il
   * inventerait serait un mur sans explication.
   */
  licenseTypeStates: LicenseTypeState[] = []
): string | null {
  switch (step) {
    case "practice":
      if (!draft.practice_name?.trim()) {
        return "Give your practice a name — your own name works.";
      }
      if (!draft.license_type_id) {
        return "Pick your license type so the site states it correctly.";
      }
      if (draft.specialty_ids.length === 0) {
        return "Choose at least one specialty.";
      }
      /*
       * ⚠ LE COUPLE TITRE/ÉTAT, ET IL VIENT EN DERNIER À DESSEIN. Les trois
       * conditions au-dessus disent « il manque quelque chose » ; celle-ci dit
       * « ce que tu as répondu ne peut pas être vrai », ce qui est une autre
       * phrase et un autre moment.
       *
       * `catalog` n'entre PAS dans ce module : il ne porte aucun contenu (§6).
       * La matrice arrive donc par `licenseTypeStates`, comme les cartes
       * générées arrivent à l'étape 5 — même forme, même raison.
       *
       * Et ce n'est pas l'autorité : `project_briefs_license_state_gate`
       * refuse en base. Ceci est ce qui l'explique avant qu'elle ne s'y cogne.
       */
      if (
        !licenseAllowedInState(
          draft.license_type_id,
          draft.state,
          licenseTypeStates
        )
      ) {
        return "That title isn't issued in the state you gave. Pick the one you hold there.";
      }
      return null;

    case "positioning": {
      const written = (draft.data.problem_text ?? "").trim().length;
      const gained = (draft.data.gain_text ?? "").trim().length;
      const hasCards =
        draft.problem_card_ids.length > 0 || draft.gain_card_ids.length > 0;
      if (
        !hasCards &&
        written < POSITIONING_MIN_CHARS &&
        gained < POSITIONING_MIN_CHARS
      ) {
        return "Pick a card, or write a sentence or two — we need a little more to work from.";
      }
      return null;
    }

    case "client":
      if (draft.client_persona_ids.length === 0) {
        return "Choose at least one — up to three.";
      }
      return null;

    /*
     * ⚠ UNE SEULE CONDITION DÉSORMAIS, ET LA CITATION N'EN FAIT PLUS PARTIE.
     *
     * L'étape demandait AUSSI vingt caractères de citation de collègue. Mesurée
     * à 390px (`ACQUISITION_WALK.md` §9.1), cette étape fait 3 572px — cinq
     * écrans et demi — et se terminait par la question la plus difficile du
     * parcours : composer une phrase dans la voix de quelqu'un d'autre.
     *
     * C'était la SEULE exigence de texte libre bloquante du brief, et rien en
     * aval n'échoue sans elle : la génération lit `referral_quote` quand elle
     * existe et s'en passe quand elle n'existe pas, exactement comme des huit
     * autres champs facultatifs de cette étape.
     *
     * Cinq écrans et demi de défilement suivis d'un mur d'écriture, sur un
     * téléphone, le soir, est la forme même d'un abandon.
     */
    case "how_you_work": {
      if (draft.session_style_ids.length === 0) {
        return "Choose at least one — how session usually looks.";
      }
      return null;
    }

    /*
     * ⚠ DEUX ENDROITS OÙ LE CHOIX PEUT VIVRE, ET UN SEUL ÉTAIT LU.
     *
     * L'étape 5 a deux modes. Quand la génération aboutit — le cas NORMAL —
     * elle montre six cartes écrites dans sa voix, dont les `id` sont des
     * slugs inventés par le modèle (« grounded-direct »). Ceux-là ne peuvent
     * PAS aller dans `tone_card_id` : la colonne porte
     * `project_briefs_tone_card_id_fkey` vers `tone_cards(id)`, et
     * `findUnknownCatalogId` les refuserait avant même la base. Ils vivent
     * donc dans `data.selected_tone_card_id`, et `selectGenerated()` met
     * `tone_card_id` à null exprès.
     *
     * Cette validation ne lisait que `tone_card_id`. Résultat : elle cochait
     * la carte, le rail reprenait son titre (`applyOptimistic` lit BIEN la
     * carte générée), et « Continue » répondait quand même « Pick the one
     * that sounds most like you ». Le seul chemin qui marchait était le repli
     * statique — celui qu'on ne voit que quand la génération échoue.
     *
     * ⚠ ET LA QUESTION EST « CE QUI EST À L'ÉCRAN », PAS « UNE DES DEUX ».
     * Un `tone_card_id || selected_tone_card_id` permissif validerait une
     * sélection PÉRIMÉE : rééditer l'étape 4 change
     * `tone_cards_inputs_hash`, six cartes neuves arrivent avec des id neufs,
     * et l'ancien `selected_tone_card_id` ne correspond plus à rien
     * d'affiché. L'étape passerait avec zéro carte cochée — un état que rien
     * à l'écran n'expliquerait.
     */
    case "voice": {
      const pick = "Pick the one that sounds most like you.";
      if (generatedToneCards) {
        const chosen = draft.data.selected_tone_card_id;
        return chosen && generatedToneCards.some((card) => card.id === chosen)
          ? null
          : pick;
      }
      return draft.tone_card_id ? null : pick;
    }

    /* Fusion de l'ancien « palette » et de l'ancien « typography » (§9.7). */
    case "look":
      if (draft.palette_family_ids.length === 0) {
        return "Pick at least one. Your first pick leads the preview.";
      }
      return draft.type_pairing_id ? null : "Pick a pairing.";

    case "website":
      // Étape facultative : elle porte « Skip for now », donc rien n'y bloque.
      return null;
  }
}

/** Fusionne l'étape franchie dans `completed_steps`, sans doublon ni trou. */
export function withCompletedStep(
  completed: number[],
  step: number
): number[] {
  return Array.from(new Set([...completed, step])).sort((a, b) => a - b);
}
