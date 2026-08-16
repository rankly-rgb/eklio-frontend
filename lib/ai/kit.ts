import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { GENERATION_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefAnswers } from "@/lib/brief/steps";
import type { DirectionPalette, DirectionTypography } from "@/types/database";

/**
 * Turns a chosen direction into the full brand kit.
 *
 * Same mechanism as directions: one forced tool, strict schema, structural
 * validation, then the ethics guard over every publishable string. This is the
 * highest-volume publishable surface in the product — the About and Approach
 * pages are where outcome promises leak in, so `publishableStrings` deliberately
 * flattens every heading and body of every page rather than sampling.
 */

export type VoiceAndTone = {
  adjectives: string[];
  do_examples: string[];
  dont_examples: string[];
};

export type PageSection = {
  heading: string;
  body: string;
};

export type PageCopy = {
  page: string;
  sections: PageSection[];
};

export type SocialTemplate = {
  name: string;
  purpose: string;
  layout: string;
  example_caption: string;
};

export type KitContent = {
  positioning_statement: string;
  brand_story: string;
  voice_and_tone: VoiceAndTone;
  website_copy: PageCopy[];
  social_templates: SocialTemplate[];
  export_prompt: string;
};

export class KitGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KitGenerationError";
  }
}

/**
 * What this kit is allowed to include. Lot 4 derives it from the purchased
 * tier; the default here is the full deliverable.
 */
export type KitScope = {
  /** Page keys from the brief, already filtered to what the tier allows. */
  pages: string[];
  /** Social template specs are a Practice-tier and above deliverable. */
  includeSocialTemplates: boolean;
};

const TOOL_NAME = "compose_brand_kit";

const KIT_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Return the complete brand kit for this practice: positioning, brand story, voice guide, website copy for each requested page, social template specs, and a multi-platform site prompt.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      positioning_statement: {
        type: "string",
        description:
          "One or two sentences naming who this practice is for and what the work is. Psychoeducation only — no promised outcome.",
      },
      brand_story: {
        type: "string",
        description:
          "Two short paragraphs the practitioner could adapt for an About page: why this practice exists and how it works. First person, warm, specific, no promises.",
      },
      voice_and_tone: {
        type: "object",
        description: "The voice guide.",
        properties: {
          adjectives: {
            type: "array",
            description: "Exactly 3 adjectives describing the voice.",
            items: { type: "string" },
          },
          do_examples: {
            type: "array",
            description:
              "3 to 5 short example sentences written the way this practice should sound.",
            items: { type: "string" },
          },
          dont_examples: {
            type: "array",
            description:
              "3 to 5 short example sentences this practice should never write, each one a plausible near-miss rather than a caricature. These are illustrative only and must still never state an outcome promise as if it were acceptable.",
            items: { type: "string" },
          },
        },
        required: ["adjectives", "do_examples", "dont_examples"],
        additionalProperties: false,
      },
      website_copy: {
        type: "array",
        description:
          "One entry per requested page, in the order the pages were requested. Do not invent pages that were not requested.",
        items: {
          type: "object",
          properties: {
            page: {
              type: "string",
              description:
                "The page key exactly as given in the request (home, about, approach, specialties, fees, faq, contact, blog).",
            },
            sections: {
              type: "array",
              description:
                "The page's sections in order, each with a heading and finished body copy.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Section heading." },
                  body: {
                    type: "string",
                    description:
                      "Finished, publishable body copy for this section. Plain prose, no placeholders, no lorem ipsum.",
                  },
                },
                required: ["heading", "body"],
                additionalProperties: false,
              },
            },
          },
          required: ["page", "sections"],
          additionalProperties: false,
        },
      },
      social_templates: {
        type: "array",
        description:
          "Specs for reusable branded social templates. Return an empty array if social templates were not requested.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Template name." },
            purpose: {
              type: "string",
              description: "What this template is for and when to use it.",
            },
            layout: {
              type: "string",
              description:
                "Layout spec: composition, which palette colors go where, which typeface at which weight and rough size.",
            },
            example_caption: {
              type: "string",
              description:
                "One example caption in the practice's voice. Publishable copy — psychoeducation only.",
            },
          },
          required: ["name", "purpose", "layout", "example_caption"],
          additionalProperties: false,
        },
      },
      export_prompt: {
        type: "string",
        description:
          "A single ready-to-paste prompt that builds this site, written to work in Squarespace, Lovable, Framer and Webflow, with a short note per platform where the instruction differs. Include the exact hex values, both typeface names, the page structure and the primary action.",
      },
    },
    required: [
      "positioning_statement",
      "brand_story",
      "voice_and_tone",
      "website_copy",
      "social_templates",
      "export_prompt",
    ],
    additionalProperties: false,
  },
};

/**
 * Structural gate. `expectedPages` is passed in so a kit that quietly drops or
 * invents a page fails here rather than shipping a half-empty deliverable.
 */
export function validateKit(
  payload: unknown,
  expectedPages: string[]
): asserts payload is KitContent {
  if (typeof payload !== "object" || payload === null) {
    throw new KitGenerationError("The model returned no usable output.");
  }

  const kit = payload as KitContent;

  requireText(kit.positioning_statement, "positioning statement");
  requireText(kit.brand_story, "brand story");
  requireText(kit.export_prompt, "export prompt");

  const voice = kit.voice_and_tone;
  if (typeof voice !== "object" || voice === null) {
    throw new KitGenerationError("The kit has no voice guide.");
  }
  requireStringArray(voice.adjectives, "voice adjectives", 3, 3);
  requireStringArray(voice.do_examples, "voice do-examples", 1);
  requireStringArray(voice.dont_examples, "voice don't-examples", 1);

  if (!Array.isArray(kit.website_copy)) {
    throw new KitGenerationError("The kit has no website copy.");
  }

  const returnedPages = kit.website_copy.map((page) => page?.page);

  for (const expected of expectedPages) {
    if (!returnedPages.includes(expected)) {
      throw new KitGenerationError(`The kit is missing copy for the ${expected} page.`);
    }
  }
  for (const returned of returnedPages) {
    if (typeof returned !== "string" || !expectedPages.includes(returned)) {
      throw new KitGenerationError(
        `The kit invented a page that was not requested: ${String(returned)}.`
      );
    }
  }

  for (const page of kit.website_copy) {
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      throw new KitGenerationError(`The ${page.page} page has no sections.`);
    }
    for (const section of page.sections) {
      requireText(section?.heading, `a ${page.page} section heading`);
      requireText(section?.body, `a ${page.page} section body`);
    }
  }

  if (!Array.isArray(kit.social_templates)) {
    throw new KitGenerationError("The kit has no social templates array.");
  }
  for (const template of kit.social_templates) {
    requireText(template?.name, "a social template name");
    requireText(template?.purpose, "a social template purpose");
    requireText(template?.layout, "a social template layout");
    requireText(template?.example_caption, "a social template caption");
  }
}

function requireText(value: unknown, what: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new KitGenerationError(`The kit is missing ${what}.`);
  }
}

function requireStringArray(
  value: unknown,
  what: string,
  min: number,
  max = Number.POSITIVE_INFINITY
): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new KitGenerationError(`The kit is missing ${what}.`);
  }
  const entries = value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  if (entries.length !== value.length || entries.length < min || entries.length > max) {
    throw new KitGenerationError(
      `The kit returned ${value.length} ${what}; expected ${
        min === max ? `exactly ${min}` : `at least ${min}`
      }.`
    );
  }
}

/**
 * Every string a practitioner could publish. Website copy is flattened
 * completely — About and Approach are the most likely place for an outcome
 * promise to survive, so nothing here is sampled.
 */
export function kitPublishableStrings(kit: KitContent): string[] {
  return [
    kit.positioning_statement,
    kit.brand_story,
    ...kit.voice_and_tone.adjectives,
    ...kit.voice_and_tone.do_examples,
    // Don't-examples are checked too: the guide is published alongside the
    // copy, and a "bad example" that reads as an endorsement is still on the
    // practitioner's website.
    ...kit.voice_and_tone.dont_examples,
    ...kit.website_copy.flatMap((page) =>
      page.sections.flatMap((section) => [section.heading, section.body])
    ),
    ...kit.social_templates.flatMap((template) => [
      template.name,
      template.purpose,
      template.example_caption,
    ]),
    kit.export_prompt,
  ];
}

export function buildKitPrompt({
  answers,
  direction,
  scope,
}: {
  answers: BriefAnswers;
  direction: {
    name: string;
    description: string;
    palette: DirectionPalette;
    typography: DirectionTypography;
  };
  scope: KitScope;
}): string {
  const brief = buildBriefContext(answers);

  const socialInstruction = scope.includeSocialTemplates
    ? `Also return 3 to 5 branded social template specs: what each is for, how it
is laid out (which palette color goes where, which typeface at which weight and
rough size), and one example caption in this practice's voice.`
    : `Return an empty array for social_templates. Social templates are not part
of this deliverable.`;

  return `You are a brand strategist and copywriter building the complete brand
kit for one licensed clinician in US private practice. The practitioner has
already chosen their creative direction. Everything you write here is intended
to be published on their website under their license.

${ETHICS_SYSTEM_RULES}

THE BRIEF

${brief.text}

THE CHOSEN DIRECTION

Name: ${direction.name}
Character: ${direction.description}
Palette: primary ${direction.palette.primary}, secondary ${direction.palette.secondary}, accent ${direction.palette.accent}, light neutral ${direction.palette.light_neutral}, dark neutral ${direction.palette.dark_neutral}
Typefaces: ${direction.typography.headings} for headings, ${direction.typography.body} for body

WHAT TO PRODUCE

1. A positioning statement: one or two sentences on who this practice is for
   and what the work is.

2. A brand story: two short paragraphs, first person, that the practitioner
   could adapt for an About page. Concrete and particular to this practice —
   never the generic "I believe everyone deserves to be heard" opening.

3. A voice and tone guide: exactly three adjectives, then 3 to 5 sentences
   written the way this practice should sound, and 3 to 5 it should never
   write. Make the don't-examples plausible near-misses, not caricatures.

4. Finished website copy for exactly these pages, in this order:
   ${scope.pages.join(", ")}
   Real, publishable prose. No placeholders, no lorem ipsum, no "[insert here]".
   Use the practitioner's own primary action, "${brief.primaryAction}", wherever
   a call to action belongs. Where proof is needed, use only what they actually
   have: ${brief.proof.join(", ") || "credentials"}. Never write a testimonial,
   a quote from a client, or a placeholder where one would go.
   The About and Approach pages are where outcome promises creep in — write
   those two with particular care. Describe what the work looks like, never
   what it will produce.

5. ${socialInstruction}

6. A single ready-to-paste site prompt for the practitioner's builder. One
   prompt that works in Squarespace, Lovable, Framer and Webflow, ending with a
   short per-platform note where the instruction differs (Squarespace: which
   section blocks and where the fonts are set; Lovable and Framer: the component
   structure to generate; Webflow: the class naming and layout approach).
   Include the exact hex values, both typeface names, the page structure, and
   the primary action.

Write in American English. Warm, grounded, plain. No hype, no startup
vocabulary. Match the register the practitioner asked for in the brief.`;
}

async function callModel(prompt: string, feedback: string): Promise<unknown> {
  const client = getAnthropicClient();

  // A full kit is long — several pages of finished copy plus the export prompt,
  // on top of thinking — so max_tokens is well above the ~16K point where a
  // non-streaming request risks an HTTP timeout. Stream, then take the final
  // message.
  const stream = client.messages.stream({
    model: GENERATION_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [KIT_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: feedback ? `${prompt}\n\n${feedback}` : prompt,
      },
    ],
  });

  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new KitGenerationError(
      "The model declined this request. Review the brief for anything that reads as a request for prohibited claims."
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === TOOL_NAME
  );

  if (!toolUse) {
    throw new KitGenerationError("The model did not return the brand kit tool call.");
  }

  return toolUse.input;
}

export async function generateBrandKit(args: {
  answers: BriefAnswers;
  direction: {
    name: string;
    description: string;
    palette: DirectionPalette;
    typography: DirectionTypography;
  };
  scope: KitScope;
}): Promise<KitContent> {
  const prompt = buildKitPrompt(args);

  return generateWithEthicsGuard<KitContent>({
    label: "brand-kit",
    callModel: async (feedback) => {
      const raw = await callModel(prompt, feedback);
      return raw as KitContent;
    },
    validate: (raw) => validateKit(raw, args.scope.pages),
    publishableStrings: kitPublishableStrings,
  });
}
