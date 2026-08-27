import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { rulesBlock } from "@/lib/ethics/guard";
import type { EthicsRule } from "@/lib/catalog/types";
import { NAV_SURFACES, CTA_SHAPES, CTA_STYLES } from "@/lib/brand/shapes";

/*
 * L'appel modèle de la génération.
 *
 * CE QU'IL ÉCRIT — la copy, et rien que la copy : noms, justifications,
 * titres, sous-titres, extraits « About », mots-clés de ton, guide de voix,
 * accroches sociales, et la personnalité de rendu de chaque direction.
 *
 * CE QU'IL N'ÉCRIT PAS — les palettes, les typographies, l'overline, le
 * libellé du bouton. Elles viennent du catalogue et du brief
 * (`lib/generation/select.ts`) : la base impose des hex valides, trois polices
 * de titre distinctes et une URL Google Fonts réelle, et un modèle invente
 * volontiers les trois.
 *
 * Le budget de sortie reste SOUS le seuil au-delà duquel le SDK refuse un
 * appel non streamé (~21 300 jetons) : cet appel peut donc rester en
 * `messages.create()`.
 */

export const GENERATION_MAX_TOKENS = 8000;

export class GenerationTruncatedError extends Error {
  constructor() {
    super("Le modèle a été coupé par max_tokens avant la fin de la génération.");
    this.name = "GenerationTruncatedError";
  }
}

export class GenerationRefusedError extends Error {
  constructor() {
    super("Le modèle a refusé de générer.");
    this.name = "GenerationRefusedError";
  }
}

/* Bornes LARGES ici : le resserrage aux contraintes de la base, et la reprise
   champ par champ, vivent dans `lib/generation/validate.ts`. Rejeter tout un
   résultat pour un caractère de trop coûterait une minute de génération. */
const line = z.string().trim().min(1).max(400);

export const draftDirectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rationale: z.string().trim().min(1).max(400),
  hero_headline: z.string().trim().min(1).max(200),
  hero_subhead: z.string().trim().min(1).max(200),
  about_excerpt: z.string().trim().min(1).max(600),
  tone_keywords: z.array(z.string().trim().min(1).max(40)).min(3).max(3),
  nav_surface: z.enum(NAV_SURFACES),
  cta_shape: z.enum(CTA_SHAPES),
  cta_style: z.enum(CTA_STYLES),
});

export const generationDraftSchema = z.object({
  directions: z.array(draftDirectionSchema).length(3),
  voice_guide: z.object({
    sounds_like: z.array(line).length(3),
    never_write: z.array(line).length(3),
  }),
  social: z.object({
    statement_headline: z.string().trim().min(1).max(200),
    question_headline: z.string().trim().min(1).max(200),
    notes_headline: z.string().trim().min(1).max(200),
    notes_body: z.string().trim().min(1).max(400),
  }),
});

export type GenerationDraft = z.infer<typeof generationDraftSchema>;
export type DraftDirection = z.infer<typeof draftDirectionSchema>;

const TOOL: Anthropic.Tool = {
  name: "write_brand",
  description:
    "Write the copy for three contrasted brand directions, a voice guide, and four social templates, from the brief provided.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      directions: {
        type: "array",
        description: "Exactly 3 directions, in the order the palettes were given.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "One or two words, 20 characters at most, that a clinician would say out loud. Example: Quiet Confidence.",
            },
            rationale: {
              type: "string",
              description:
                "Between 60 and 95 characters. Why this direction fits this practice, and who it speaks to.",
            },
            hero_headline: {
              type: "string",
              description:
                "The homepage headline. 46 characters at most. A sentence, not a slogan.",
            },
            hero_subhead: {
              type: "string",
              description:
                "One line under the headline. 60 characters at most. Who the practice serves.",
            },
            about_excerpt: {
              type: "string",
              description:
                "Two sentences for the About block. Who they work with, and what that work sits with.",
            },
            tone_keywords: {
              type: "array",
              description:
                "Exactly 3 single lowercase words, no spaces. Joined with ' · ' they must stay under 33 characters.",
              items: { type: "string" },
            },
            nav_surface: {
              type: "string",
              enum: ["primary", "light"],
              description:
                "Whether the site navbar sits on the primary color or on the light surface. Part of this direction's personality.",
            },
            cta_shape: {
              type: "string",
              enum: ["pill", "rounded", "square"],
              description: "The shape of the call-to-action button.",
            },
            cta_style: {
              type: "string",
              enum: ["solid", "outline"],
              description: "Whether the call-to-action is filled or outlined.",
            },
          },
          required: [
            "name",
            "rationale",
            "hero_headline",
            "hero_subhead",
            "about_excerpt",
            "tone_keywords",
            "nav_surface",
            "cta_shape",
            "cta_style",
          ],
          additionalProperties: false,
        },
      },
      voice_guide: {
        type: "object",
        properties: {
          sounds_like: {
            type: "array",
            description: "Exactly 3 short lines describing how this practice writes.",
            items: { type: "string" },
          },
          never_write: {
            type: "array",
            description:
              "Exactly 3 short lines naming what this practice must never publish. These are counter-examples: they name the mistake to avoid.",
            items: { type: "string" },
          },
        },
        required: ["sounds_like", "never_write"],
        additionalProperties: false,
      },
      social: {
        type: "object",
        properties: {
          statement_headline: {
            type: "string",
            description: "A short statement post. 34 characters at most.",
          },
          question_headline: {
            type: "string",
            description: "A question post. 34 characters at most.",
          },
          notes_headline: {
            type: "string",
            description:
              "A small-caps label for a notes post, e.g. 'Notes on burnout'. 20 characters at most.",
          },
          notes_body: {
            type: "string",
            description: "One sentence of body copy for the notes post.",
          },
        },
        required: [
          "statement_headline",
          "question_headline",
          "notes_headline",
          "notes_body",
        ],
        additionalProperties: false,
      },
    },
    required: ["directions", "voice_guide", "social"],
    additionalProperties: false,
  },
};

/**
 * Cadrage système. Le socle déontologique vient EN PREMIER, avant le cadrage
 * produit : aucune consigne de style ne doit pouvoir se lire comme une
 * permission de l'assouplir. Les six règles de la base le complètent, pour que
 * le modèle reçoive exactement ce que le praticien lit sur le badge.
 */
export function systemPrompt(rules: EthicsRule[]): string {
  return [
    ETHICS_SYSTEM_RULES,
    rulesBlock(rules),
    `You are a senior brand director at Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States.

Everything you write here is copy this clinician may publish. It has to read as psychoeducation: what the practice is like, who it serves, how the work feels — never a claim about what the work produces.

The palettes and typefaces are already chosen and given to you. Do not propose colors or fonts. Write the words that go with them.

The three directions must feel genuinely different from one another — not three versions of the same idea in different colors. Let the palette and typeface you were given for each one inform how it sounds.

Voice: short sentences, plain American English, contractions allowed, no exclamation marks, no hype words.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseGenerationResponse(
  response: Anthropic.Message
): GenerationDraft {
  if (response.stop_reason === "refusal") throw new GenerationRefusedError();

  /*
   * Coupure par longueur : on la nomme ICI, tant qu'on connaît la vraie
   * raison. Plus bas, elle se présenterait comme une banale erreur de forme,
   * et le praticien lirait « Something went wrong » pour un problème qui a un
   * nom et une réponse.
   */
  if (response.stop_reason === "max_tokens") throw new GenerationTruncatedError();

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Le modèle n'a produit aucun bloc d'outil.");

  return generationDraftSchema.parse(toolUse.input);
}

export type GenerationCall = (
  system: string,
  prompt: string
) => Promise<GenerationDraft>;

/** Appel réel, outil forcé — pas de texte libre à analyser. */
export const callGeneration: GenerationCall = async (system, prompt) => {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: GENERATION_MAX_TOKENS,
    system,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  return parseGenerationResponse(response);
};

/**
 * Réécriture d'un seul passage — pour l'Ethics Guard et pour la reprise d'un
 * champ trop long. Un appel court, une seule chaîne en retour.
 */
export async function callRewrite(
  system: string,
  instruction: string
): Promise<string> {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1000,
    system,
    messages: [{ role: "user", content: instruction }],
  });

  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return text?.text.trim() ?? "";
}
