import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { GENERATION_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefAnswers } from "@/lib/brief/steps";
import type { DirectionPalette, DirectionTypography } from "@/types/database";

/**
 * Monthly Presence: 12 social posts, 4 stories, and an editorial calendar, in
 * the practitioner's palette and voice.
 *
 * ── CHURN IS THE CENTRAL RISK ON THIS PRODUCT ──────────────────────────────
 * A $39/mo content subscription typically loses 10–15% of subscribers a month.
 * At that rate the cohort halves inside a year, and no amount of acquisition
 * outruns it. What keeps people subscribed is not more content — it is content
 * that actually gets published. The retention loop (delivering the calendar on
 * a predictable cadence, reminding people to post, showing them what they
 * published last month) is therefore product-critical, not a nice-to-have.
 * It is deliberately NOT built in this pass; build it on purpose, not by
 * accident. See the TODO(retention) seams at the bottom of this file.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * This is also the highest-volume publishable surface in the product: one
 * subscriber generates more publishable strings here every month than their
 * entire brand kit contained. Every one of them goes through the ethics guard.
 */

export type SocialPost = {
  week: number;
  theme: string;
  caption: string;
  visual_direction: string;
  call_to_action: string;
};

export type Story = {
  theme: string;
  frames: string[];
};

export type EditorialCalendarEntry = {
  week: number;
  focus: string;
  rationale: string;
};

export type MonthlyPresenceContent = {
  editorial_calendar: EditorialCalendarEntry[];
  posts: SocialPost[];
  stories: Story[];
};

export class MonthlyPresenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonthlyPresenceError";
  }
}

export const POSTS_PER_MONTH = 12;
export const STORIES_PER_MONTH = 4;

const TOOL_NAME = "compose_monthly_presence";

const PRESENCE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Return one month of social content for this practice: an editorial calendar, 12 posts, and 4 stories.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      editorial_calendar: {
        type: "array",
        description:
          "Exactly 4 entries, one per week of the month, in week order.",
        items: {
          type: "object",
          properties: {
            week: { type: "integer", description: "Week number, 1 through 4." },
            focus: { type: "string", description: "This week's theme." },
            rationale: {
              type: "string",
              description:
                "One sentence on why this theme, for the practitioner's eyes only.",
            },
          },
          required: ["week", "focus", "rationale"],
          additionalProperties: false,
        },
      },
      posts: {
        type: "array",
        description:
          "Exactly 12 posts, 3 per week, ordered by week. Publishable copy.",
        items: {
          type: "object",
          properties: {
            week: { type: "integer", description: "Week number, 1 through 4." },
            theme: { type: "string", description: "What this post is about." },
            caption: {
              type: "string",
              description:
                "The full caption, ready to publish. Psychoeducation only — explain a concept, never promise a result, never quote a client.",
            },
            visual_direction: {
              type: "string",
              description:
                "What the image or card looks like, naming which palette colors and which typeface to use.",
            },
            call_to_action: {
              type: "string",
              description:
                "A single closing line. Invitational, never urgent or scarce.",
            },
          },
          required: [
            "week",
            "theme",
            "caption",
            "visual_direction",
            "call_to_action",
          ],
          additionalProperties: false,
        },
      },
      stories: {
        type: "array",
        description: "Exactly 4 stories, one per week.",
        items: {
          type: "object",
          properties: {
            theme: { type: "string", description: "What this story sequence is about." },
            frames: {
              type: "array",
              description:
                "3 to 5 frames, each the publishable text for one story card.",
              items: { type: "string" },
            },
          },
          required: ["theme", "frames"],
          additionalProperties: false,
        },
      },
    },
    required: ["editorial_calendar", "posts", "stories"],
    additionalProperties: false,
  },
};

export function validateMonthlyPresence(
  payload: unknown
): asserts payload is MonthlyPresenceContent {
  if (typeof payload !== "object" || payload === null) {
    throw new MonthlyPresenceError("The model returned no usable output.");
  }

  const content = payload as MonthlyPresenceContent;

  if (
    !Array.isArray(content.editorial_calendar) ||
    content.editorial_calendar.length !== 4
  ) {
    throw new MonthlyPresenceError(
      `Expected 4 editorial calendar entries, got ${
        Array.isArray(content.editorial_calendar)
          ? content.editorial_calendar.length
          : 0
      }.`
    );
  }

  if (!Array.isArray(content.posts) || content.posts.length !== POSTS_PER_MONTH) {
    throw new MonthlyPresenceError(
      `Expected ${POSTS_PER_MONTH} posts, got ${
        Array.isArray(content.posts) ? content.posts.length : 0
      }.`
    );
  }

  if (
    !Array.isArray(content.stories) ||
    content.stories.length !== STORIES_PER_MONTH
  ) {
    throw new MonthlyPresenceError(
      `Expected ${STORIES_PER_MONTH} stories, got ${
        Array.isArray(content.stories) ? content.stories.length : 0
      }.`
    );
  }

  for (const entry of content.editorial_calendar) {
    requireText(entry?.focus, "an editorial calendar focus");
    requireText(entry?.rationale, "an editorial calendar rationale");
  }

  content.posts.forEach((post, index) => {
    requireText(post?.caption, `the caption for post ${index + 1}`);
    requireText(post?.visual_direction, `the visual direction for post ${index + 1}`);
    requireText(post?.call_to_action, `the call to action for post ${index + 1}`);
  });

  content.stories.forEach((story, index) => {
    requireText(story?.theme, `the theme for story ${index + 1}`);
    if (!Array.isArray(story.frames) || story.frames.length < 3) {
      throw new MonthlyPresenceError(
        `Story ${index + 1} needs at least 3 frames.`
      );
    }
    story.frames.forEach((frame, frameIndex) => {
      requireText(frame, `frame ${frameIndex + 1} of story ${index + 1}`);
    });
  });
}

function requireText(value: unknown, what: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MonthlyPresenceError(`The delivery is missing ${what}.`);
  }
}

/** Everything a practitioner would post publicly. */
export function presencePublishableStrings(
  content: MonthlyPresenceContent
): string[] {
  return [
    ...content.editorial_calendar.map((entry) => entry.focus),
    ...content.posts.flatMap((post) => [
      post.theme,
      post.caption,
      post.call_to_action,
    ]),
    ...content.stories.flatMap((story) => [story.theme, ...story.frames]),
  ];
}

export function buildMonthlyPresencePrompt({
  answers,
  direction,
  monthLabel,
}: {
  answers: BriefAnswers;
  direction: {
    name: string;
    palette: DirectionPalette;
    typography: DirectionTypography;
  };
  monthLabel: string;
}): string {
  const brief = buildBriefContext(answers);

  return `You are writing one month of social content for a licensed
mental-health clinician in US private practice. Everything here is published on
their public accounts under their license.

${ETHICS_SYSTEM_RULES}

This is recurring content, which means volume — and volume is where compliance
slips. Every single caption, frame and closing line has to clear the rules
above on its own, not on average.

THE BRIEF

${brief.text}

THEIR BRAND

Direction: ${direction.name}
Palette: primary ${direction.palette.primary}, secondary ${direction.palette.secondary}, accent ${direction.palette.accent}, light neutral ${direction.palette.light_neutral}, dark neutral ${direction.palette.dark_neutral}
Typefaces: ${direction.typography.headings} for headings, ${direction.typography.body} for body

WHAT TO PRODUCE FOR ${monthLabel.toUpperCase()}

1. An editorial calendar: four weekly themes with one sentence each on why that
   theme, this month, for this practice. The rationale is for the practitioner,
   not for publishing.

2. ${POSTS_PER_MONTH} posts, three per week, following the calendar. Each post
   needs a full publishable caption, a visual direction naming which palette
   colors and typeface to use, and one closing line.
   Vary the shape across the month: some posts explain a concept, some describe
   what a session actually looks like, some name a misconception. None of them
   promise anything.

3. ${STORIES_PER_MONTH} stories, one per week, each 3 to 5 frames of
   publishable text.

Closing lines are invitations, never pressure. "If this sounds like the work
you're looking for, my consultation link is in my bio" — not "spots are filling
up". Write in American English, in the register the brief describes.`;
}

async function callModel(prompt: string, feedback: string): Promise<unknown> {
  const client = getAnthropicClient();

  // A month of content is the longest generation in the product. Streamed so
  // the large max_tokens cannot trip an HTTP timeout.
  const stream = client.messages.stream({
    model: GENERATION_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [PRESENCE_TOOL],
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
    throw new MonthlyPresenceError("The model declined this request.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === TOOL_NAME
  );

  if (!toolUse) {
    throw new MonthlyPresenceError(
      "The model did not return the monthly presence tool call."
    );
  }

  return toolUse.input;
}

export async function generateMonthlyPresence(args: {
  answers: BriefAnswers;
  direction: {
    name: string;
    palette: DirectionPalette;
    typography: DirectionTypography;
  };
  monthLabel: string;
}): Promise<MonthlyPresenceContent> {
  const prompt = buildMonthlyPresencePrompt(args);

  return generateWithEthicsGuard<MonthlyPresenceContent>({
    label: "monthly-presence",
    callModel: async (feedback) => {
      const raw = await callModel(prompt, feedback);
      return raw as MonthlyPresenceContent;
    },
    validate: validateMonthlyPresence,
    publishableStrings: presencePublishableStrings,
  });
}

/*
 * TODO(retention): the churn-fighting loop. Read the note at the top of this
 * file first — this is the difference between the subscription working and the
 * subscription bleeding out. Deliberately not built in this pass:
 *
 *  1. Delivery cadence. A scheduled job that generates each active
 *     subscriber's next month a few days before it starts, so the calendar is
 *     waiting rather than requested. `monthly_presence_deliveries` is already
 *     keyed by (project_id, period_start) so a job can be idempotent.
 *  2. Publish reminders. A weekly nudge naming the specific post that is due.
 *     Content that never gets published is the actual reason people cancel.
 *  3. A "what you published last month" view. Seeing the accumulation is what
 *     makes the renewal feel earned.
 *  4. Cancellation flow that offers a pause before a cancel.
 *
 * None of these need new generation code — the generator above is the whole
 * content path. What is missing is the scheduler, the reminders, and the
 * surfaces that show the practitioner what they already have.
 */
