import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicNotConfiguredError, getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { checkBannedPhrases } from "@/lib/generation/banned-phrases";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import { toneCardsSchema, type ToneCards } from "@/lib/generation/how-you-work-shapes";
import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * Génération des six cartes de ton (§2.2). Point d'intégration séparé de
 * `pipeline.ts` (voir `lib/generation/how-you-work-context.ts`) : ce lot
 * n'appelle jamais `runGenerationPipeline`.
 */

const MAX_ATTEMPTS = 3; // Un premier appel, puis « regenerate up to twice ».

const TOOL: Anthropic.Tool = {
  name: "write_tone_cards",
  description:
    "Write six short opening lines that could each be this practice's homepage headline, in six distinct voices.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        description: "Exactly 6 cards, six genuinely different voices.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A short lowercase-hyphen slug, e.g. 'grounded-direct'.",
            },
            label: {
              type: "string",
              description: "One or two words naming the voice, e.g. 'Grounded & direct'.",
            },
            keywords: {
              type: "array",
              description: "Exactly 3 single lowercase words describing this voice.",
              items: { type: "string" },
            },
            sample_hero: {
              type: "string",
              description:
                "The homepage headline in this voice. 46 characters at most. A sentence, not a slogan.",
            },
          },
          required: ["id", "label", "keywords", "sample_hero"],
          additionalProperties: false,
        },
      },
    },
    required: ["cards"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a senior brand director at Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States.

Write six homepage headlines, each in a distinct voice, that this practice could open with. Weight them toward how she actually works and what a colleague would say about her -- not generic directory language.

Voice: American English, plain, one sentence, no exclamation marks, no hype words, no outcome promises, no clinical claims.`;

export type RawToneCard = {
  id: string;
  label: string;
  keywords: string[];
  sample_hero: string;
};

async function callToneCardsModel(
  prompt: string,
  forbidden: string[]
): Promise<RawToneCard[]> {
  const instruction =
    forbidden.length > 0
      ? `${prompt}\n\nAVOID THESE PHRASES -- a previous attempt used them and they are not allowed: ${forbidden.join(", ")}`
      : prompt;

  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: instruction }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Le modèle n'a produit aucune carte de ton.");

  const raw = toolUse.input as { cards: RawToneCard[] };
  return raw.cards;
}

export type ToneCardsResult =
  | { ok: true; cards: ToneCards }
  | { ok: false; reason: "fallback" };

export type ToneCardsModelCall = (
  prompt: string,
  forbidden: string[]
) => Promise<RawToneCard[]>;
export type BannedPhrasesCheck = (text: string) => Promise<string[]>;

/**
 * Génère les six cartes, avec reprise sur un mot banni (§2.2). Toute panne —
 * modèle indisponible, forme rejetée, mot banni persistant — retombe sur le
 * MÊME repli après trois tentatives : la doctrine du §2.6 ne distingue pas
 * les causes, seulement le résultat visible.
 *
 * `modelCall`/`bannedPhrasesCheck` s'injectent pour les tests — les valeurs
 * par défaut sont les vrais appels (Anthropic, RPC service-role).
 */
export async function generateToneCards(
  bundle: BriefBundle,
  catalog: Catalog,
  modelCall: ToneCardsModelCall = callToneCardsModel,
  bannedPhrasesCheck: BannedPhrasesCheck = checkBannedPhrases
): Promise<ToneCardsResult> {
  const prompt = buildHowYouWorkContext(bundle, catalog);
  const forbidden: string[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await modelCall(prompt, forbidden);
      const candidates = raw.map((card) => ({ ...card, generated: true as const }));

      const hits = await Promise.all(
        candidates.map((card) => bannedPhrasesCheck(card.sample_hero))
      );
      const anyHit = hits.some((phrases) => phrases.length > 0);

      if (anyHit) {
        for (const phrases of hits) forbidden.push(...phrases);
        continue;
      }

      const parsed = toneCardsSchema.safeParse(candidates);
      if (!parsed.success) continue;

      return { ok: true, cards: parsed.data };
    } catch (error) {
      if (error instanceof AnthropicNotConfiguredError) {
        // Retrying a missing API key MAX_ATTEMPTS times is pure wasted
        // latency — it will fail identically every time. The fallback
        // response is unchanged (this is already an honest, deliberate
        // design — "standard openings" is what it says it is), only the
        // pointless retries are skipped.
        console.error("[tone-cards] generation not configured — skipping remaining attempts");
        break;
      }
      console.error("[tone-cards] generation attempt failed", error);
    }
  }

  return { ok: false, reason: "fallback" };
}
