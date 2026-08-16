import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { GENERATION_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefAnswers } from "@/lib/brief/steps";
import type { DirectionPalette, DirectionTypography } from "@/types/database";

/**
 * Generates the three creative directions.
 *
 * Mechanism: prompt assembly -> a single forced tool -> strict schema ->
 * post-hoc structural validation -> ethics validation -> replace-not-append on
 * save. The schema and the code both insist on exactly three because the API's
 * JSON Schema subset has no array-length constraints; the schema description
 * asks for three and `validateDirections` enforces it.
 */

export type GeneratedDirection = {
  name: string;
  description: string;
  palette: DirectionPalette;
  typography: DirectionTypography;
};

export type DirectionsPayload = { directions: GeneratedDirection[] };

export class DirectionsGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectionsGenerationError";
  }
}

const TOOL_NAME = "propose_directions";

/**
 * Strict tool use requires `additionalProperties: false` and a full `required`
 * list on every object. Deliberately no minItems/maxItems: the API's schema
 * subset rejects array-length constraints, so "exactly 3" lives in the
 * description and in validateDirections().
 */
const DIRECTIONS_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Return exactly three clearly differentiated creative directions for this practice.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      directions: {
        type: "array",
        description:
          "Exactly 3 directions. Not 2, not 4 — exactly 3, each a genuinely distinct personality.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The direction's name, 2 to 4 words. Evocative, never clinical jargon and never a slogan.",
            },
            description: {
              type: "string",
              description:
                "2 to 3 sentences describing the personality of this direction and who it would land with. This is user-facing copy: psychoeducation only, no promised outcomes, no testimonials, no superlatives.",
            },
            palette: {
              type: "object",
              description: "Five hex colors, each as #RRGGBB.",
              properties: {
                primary: { type: "string", description: "Primary color, #RRGGBB." },
                secondary: { type: "string", description: "Secondary color, #RRGGBB." },
                accent: { type: "string", description: "Accent color, #RRGGBB." },
                light_neutral: {
                  type: "string",
                  description: "Light neutral, usually the page background, #RRGGBB.",
                },
                dark_neutral: {
                  type: "string",
                  description: "Dark neutral, usually body text, #RRGGBB.",
                },
              },
              required: [
                "primary",
                "secondary",
                "accent",
                "light_neutral",
                "dark_neutral",
              ],
              additionalProperties: false,
            },
            typography: {
              type: "object",
              description:
                "Two real, existing typeface names. Use the actual font names (for example Fraunces, Inter, Lora) — never invent one.",
              properties: {
                headings: { type: "string", description: "Typeface for headings." },
                body: { type: "string", description: "Typeface for body text." },
              },
              required: ["headings", "body"],
              additionalProperties: false,
            },
          },
          required: ["name", "description", "palette", "typography"],
          additionalProperties: false,
        },
      },
    },
    required: ["directions"],
    additionalProperties: false,
  },
};

const HEX = /^#[0-9a-f]{6}$/i;

const PALETTE_KEYS: (keyof DirectionPalette)[] = [
  "primary",
  "secondary",
  "accent",
  "light_neutral",
  "dark_neutral",
];

/**
 * Structural gate. Runs before the ethics pass and before anything is saved, so
 * a malformed generation fails here rather than reaching the database.
 */
export function validateDirections(
  payload: unknown
): asserts payload is DirectionsPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new DirectionsGenerationError("The model returned no usable output.");
  }

  const directions = (payload as DirectionsPayload).directions;

  if (!Array.isArray(directions)) {
    throw new DirectionsGenerationError("The model did not return a list of directions.");
  }
  if (directions.length !== 3) {
    throw new DirectionsGenerationError(
      `Expected exactly 3 directions, got ${directions.length}.`
    );
  }

  directions.forEach((direction, index) => {
    const position = index + 1;

    if (!isNonEmptyString(direction?.name)) {
      throw new DirectionsGenerationError(`Direction ${position} has no name.`);
    }
    if (!isNonEmptyString(direction?.description)) {
      throw new DirectionsGenerationError(
        `Direction ${position} has no description.`
      );
    }

    const palette = direction?.palette;
    if (typeof palette !== "object" || palette === null) {
      throw new DirectionsGenerationError(`Direction ${position} has no palette.`);
    }
    for (const key of PALETTE_KEYS) {
      const value = palette[key];
      if (!isNonEmptyString(value) || !HEX.test(value)) {
        throw new DirectionsGenerationError(
          `Direction ${position} has an invalid ${key} color: ${String(value)}.`
        );
      }
    }

    const typography = direction?.typography;
    if (
      typeof typography !== "object" ||
      typography === null ||
      !isNonEmptyString(typography.headings) ||
      !isNonEmptyString(typography.body)
    ) {
      throw new DirectionsGenerationError(
        `Direction ${position} is missing a typeface name.`
      );
    }
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildDirectionsPrompt(answers: BriefAnswers): string {
  const brief = buildBriefContext(answers);

  return `You are an art director and brand strategist working with licensed
mental-health clinicians in US private practice. You are proposing three
creative directions for one practice, based on the brief below.

${ETHICS_SYSTEM_RULES}

THE BRIEF

${brief.text}

WHAT TO PROPOSE

Three directions, each a clearly different personality that a real person could
choose between — not three shades of the same idea. Let the contrast come from
this brief rather than a fixed formula: read where the tone sliders sit, which
color families were chosen, what the practitioner said to avoid, and which
worlds they admire, then pull in three genuinely different directions from
there. As a rough shape, one might be quieter and steadier, one warmer, one
more contemporary — but if the brief points somewhere else, follow the brief.

For each direction:

- A name of 2 to 4 words. Evocative, not a slogan, not clinical jargon.
- A description of 2 to 3 sentences: what the direction feels like and who it
  would land with. This text is shown to the practitioner and shapes their
  website, so it must be psychoeducational — describe the character of the
  work, never promise what therapy will produce.
- Five hex colors: primary, secondary, accent, light neutral, dark neutral.
  Honor the chosen color families as a strong steer, not a straitjacket, and
  stay away from anything the practitioner asked to avoid. Sage and dusty blue
  are the directory default — if you reach for them, have a reason.
- Two real typeface names, one for headings and one for body. Use fonts that
  actually exist and are available for web use. Never invent a font name.

Write in American English. Warm, grounded, specific. No hype, no startup
vocabulary, no words like "journey" or "unlock".`;
}

/**
 * One model call. `feedback` is empty on the first attempt and carries the
 * ethics correction on a retry — appended after the prompt so the original
 * instructions stay in place.
 */
async function callModel(prompt: string, feedback: string): Promise<unknown> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [DIRECTIONS_TOOL],
    // Forced: the only acceptable output is a well-formed tool call.
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: feedback ? `${prompt}\n\n${feedback}` : prompt,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new DirectionsGenerationError(
      "The model declined this request. Review the brief for anything that reads as a request for prohibited claims."
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === TOOL_NAME
  );

  if (!toolUse) {
    throw new DirectionsGenerationError(
      "The model did not return the directions tool call."
    );
  }

  return toolUse.input;
}

/**
 * Generates three ethics-clean directions or throws. Nothing partial is ever
 * returned — the caller can save whatever comes back.
 */
export async function generateDirections(
  answers: BriefAnswers
): Promise<GeneratedDirection[]> {
  const prompt = buildDirectionsPrompt(answers);

  const payload = await generateWithEthicsGuard<DirectionsPayload>({
    label: "directions",
    callModel: async (feedback) => {
      const raw = await callModel(prompt, feedback);
      return raw as DirectionsPayload;
    },
    validate: validateDirections,
    // Only the description is copy the practitioner could publish. Hex values
    // and font names are data, not prose.
    publishableStrings: (payload) =>
      payload.directions.flatMap((d) => [d.name, d.description]),
  });

  return payload.directions;
}
