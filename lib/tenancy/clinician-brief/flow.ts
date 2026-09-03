/*
 * Lot D5 — the clinician brief's seven screens.
 *
 * This is a SEPARATE, purpose-built flow for clinician_profiles, not a
 * parameterization of lib/brief/flow.ts (project_briefs). It follows the
 * same conventions deliberately — one question per screen, `stepIssue`
 * returning a sentence instead of a boolean, no catalog content living
 * here — because that is what "reusing the existing brief's step pattern"
 * means: the UX contract, not the project_briefs-specific types.
 *
 * ONE DELIBERATE DIFFERENCE: project_briefs persists progress_step and
 * completed_steps columns; clinician_profiles has neither (not in lot C2's
 * specified column list, and adding one would mean editing an already-
 * committed migration or inventing a column the brief never asked for).
 * Progress here is DERIVED from the data itself on every load — the first
 * screen with an unresolved stepIssue is where you resume — rather than
 * stored. See resumeStep() below.
 */

export const STEP_COUNT = 7;

export type StepId =
  | "identity"
  | "licensed_states"
  | "modalities"
  | "populations"
  | "philosophy"
  | "practicalities"
  | "review";

export type StepDef = {
  id: StepId;
  number: number;
  eyebrow: string;
  question: string;
  helper: string;
  optional: boolean;
};

export const STEPS: StepDef[] = [
  {
    id: "identity",
    number: 1,
    eyebrow: "You",
    question: "How should clients see your name?",
    helper:
      "Your name and credentials as you want them to read on your bio. If you're a supervised intern, name your supervisor, or leave it to use the practice default.",
    optional: false,
  },
  {
    id: "licensed_states",
    number: 2,
    eyebrow: "Where you're licensed",
    question: "Which states are you licensed in?",
    helper: "Clients search by state. Add every state you can see clients in.",
    optional: false,
  },
  {
    id: "modalities",
    number: 3,
    eyebrow: "How you work",
    question: "What modalities do you use?",
    helper: "Pick what you actually practice. You can set how much to lead with each one.",
    optional: false,
  },
  {
    id: "populations",
    number: 4,
    eyebrow: "Who you work with",
    question: "Who do you work with?",
    helper:
      "A separate question from modalities on purpose — how you work and who you work with are two different things clients search for.",
    optional: false,
  },
  {
    id: "philosophy",
    number: 5,
    eyebrow: "Your philosophy",
    question: "In a sentence or two, how do you approach the work?",
    helper: "Your own words, first person. This is the line that makes your bio read as written by you, not generated.",
    optional: false,
  },
  {
    id: "practicalities",
    number: 6,
    eyebrow: "The practical stuff",
    question: "Anything else worth knowing?",
    helper:
      "Outside the room, a personal note, your rate, a booking link, whether you have a photo on file — all optional, all things clients ask about.",
    optional: true,
  },
  {
    id: "review",
    number: 7,
    eyebrow: "Review",
    question: "Here's your profile.",
    helper: "Your brand — colors, logo, typography — is set by your practice and shown here as inherited, not asked again.",
    optional: false,
  },
];

export function stepByNumber(number: number): StepDef {
  return STEPS[Math.min(STEP_COUNT, Math.max(1, number)) - 1];
}

export type ClinicianStatus = "licensed" | "associate" | "supervised_intern";

export type ClinicianStepDraft = {
  fullName: string;
  credentials: string | null;
  status: ClinicianStatus;
  supervisorName: string | null;
  stateCodes: string[];
  modalities: { modalityId: string; prominence: string | null }[];
  populationIds: string[];
  philosophyQuote: string | null;
  outsideTheRoom: string | null;
  personalityNote: string | null;
  sessionRateCents: number | null;
  rateIsPublic: boolean;
  bookingUrl: string | null;
  photoProvided: boolean;
  acceptingClients: boolean;
};

/**
 * What is missing for a screen to be considered answered, as a sentence —
 * `null` when it's fine. Deliberately the SAME blocking conditions
 * clinician_profile_completeness() checks server-side (credentials,
 * licensed_states, modalities, populations, philosophy_quote, and a
 * supervised_intern's effective supervisor) so a screen this flow lets you
 * pass is never one the dashboard still lists as blocking.
 */
export function stepIssue(
  step: StepId,
  draft: ClinicianStepDraft,
  hasOrgDefaultSupervisor: boolean
): string | null {
  switch (step) {
    case "identity":
      if (!draft.fullName.trim()) return "Add your name.";
      if (!draft.credentials?.trim()) return "Add your credentials — e.g. LPC-MHSP, LMFT.";
      if (
        draft.status === "supervised_intern" &&
        !draft.supervisorName?.trim() &&
        !hasOrgDefaultSupervisor
      ) {
        return "Name your supervisor — your practice hasn't set a default one.";
      }
      return null;

    case "licensed_states":
      return draft.stateCodes.length > 0 ? null : "Add at least one state.";

    case "modalities":
      return draft.modalities.length > 0 ? null : "Choose at least one modality.";

    case "populations":
      return draft.populationIds.length > 0 ? null : "Choose at least one.";

    case "philosophy":
      return draft.philosophyQuote?.trim() ? null : "Write a sentence or two, in your own words.";

    case "practicalities":
      // Optional screen: "Skip for now" is always available.
      return null;

    case "review":
      return null;
  }
}

/**
 * The furthest screen the current data supports resuming at: the first
 * screen (in order) with an unresolved stepIssue, or the review screen if
 * every prior screen already passes.
 */
export function resumeStep(
  draft: ClinicianStepDraft,
  hasOrgDefaultSupervisor: boolean
): number {
  for (const step of STEPS) {
    if (step.id === "review") break;
    if (stepIssue(step.id, draft, hasOrgDefaultSupervisor)) return step.number;
  }
  return STEP_COUNT;
}

export const EMPTY_CLINICIAN_DRAFT: ClinicianStepDraft = {
  fullName: "",
  credentials: null,
  status: "licensed",
  supervisorName: null,
  stateCodes: [],
  modalities: [],
  populationIds: [],
  philosophyQuote: null,
  outsideTheRoom: null,
  personalityNote: null,
  sessionRateCents: null,
  rateIsPublic: false,
  bookingUrl: null,
  photoProvided: false,
  acceptingClients: true,
};
