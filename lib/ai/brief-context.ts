import {
  BRIEF_STEPS,
  optionLabel,
  optionLabels,
  type BriefAnswers,
} from "@/lib/brief/steps";

/**
 * Renders the brief into the plain-text block every generation prompt is built
 * from. One renderer, so directions and the brand kit are always working from
 * the same picture of the practice.
 *
 * Everything is resolved to its human label — the model reads
 * "Trauma & EMDR", never "trauma_emdr".
 */

export type BriefContext = {
  /** The formatted block to paste into a prompt. */
  text: string;
  /** Fields other code needs directly (page selection, tier gating, credentials). */
  practiceName: string;
  licenseLabel: string;
  specialties: string[];
  requestedPages: string[];
  primaryAction: string;
  proof: string[];
};

export function buildBriefContext(answers: BriefAnswers): BriefContext {
  const practice = answers.practice ?? {};
  const positioning = answers.positioning ?? {};
  const ideal = answers.ideal_client ?? {};
  const voice = answers.voice ?? {};
  const palette = answers.palette ?? {};
  const typography = answers.typography ?? {};
  const website = answers.website ?? {};

  const licenseValue = str(practice.licenseType);
  const licenseLabel =
    licenseValue === "other"
      ? str(practice.licenseTypeOther) || "Other"
      : licenseValue
        ? optionLabel("licenseType", licenseValue)
        : "Not stated";

  const practiceName = str(practice.practiceName) || "This practice";
  const specialties = optionLabels("specialties", practice.specialties);
  const requestedPages = optionLabels("pages", website.pages);
  const primaryAction = str(website.primaryAction);
  const proof = optionLabels("proof", website.proof);

  const lines: string[] = [
    "THE PRACTICE",
    `Practice name: ${practiceName}`,
    `License type: ${licenseLabel}`,
    `Specialty focus: ${list(specialties)}`,
    `What they offer: ${str(practice.offering) || "Not stated"}`,
    `Stage: ${labelOf("stage", practice.stage)}`,
    "",
    "POSITIONING",
    `The client situation they help with: ${str(positioning.problem) || "Not stated"}`,
    `Direction of the work (NOT a promised outcome): ${str(positioning.clientGain) || "Not stated"}`,
    `What clients do instead today: ${str(positioning.alternatives) || "Not stated"}`,
    `What sets them apart: ${str(positioning.differentiator) || "Not stated"}`,
    "",
    "IDEAL CLIENT",
    `Who they most want to work with: ${str(ideal.idealClient) || "Not stated"}`,
    `How that client arrives: ${labelOf("decisionContext", ideal.decisionContext)}`,
    `What holds them back: ${list(optionLabels("hesitations", ideal.hesitations))}`,
    "",
    "VOICE & TONE",
    ...renderSliders(voice.toneSliders),
    `Feelings to convey: ${list(optionLabels("feelings", voice.feelings))}`,
    `Personal preferences to avoid: ${str(voice.avoid) || "None given"}`,
    "",
    "PALETTE",
    `Color families that resonate: ${list(optionLabels("colorFamilies", palette.colorFamilies))}`,
    `Contrast level: ${labelOf("contrast", palette.contrast)}`,
    `Colors to avoid: ${str(palette.colorsToAvoid) || "None given"}`,
    `Admired worlds: ${str(palette.admiredWorlds) || "None given"}`,
    "",
    "TYPOGRAPHY",
    `Type style: ${list(optionLabels("typeStyle", typography.typeStyle))}`,
    `Character level: ${labelOf("characterLevel", typography.characterLevel)}`,
    "",
    "THE WEBSITE",
    `Site goal: ${labelOf("siteGoal", website.siteGoal)}`,
    `Primary action (exact button text): ${primaryAction || "Not stated"}`,
    `Pages requested: ${list(requestedPages)}`,
    `Proof available (testimonials deliberately excluded): ${list(proof)}`,
    `Constraints: ${str(website.constraints) || "None given"}`,
  ];

  return {
    text: lines.join("\n"),
    practiceName,
    licenseLabel,
    specialties,
    requestedPages,
    primaryAction,
    proof,
  };
}

/**
 * Slider positions are meaningless to the model as raw numbers, so each one is
 * rendered as a sentence leaning toward whichever pole it sits closest to.
 */
function renderSliders(value: unknown): string[] {
  const sliderField = BRIEF_STEPS.find((s) => s.id === "voice")?.fields.find(
    (f) => f.kind === "sliders"
  );
  if (sliderField?.kind !== "sliders") return [];

  const values = numbers(value);

  return sliderField.sliders.map((slider) => {
    const position = values[slider.name] ?? 50;
    const pole =
      position < 35
        ? `clearly ${slider.leftLabel.toLowerCase()}`
        : position < 45
          ? `leaning ${slider.leftLabel.toLowerCase()}`
          : position <= 55
            ? `balanced between ${slider.leftLabel.toLowerCase()} and ${slider.rightLabel.toLowerCase()}`
            : position <= 65
              ? `leaning ${slider.rightLabel.toLowerCase()}`
              : `clearly ${slider.rightLabel.toLowerCase()}`;

    return `${slider.leftLabel} vs ${slider.rightLabel}: ${pole} (${position}/100).`;
  });
}

function labelOf(fieldName: string, value: unknown): string {
  const raw = str(value);
  return raw ? optionLabel(fieldName, raw) : "Not stated";
}

function list(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not stated";
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numbers(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    )
  );
}
