/**
 * The 7-step guided brief, specialized for licensed clinicians in US private
 * practice.
 *
 * The definition is data, not markup: the UI renders whatever is described
 * here, so adding a field never means touching a component. Two things the
 * rest of the app depends on:
 *
 *  - `licenseType` + `specialties` replace the old generic trade field. They
 *    drive the generation prompt and, later, the SEO niche pages.
 *  - `requiredWhen` lets "Other" free-text fields be conditionally required
 *    without special-casing them in the form component.
 *
 * American English throughout. Font names in the typography step are proper
 * nouns and stay as written.
 */

export type BriefStepId =
  | "practice"
  | "positioning"
  | "ideal_client"
  | "voice"
  | "palette"
  | "typography"
  | "website";

export type BriefOption = {
  value: string;
  label: string;
  /** Shown under the label for choices that need a nudge. */
  description?: string;
  /** Swatch color for palette families. */
  swatch?: string;
  /**
   * CSS font stack used to render a typography option in its own typeface.
   * Only build-time-loaded families (Fraunces, Inter, IBM Plex Mono) and
   * generic/OS stacks — nothing is fetched at runtime.
   */
  sampleFont?: string;
};

export type BriefSlider = {
  name: string;
  leftLabel: string;
  rightLabel: string;
};

export type BriefField =
  | {
      kind: "text" | "textarea";
      name: string;
      label: string;
      hint?: string;
      placeholder?: string;
      required?: boolean;
      requiredWhen?: { field: string; equals: string };
    }
  | {
      kind: "single-choice";
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      options: BriefOption[];
    }
  | {
      kind: "multi-choice" | "swatches" | "typefaces";
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      options: BriefOption[];
      minSelect?: number;
      maxSelect?: number;
    }
  | {
      kind: "sliders";
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      sliders: BriefSlider[];
    };

export type BriefStep = {
  id: BriefStepId;
  /** Shown in the progress rail. */
  title: string;
  /** The one warm framing question that opens the step. */
  question: string;
  fields: BriefField[];
};

export const BRIEF_STEPS: BriefStep[] = [
  // 1 -------------------------------------------------------------------------
  {
    id: "practice",
    title: "Your practice",
    question: "Tell us about your practice.",
    fields: [
      {
        kind: "text",
        name: "practiceName",
        label: "Practice name",
        placeholder: "Still Water Counseling",
        required: true,
      },
      {
        kind: "single-choice",
        name: "licenseType",
        label: "License type",
        required: true,
        options: [
          { value: "therapist", label: "Therapist (generalist)" },
          { value: "lpc", label: "LPC (counselor)" },
          { value: "lmft", label: "LMFT (marriage & family)" },
          { value: "psychologist", label: "Psychologist" },
          { value: "lcsw", label: "LCSW (clinical social worker)" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "text",
        name: "licenseTypeOther",
        label: "Your license type",
        hint: "We state credentials exactly as you write them here.",
        placeholder: "LMHC, PsyD, LPCC…",
        requiredWhen: { field: "licenseType", equals: "other" },
      },
      {
        kind: "multi-choice",
        name: "specialties",
        label: "Specialty focus",
        hint: "Pick everything that genuinely describes your caseload.",
        required: true,
        minSelect: 1,
        options: [
          { value: "anxiety", label: "Anxiety" },
          { value: "trauma_emdr", label: "Trauma & EMDR" },
          { value: "couples", label: "Couples" },
          { value: "child_teen", label: "Child & teen" },
          { value: "depression", label: "Depression" },
          { value: "grief", label: "Grief" },
          { value: "addiction", label: "Addiction" },
          { value: "identity_lgbtq", label: "Identity / LGBTQ+" },
          { value: "other", label: "Other" },
        ],
      },
      {
        kind: "textarea",
        name: "offering",
        label: "What you offer",
        hint: "The concrete service, not the philosophy.",
        placeholder:
          "Individual therapy, weekly. Couples intensives one weekend a month.",
        required: true,
      },
      {
        kind: "single-choice",
        name: "stage",
        label: "Stage",
        required: true,
        options: [
          {
            value: "launching",
            label: "Launching",
            description: "Opening the practice, or close to it.",
          },
          {
            value: "restructuring",
            label: "Restructuring",
            description: "The practice exists but needs to change shape.",
          },
          {
            value: "premiumizing",
            label: "Premiumizing",
            description: "Moving toward private pay.",
          },
        ],
      },
    ],
  },

  // 2 -------------------------------------------------------------------------
  {
    id: "positioning",
    title: "Positioning",
    question: "What makes your practice the right fit for the people you help?",
    fields: [
      {
        kind: "textarea",
        name: "problem",
        label: "Problem you help with",
        hint: "Describe it as a client situation, not a diagnosis label.",
        placeholder:
          "People who function well at work and fall apart the moment they get home.",
        required: true,
      },
      {
        kind: "textarea",
        name: "clientGain",
        label: "What the client gains",
        // The ethics layer enforces the hard rule; this hint gets the user to
        // write compliant source material in the first place.
        hint: "Describe the direction of the work, not a guaranteed result. We cannot promise outcomes on your behalf, and neither can your website.",
        placeholder:
          "A clearer sense of what the anxiety has been doing for them, and more room to choose.",
        required: true,
      },
      {
        kind: "textarea",
        name: "alternatives",
        label: "What clients do instead today",
        hint: "Other therapists, directories, waiting it out.",
        placeholder:
          "Scrolling Psychology Today for a month and never sending the message.",
        required: true,
      },
      {
        kind: "textarea",
        name: "differentiator",
        label: "What sets you apart",
        placeholder:
          "I have sat in the same seat: fifteen years in tech before I retrained.",
        required: true,
      },
    ],
  },

  // 3 -------------------------------------------------------------------------
  {
    id: "ideal_client",
    title: "Ideal client",
    question: "Who do you most want to work with?",
    fields: [
      {
        kind: "textarea",
        name: "idealClient",
        label: "Your ideal client",
        hint: 'Aim for a situation rather than a diagnosis: "first-gen professionals with success guilt" beats "anxiety".',
        placeholder:
          "First-generation professionals who feel guilty for having made it.",
        required: true,
      },
      {
        kind: "single-choice",
        name: "decisionContext",
        label: "Decision context",
        hint: "How they usually arrive.",
        required: true,
        options: [
          { value: "in_crisis", label: "In crisis now" },
          { value: "long_considered", label: "Long-considered" },
          { value: "referred", label: "Referred by another provider" },
          { value: "directory", label: "Found via directory" },
        ],
      },
      {
        kind: "multi-choice",
        name: "hesitations",
        label: "Common hesitations",
        hint: "Up to three. Your website should answer these before they ask.",
        required: true,
        minSelect: 1,
        maxSelect: 3,
        options: [
          { value: "cost", label: "Cost" },
          { value: "will_they_get_me", label: "“Will they get me?”" },
          { value: "time", label: "Time" },
          { value: "fear_of_judgment", label: "Fear of judgment" },
          {
            value: "tried_before",
            label: "Tried therapy before and it didn't help",
          },
          { value: "other", label: "Other" },
        ],
      },
    ],
  },

  // 4 -------------------------------------------------------------------------
  {
    id: "voice",
    title: "Voice & tone",
    question: "How should your practice sound?",
    fields: [
      {
        kind: "sliders",
        name: "toneSliders",
        label: "Find your register",
        hint: "There is no right answer. Put each slider where your practice actually sits.",
        required: true,
        sliders: [
          { name: "reservedExpressive", leftLabel: "Reserved", rightLabel: "Expressive" },
          { name: "warmClinical", leftLabel: "Warm", rightLabel: "Clinical" },
          { name: "classicContemporary", leftLabel: "Classic", rightLabel: "Contemporary" },
          { name: "minimalRich", leftLabel: "Minimal", rightLabel: "Rich" },
        ],
      },
      {
        kind: "multi-choice",
        name: "feelings",
        label: "Feelings to convey",
        hint: "Choose exactly three.",
        required: true,
        minSelect: 3,
        maxSelect: 3,
        options: [
          { value: "trust", label: "Trust" },
          { value: "calm", label: "Calm" },
          { value: "safety", label: "Safety" },
          { value: "steadiness", label: "Steadiness" },
          { value: "warmth", label: "Warmth" },
          { value: "clarity", label: "Clarity" },
          { value: "hope", label: "Hope" },
          { value: "groundedness", label: "Groundedness" },
          { value: "quiet_authority", label: "Quiet authority" },
        ],
      },
      {
        kind: "textarea",
        name: "avoid",
        label: "Avoid",
        hint: "Words and postures to keep out. The ethics layer already blocks outcome promises and testimonials — this is for your own preferences.",
        placeholder:
          "No “journey”, no lotus flowers, nothing that sounds like a wellness retreat.",
      },
    ],
  },

  // 5 -------------------------------------------------------------------------
  {
    id: "palette",
    title: "Palette",
    question: "Which colors feel like your practice?",
    fields: [
      {
        kind: "swatches",
        name: "colorFamilies",
        label: "Color families",
        hint: "One to three. A gentle note: sage and dusty blue are the directory default. Standing out is allowed.",
        required: true,
        minSelect: 1,
        maxSelect: 3,
        options: [
          { value: "warm_neutrals", label: "Warm neutrals", swatch: "#E4D9C8" },
          { value: "cool_neutrals", label: "Cool neutrals", swatch: "#D6DADD" },
          { value: "earth_ochre", label: "Earth & ochre", swatch: "#C08A4A" },
          { value: "natural_greens", label: "Natural greens", swatch: "#6E8B6A" },
          { value: "deep_blues", label: "Deep blues", swatch: "#2B4162" },
          { value: "soft_pastels", label: "Soft pastels", swatch: "#EBC9CE" },
          { value: "muted_plum_slate", label: "Muted plum & slate", swatch: "#6B5B72" },
          { value: "monochrome", label: "Monochrome", swatch: "#2A2A2A" },
        ],
      },
      {
        kind: "single-choice",
        name: "contrast",
        label: "Contrast level",
        required: true,
        options: [
          { value: "soft", label: "Soft" },
          { value: "balanced", label: "Balanced" },
          { value: "defined", label: "Defined" },
        ],
      },
      {
        kind: "text",
        name: "colorsToAvoid",
        label: "Colors to avoid",
        placeholder: "Anything close to hospital teal.",
      },
      {
        kind: "textarea",
        name: "admiredWorlds",
        label: "Admired worlds",
        hint: "Brands, places, objects whose mood resonates. They do not have to be therapy-related.",
        placeholder:
          "Aesop stores, my grandmother's reading room, the Criterion Collection.",
      },
    ],
  },

  // 6 -------------------------------------------------------------------------
  {
    id: "typography",
    title: "Typography",
    question: "What character for your words?",
    fields: [
      {
        kind: "typefaces",
        name: "typeStyle",
        label: "Type style",
        hint: "Each option is shown in its own kind of typeface.",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            value: "editorial_serif",
            label: "Editorial serif",
            sampleFont: "var(--font-display), Georgia, serif",
          },
          {
            value: "neutral_sans",
            label: "Neutral sans",
            sampleFont: "var(--font-sans), Helvetica, Arial, sans-serif",
          },
          {
            value: "geometric_sans",
            label: "Geometric sans",
            sampleFont: "Futura, 'Century Gothic', 'Avant Garde', sans-serif",
          },
          {
            value: "serif_sans_pairing",
            label: "Serif + sans pairing",
            sampleFont: "var(--font-display), Georgia, serif",
          },
          {
            value: "distinctive_display",
            label: "Distinctive display",
            sampleFont: "'Didot', 'Bodoni MT', 'Playfair Display', serif",
          },
        ],
      },
      {
        kind: "single-choice",
        name: "characterLevel",
        label: "Character level",
        required: true,
        options: [
          { value: "understated", label: "Understated" },
          { value: "confident", label: "Confident" },
          { value: "singular", label: "Singular" },
        ],
      },
    ],
  },

  // 7 -------------------------------------------------------------------------
  {
    id: "website",
    title: "Your website",
    question: "What should your website do?",
    fields: [
      {
        kind: "single-choice",
        name: "siteGoal",
        label: "Site goal",
        hint: "The one job it has to do.",
        required: true,
        options: [
          { value: "book_consultations", label: "Book consultations" },
          { value: "explain_approach", label: "Explain your approach" },
          { value: "collect_inquiries", label: "Collect inquiries" },
          { value: "establish_credibility", label: "Establish credibility" },
        ],
      },
      {
        kind: "text",
        name: "primaryAction",
        label: "Primary action",
        hint: "The exact button text.",
        placeholder: "Book a consultation",
        required: true,
      },
      {
        kind: "multi-choice",
        name: "pages",
        label: "Pages wanted",
        hint: "We write finished copy for every page you pick here.",
        required: true,
        minSelect: 1,
        options: [
          { value: "home", label: "Home" },
          { value: "about", label: "About" },
          { value: "approach", label: "Approach" },
          { value: "specialties", label: "Specialties" },
          { value: "fees", label: "Fees" },
          { value: "faq", label: "FAQ" },
          { value: "contact", label: "Contact" },
          { value: "blog", label: "Blog" },
        ],
      },
      {
        kind: "multi-choice",
        name: "proof",
        label: "Available proof",
        // Not a UI preference: publishing client testimonials is prohibited for
        // this audience, so the option does not exist at all.
        hint: "Client testimonials are intentionally excluded — soliciting or publishing them breaks ACA and APA advertising rules. These are the alternatives that carry the same weight.",
        required: true,
        minSelect: 1,
        options: [
          { value: "credentials", label: "Credentials" },
          { value: "training", label: "Training & certifications" },
          { value: "publications", label: "Publications" },
          { value: "affiliations", label: "Professional affiliations" },
          { value: "none", label: "None yet" },
        ],
      },
      {
        kind: "textarea",
        name: "constraints",
        label: "Constraints",
        hint: "Anything the site has to work around.",
        placeholder:
          "Has to run on Squarespace — my biller already integrates with it.",
      },
    ],
  },
];

export const BRIEF_STEP_IDS = BRIEF_STEPS.map((s) => s.id);

export function getBriefStep(id: string): BriefStep | undefined {
  return BRIEF_STEPS.find((step) => step.id === id);
}

export function getBriefStepIndex(id: BriefStepId): number {
  return BRIEF_STEPS.findIndex((step) => step.id === id);
}

/** Values a field can hold once saved. Sliders store one number per slider. */
export type BriefAnswerValue =
  | string
  | string[]
  | Record<string, number>
  | undefined;

export type BriefAnswer = Record<string, BriefAnswerValue>;

/** All saved answers, keyed by step id. */
export type BriefAnswers = Partial<Record<BriefStepId, BriefAnswer>>;

/**
 * Whether a field must be filled given the rest of the step's answers.
 * Conditional requirements ("Other" free text) resolve here so the form
 * component stays generic.
 */
export function isFieldRequired(
  field: BriefField,
  answer: BriefAnswer
): boolean {
  if (field.kind !== "text" && field.kind !== "textarea") {
    return Boolean(field.required);
  }
  if (field.required) return true;
  if (!field.requiredWhen) return false;

  const dependency = answer[field.requiredWhen.field];
  if (typeof dependency === "string") {
    return dependency === field.requiredWhen.equals;
  }
  if (Array.isArray(dependency)) {
    return dependency.includes(field.requiredWhen.equals);
  }
  return false;
}

function isFieldSatisfied(field: BriefField, answer: BriefAnswer): boolean {
  if (!isFieldRequired(field, answer)) return true;

  const value = answer[field.name];

  switch (field.kind) {
    case "text":
    case "textarea":
      return typeof value === "string" && value.trim().length > 0;

    case "single-choice":
      return typeof value === "string" && value.length > 0;

    case "multi-choice":
    case "swatches":
    case "typefaces": {
      if (!Array.isArray(value)) return false;
      const min = field.minSelect ?? 1;
      const max = field.maxSelect ?? Number.POSITIVE_INFINITY;
      return value.length >= min && value.length <= max;
    }

    case "sliders":
      // Sliders always carry a usable default, so presence is enough.
      return typeof value === "object" && value !== null;
  }
}

/** Field names that are required and still empty. Empty array = step is done. */
export function missingRequiredFields(
  step: BriefStep,
  answer: BriefAnswer
): string[] {
  return step.fields
    .filter((field) => !isFieldSatisfied(field, answer))
    .map((field) => field.name);
}

export function isStepComplete(step: BriefStep, answer: BriefAnswer): boolean {
  return missingRequiredFields(step, answer).length === 0;
}

export function isBriefComplete(answers: BriefAnswers): boolean {
  return BRIEF_STEPS.every((step) =>
    isStepComplete(step, answers[step.id] ?? {})
  );
}

/** The first step still missing a required answer — where Resume should land. */
export function firstIncompleteStep(answers: BriefAnswers): BriefStepId | null {
  const step = BRIEF_STEPS.find(
    (s) => !isStepComplete(s, answers[s.id] ?? {})
  );
  return step ? step.id : null;
}

/** Default slider positions: dead center, so an untouched slider means nothing. */
export function defaultSliderValues(field: BriefField): Record<string, number> {
  if (field.kind !== "sliders") return {};
  return Object.fromEntries(field.sliders.map((s) => [s.name, 50]));
}

// ---------------------------------------------------------------------------
// Label lookup — used by the generation prompt and the brand-sheet preview so
// the model reads "Trauma & EMDR", not "trauma_emdr".
// ---------------------------------------------------------------------------

const OPTION_LABELS: Record<string, string> = Object.fromEntries(
  BRIEF_STEPS.flatMap((step) =>
    step.fields.flatMap((field) =>
      "options" in field
        ? field.options.map((o) => [`${field.name}:${o.value}`, o.label])
        : []
    )
  )
);

export function optionLabel(fieldName: string, value: string): string {
  return OPTION_LABELS[`${fieldName}:${value}`] ?? value;
}

const OPTION_SWATCHES: Record<string, string> = Object.fromEntries(
  BRIEF_STEPS.flatMap((step) =>
    step.fields.flatMap((field) =>
      "options" in field
        ? field.options
            .filter((o) => Boolean(o.swatch))
            .map((o) => [`${field.name}:${o.value}`, o.swatch as string])
        : []
    )
  )
);

export function optionSwatch(
  fieldName: string,
  value: string
): string | undefined {
  return OPTION_SWATCHES[`${fieldName}:${value}`];
}

export function optionLabels(fieldName: string, values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === "string")
    .map((v) => optionLabel(fieldName, v));
}
