import type { BriefData } from "@/lib/data/brief";
import type { BriefRow } from "@/lib/data/brief";

/*
 * Les sept étapes du brief — cadrage, validation, avancement.
 *
 * Ce module ne porte AUCUN contenu de catalogue : les cartes de ton, les
 * familles de palette, les paires typographiques, les personas, les licences
 * et les spécialités sont lus en base (§6). Il ne porte que ce qui est
 * structurel : la question posée, ce qu'elle écrit, et ce qui la rend valide.
 */

export const STEP_COUNT = 7;

export type StepId =
  | "practice"
  | "positioning"
  | "client"
  | "voice"
  | "palette"
  | "typography"
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
    id: "voice",
    number: 4,
    eyebrow: "Voice & tone",
    question: "Which of these sounds like you?",
    helper:
      "Each one is a real headline. Pick the voice, not the words — we'll write the rest.",
    optional: false,
  },
  {
    id: "palette",
    number: 5,
    eyebrow: "Palette",
    question: "Which of these feels like your practice?",
    helper:
      "Sage and dusty blue are the directory default. Standing apart is allowed.",
    optional: false,
  },
  {
    id: "typography",
    number: 6,
    eyebrow: "Typography",
    question: "Which pairing reads like your practice?",
    helper: "Your name is set in the heading face, your pages in the body face.",
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
  tone_card_id: string | null;
  palette_family_ids: string[];
  type_pairing_id: string | null;
  primary_action_id: string | null;
  site_goal_ids: string[];
  data: BriefData;
};

/**
 * Ce qui manque à une étape pour être validée, en une phrase qui dit quoi
 * faire. `null` quand l'étape est bonne.
 */
export function stepIssue(step: StepId, draft: StepDraft): string | null {
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

    case "voice":
      return draft.tone_card_id ? null : "Pick the one that sounds most like you.";

    case "palette":
      return draft.palette_family_ids.length > 0
        ? null
        : "Pick at least one. Your first pick leads the preview.";

    case "typography":
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
