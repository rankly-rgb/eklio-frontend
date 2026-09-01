import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { systemPrompt } from "@/lib/generation/model";
import { enforceEthics, type Rewriter } from "@/lib/ethics/guard";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { callRewrite } from "@/lib/generation/model";
import { truncateOnWordBoundary } from "@/lib/generation/validate";
import type { EthicsRule } from "@/lib/catalog/types";
import type { Direction, VoiceGuide } from "@/lib/brand/shapes";

/*
 * Le contenu du mois — titres et légendes.
 *
 * DEUX RÉGIMES, et c'est la seule différence entre eux :
 *   - abonné      → les seize items reçoivent titre ET légende ;
 *   - non abonné  → un post prêt avec sa légende, quinze TITRES seuls.
 *
 * Les quinze verrouillés portent bien un titre : c'est ce que l'Écran 7
 * affiche sous chaque tuile floutée. La base l'autorise — son CHECK
 * `monthly_presence_content_locked_is_empty_check` n'interdit que `caption` et
 * `visual_spec` sur un item verrouillé, pas le titre.
 *
 * Les titres sont plafonnés à 34 caractères par la base, pour la même raison
 * que les accroches sociales : la tuile est haute de 138px et la ligne ne
 * s'enroule pas deux fois.
 */

export const MONTH_TITLE_MAX = 34;

export const monthlyPlanSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        caption: z.string().trim().min(1).max(1200),
      })
    )
    .min(1),
});

export type MonthlyPlan = z.infer<typeof monthlyPlanSchema>;

const TOOL: Anthropic.Tool = {
  name: "plan_month",
  description:
    "Write the month's social content for a therapy practice: one title and one caption per slot.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description:
          "One entry per slot, in order. Vary the angle: psychoeducation, what a first session is like, what a concept means, a question worth sitting with.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "The line rendered on the tile. 34 characters at most. A sentence or a question, not a slogan.",
            },
            caption: {
              type: "string",
              description:
                "Two to four sentences to post alongside it. Plain American English, no hashtags, no emoji, no call to book.",
            },
          },
          required: ["title", "caption"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

export type MonthlyCall = (
  system: string,
  prompt: string
) => Promise<MonthlyPlan>;

export const callMonthly: MonthlyCall = async (system, prompt) => {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    system,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Le plan du mois a été coupé par max_tokens.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Aucun plan de mois généré.");

  return monthlyPlanSchema.parse(toolUse.input);
};

export type MonthlySlot = {
  id: string;
  type: "post" | "story";
  day_of_month: number;
  /** Les items verrouillés ne reçoivent qu'un titre. */
  locked: boolean;
};

export type MonthlyContent = {
  id: string;
  title: string;
  /** `null` sur un item verrouillé — la base l'exige. */
  caption: string | null;
};

/**
 * Écrit le mois, puis le fait passer par le socle déontologique.
 *
 * Un post publié par un praticien est de la publicité au même titre que son
 * site : titres ET légendes passent par le garde. Rien n'y échappe.
 */
export async function planMonth(input: {
  monthName: string;
  practiceName: string | null;
  direction: Direction;
  voiceGuide: VoiceGuide | null;
  slots: MonthlySlot[];
  rules: EthicsRule[];
  call?: MonthlyCall;
  rewrite?: (system: string, instruction: string) => Promise<string>;
}): Promise<MonthlyContent[]> {
  const call = input.call ?? callMonthly;
  const rewriteCall = input.rewrite ?? callRewrite;

  const system = systemPrompt(input.rules);
  const prompt = [
    `Write ${input.slots.length} pieces of social content for ${input.monthName}.`,
    "",
    `PRACTICE: ${input.practiceName ?? "a therapy practice"}`,
    `VOICE: ${input.direction.tone_keywords.join(", ")}`,
    ...(input.voiceGuide
      ? [
          "SOUNDS LIKE:",
          ...input.voiceGuide.sounds_like.map((line) => `- ${line}`),
        ]
      : []),
    "",
    `THE SITE SAYS: "${input.direction.hero.headline}" — ${input.direction.hero.subhead}`,
    input.direction.about_excerpt,
    "",
    "SLOTS, in order:",
    ...input.slots.map(
      (slot, index) =>
        `${index + 1}. ${slot.type} on day ${slot.day_of_month}`
    ),
    "",
    "Every piece is psychoeducation. None of them asks anyone to book anything.",
  ].join("\n");

  const plan = await call(system, prompt);

  const rewriter: Rewriter = async (request) =>
    rewriteCall(
      ETHICS_SYSTEM_RULES,
      `Rewrite this so it no longer breaks the advertising rules below.

Text:
${request.text}

Problems:
${request.problems.map((problem) => `- "${problem.excerpt}" breaks: ${problem.description}`).join("\n")}

Keep the same meaning and the same length. Reply with the rewritten text only.`
    );

  const fields = input.slots.flatMap((slot, index) => {
    const item = plan.items[index] ?? plan.items[plan.items.length - 1];
    const entries = [{ field: `items[${index}].title`, text: item.title }];
    // Une légende n'est écrite que là où elle sera stockée : la base refuse
    // une légende sur un item verrouillé.
    if (!slot.locked) {
      entries.push({ field: `items[${index}].caption`, text: item.caption });
    }
    return entries;
  });

  const guarded = await enforceEthics(fields, input.rules, rewriter);
  const byField = new Map(guarded.fields.map((field) => [field.field, field.text]));

  return input.slots.map((slot, index) => {
    const item = plan.items[index] ?? plan.items[plan.items.length - 1];
    return {
      id: slot.id,
      title: truncateOnWordBoundary(
        byField.get(`items[${index}].title`) ?? item.title,
        MONTH_TITLE_MAX
      ),
      caption: slot.locked
        ? null
        : (byField.get(`items[${index}].caption`) ?? item.caption),
    };
  });
}
