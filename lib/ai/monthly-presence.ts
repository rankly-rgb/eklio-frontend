import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext, practiceName } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefDraft } from "@/lib/brief/schemas";
import {
  MONTHLY_PRESENCE,
  MONTHLY_PRESENCE_POSTS,
  MONTHLY_PRESENCE_STORIES,
} from "@/lib/billing/plans";
import {
  clampCalendar,
  monthlyPresenceSchema,
  publishablePresenceText,
  type MonthlyPresence,
} from "@/lib/presence/content";
import type { ChosenDirection } from "@/lib/ai/kit";
import type { Palette } from "@/lib/ai/directions";
import type { KitContent } from "@/lib/kit/content";

/*
 * Génération du livrable Monthly Presence — 12 posts, 4 stories, un calendrier
 * éditorial daté, aux couleurs et à la voix du kit du praticien.
 *
 * C'est la surface publiable la PLUS VOLUMINEUSE ET LA PLUS RÉPÉTÉE du produit :
 * le kit se relit une fois, ceci part en ligne douze fois par mois, tous les
 * mois. Chaque garde du kit est donc reprise ici, sans exception — les cinq
 * leçons payées au débogage de la génération du kit sont appliquées d'emblée
 * plutôt que redécouvertes :
 *
 *   1. STREAMING OBLIGATOIRE. Le SDK refuse un appel non streamé au-delà
 *      d'environ 21 300 jetons de sortie, et lève côté CLIENT, avant toute
 *      requête réseau (cf. `NON_STREAMING_MAX_TOKENS`). Ce livrable en demande
 *      24 000 : `messages.stream(...).finalMessage()`, jamais `create()`.
 *   2. AUCUNE BORNE CASSANTE. « 12 posts » est une consigne, pas une garantie :
 *      les listes sont normalisées dans `lib/presence/content.ts`, jamais
 *      refusées sur leur compte.
 *   3. DÉONTOLOGIE SANS PIÈGE. `generateWithEthicsGuard` et `ETHICS_SYSTEM_RULES`
 *      sont réutilisés TELS QUELS, y compris la nuance mention/affirmation
 *      (`PROHIBITIVE_LEAD`). Le prompt ci-dessous ne demande jamais au modèle
 *      d'ÉCRIRE une liste d'interdits dans le livrable : c'est ce qui avait fait
 *      échouer le kit sur sa propre conformité.
 *   4. `stop_reason: "max_tokens"` est attrapé et nommé. Une réponse tronquée
 *      est un échec de LONGUEUR, actionnable, pas un JSON invalide opaque.
 *   5. `maxDuration` est posé sur la page qui porte l'action, et l'interface
 *      annonce une à deux minutes.
 *
 * Sens de dépendance inchangé : lib/ai importe lib/ethics, jamais l'inverse.
 */

export type PresenceInput = {
  projectName: string;
  draft: BriefDraft;
  /** Le mois du livrable, déjà calé au premier (`YYYY-MM-01`). */
  month: string;
  /** « March 2026 », tel qu'il est écrit au praticien et au modèle. */
  monthLabel: string;
  daysInMonth: number;
  /** Le kit du praticien : c'est lui qui donne la voix et le positionnement. */
  kit: KitContent;
  direction: ChosenDirection;
};

/**
 * Levée quand le modèle a été coupé par `max_tokens` avant d'avoir fini.
 *
 * Même raison d'être que `KitTruncatedError` : c'est le seul échec de
 * génération où réessayer a une vraie chance d'aboutir. Sans elle, une réponse
 * tronquée se présente comme un JSON d'outil invalide et le praticien reçoit
 * « Something went wrong » pour un problème de longueur.
 */
export class PresenceTruncatedError extends Error {
  constructor() {
    super("Le modèle a été coupé par max_tokens avant la fin du mois.");
    this.name = "PresenceTruncatedError";
  }
}

export const PRESENCE_TOOL: Anthropic.Tool = {
  name: "compose_monthly_presence",
  description:
    "Return one month of social content for this practice: a focus for the month, social posts, story prompts, and a dated editorial calendar.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      month_focus: {
        type: "string",
        description:
          "Two or three sentences naming what this month's content attends to and why it suits this practice right now. Psychoeducation only.",
      },
      posts: {
        type: "array",
        description: `${MONTHLY_PRESENCE_POSTS} social posts, written in this practice's voice and ready to publish as they are.`,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Short internal name for the post, used in the calendar. Not published.",
            },
            hook: {
              type: "string",
              description:
                "The first line of the post — the one that shows before the reader taps to expand. One sentence, concrete, no clickbait.",
            },
            caption: {
              type: "string",
              description:
                "The complete post, ready to publish. Plain prose, warm and specific, with line breaks where they help. No placeholder, no bracketed blank, no invented fact about this clinician.",
            },
            teaches: {
              type: "string",
              description:
                "One sentence naming what a reader understands better after reading this post. Describe the understanding, not how the reader will feel afterwards.",
            },
          },
          required: ["title", "hook", "caption", "teaches"],
          additionalProperties: false,
        },
      },
      stories: {
        type: "array",
        description: `${MONTHLY_PRESENCE_STORIES} story prompts — lighter, more immediate than the posts.`,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short internal name." },
            prompt: {
              type: "string",
              description:
                "What the clinician films, writes or shows, described step by step, with the words to put on screen. Publishable copy.",
            },
            purpose: {
              type: "string",
              description: "What this story is for, in one sentence.",
            },
          },
          required: ["title", "prompt", "purpose"],
          additionalProperties: false,
        },
      },
      calendar: {
        type: "array",
        description:
          "The editorial calendar: one entry per publishing day, spread across the month, referencing the posts and stories above by their title.",
        items: {
          type: "object",
          properties: {
            day: {
              type: "number",
              description:
                "Day of the month, as a whole number. It must exist in the month you were given.",
            },
            publish: {
              type: "string",
              description:
                "What goes out that day, named exactly as the post or story title above.",
            },
            note: {
              type: "string",
              description:
                "One practical sentence for that day: the time of day that suits it, the format, or what to have ready beforehand.",
            },
          },
          required: ["day", "publish", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["month_focus", "posts", "stories", "calendar"],
    additionalProperties: false,
  },
};

/*
 * Garde-fou de niveau 1. Le socle déontologique vient EN PREMIER — aucune
 * consigne de style ne peut se lire comme une permission de l'assouplir.
 *
 * Le point de fuite propre à ce livrable n'est pas le même que celui du kit.
 * Sur un site, la promesse de résultat se glisse dans la page About. Sur un
 * réseau social, elle se glisse dans le HOOK : la première ligne doit arrêter
 * le défilement, et « et si votre anxiété disparaissait ? » est exactement ce
 * qu'un modèle entraîné sur du copywriting produit pour y arriver. D'où
 * l'avertissement explicite ci-dessous.
 *
 * Ce prompt ne demande JAMAIS au modèle d'écrire une liste d'interdits dans le
 * livrable (leçon n°3) : le kit avait échoué sur sa propre conformité pour
 * cette raison.
 */
export const PRESENCE_SYSTEM_PROMPT = `${ETHICS_SYSTEM_RULES}

You are writing a month of social content for a licensed mental-health clinician in private practice in the United States, on behalf of Eklio.

Everything here is copy this clinician will publish under their own license, to an audience that includes people who are unwell. Two places deserve particular care:

- The HOOK is where a promise gets made. Its job is to be worth reading, not to stop the scroll at any cost. Open with something true and specific about the work — a common misunderstanding, what a session actually looks like, a distinction worth drawing. Write the hook as an observation, and let it stand on its own.
- The CAPTION is where a description of the work turns into a description of the reader's future. Say what the work attends to and how it is done. Leave what the reader will feel, become, or be free of entirely unwritten.

Social copy invites urgency, comparison and testimonial by default. This clinician's licensing board does not make an exception for social media, so the rules above apply to every line, every hook, and every note in the calendar.

Write warm, grounded, plain American English, in the first person. Vary the shape of the posts across the month: some short, some longer, some a single observation, some a walk through an idea.`;

/** Nombre de reprises accordées au modèle après une violation bloquante. */
const ETHICS_MAX_RETRIES = 2;

/*
 * Budget de sortie : douze posts complets, quatre stories et un calendrier
 * daté dans une seule réponse, plus les jetons de raisonnement (la réflexion
 * adaptative est active par défaut sur Claude Opus 5).
 *
 * Il est DÉLIBÉRÉMENT au-dessus de `NON_STREAMING_MAX_TOKENS` (~21 333) : ce
 * livrable ne tient pas en dessous, et c'est ce seuil précis qui avait rendu
 * la panne du kit invisible. Le streaming n'est donc pas une optimisation ici,
 * c'est la condition pour que l'appel parte.
 */
export const PRESENCE_MAX_TOKENS = 24000;

function hexList(palette: Partial<Palette>): string {
  const entries = Object.entries(palette).filter(([, hex]) => Boolean(hex));
  if (entries.length === 0) return "not specified";
  return entries.map(([role, hex]) => `${role} ${hex}`).join(", ");
}

export function buildPresencePrompt({
  projectName,
  draft,
  monthLabel,
  daysInMonth,
  kit,
  direction,
}: PresenceInput): string {
  const name = practiceName(projectName, draft);
  const voice = kit.voice_and_tone;

  return `${buildBriefContext(projectName, draft, { includeProof: true })}

This practice already has a brand kit. Everything you write this month has to sound like it and look like it.

- Direction: ${direction.name} — ${direction.description}
- Palette: ${hexList(direction.palette)}
- Typefaces: ${direction.heading_font} for headings, ${direction.body_font} for body
- Positioning: ${kit.positioning_statement}
- Voice: ${voice.adjectives.join(", ")}
- The practice sounds like this:
${voice.do_examples.map((example) => `  - "${example}"`).join("\n")}

Build ${monthLabel} for "${name}".

Posts — ${MONTHLY_PRESENCE_POSTS} of them, each finished and ready to publish. Draw the subjects from what this practice actually does: the modalities named in the brief, who it serves, what a session involves, what people commonly misunderstand about this kind of work. Where a post would need a fact you were not given — a fee, an address, an availability — write the sentence so the clinician only has to drop the value in, and never invent one.

Stories — ${MONTHLY_PRESENCE_STORIES} prompts, lighter and more immediate than the posts. Each one says what to show and what words go on screen.

Calendar — spread the ${MONTHLY_PRESENCE_POSTS + MONTHLY_PRESENCE_STORIES} pieces across ${monthLabel}, which has ${daysInMonth} days. Use whole day numbers between 1 and ${daysInMonth}. Give the month a rhythm a solo clinician can actually keep: two or three publishing days a week, never two in a row, and nothing on a day that would mean writing on a weekend. Reference each piece by the exact title you gave it.

The clinician publishes this themselves, between sessions. Every piece has to be usable as it is.`;
}

/**
 * Appel modèle, isolé pour que la garde déontologique et les tests puissent
 * l'envelopper. `feedback` est nul à la première tentative, puis porte
 * l'instruction corrective construite à partir des violations trouvées.
 */
export type PresenceModelCall = (
  prompt: string,
  feedback: string | null
) => Promise<MonthlyPresence>;

const callAnthropic: PresenceModelCall = async (prompt, feedback) => {
  /*
   * Streaming obligatoire, pas décoratif (leçon n°1) : sans lui,
   * `messages.create()` lève côté client AVANT d'émettre la requête, en zéro
   * seconde, sans statut HTTP ni entrée dans l'onglet Réseau. C'est cette
   * panne muette qui a coûté le débogage du kit.
   */
  const response = await getAnthropicClient()
    .messages.stream({
      model: "claude-opus-5",
      max_tokens: PRESENCE_MAX_TOKENS,
      output_config: { effort: "medium" },
      system: PRESENCE_SYSTEM_PROMPT,
      tools: [PRESENCE_TOOL],
      tool_choice: { type: "tool", name: PRESENCE_TOOL.name },
      messages: [
        {
          role: "user",
          content: feedback ? `${prompt}\n\n${feedback}` : prompt,
        },
      ],
    })
    .finalMessage();

  return parsePresenceResponse(response);
};

/**
 * Transforme une réponse du modèle en livrable validé, ou lève en nommant la
 * raison. Extrait de l'appel réseau pour être testable sans API.
 */
export function parsePresenceResponse(
  response: Anthropic.Message
): MonthlyPresence {
  if (response.stop_reason === "refusal") {
    throw new Error("The model refused to generate this month's content.");
  }

  /*
   * Leçon n°4 : la coupure par longueur se dit ICI, tant qu'on connaît la vraie
   * raison. Plus bas, elle se présenterait comme une banale erreur de
   * structure — le bloc d'outil est incomplet, donc son JSON ne valide pas.
   */
  if (response.stop_reason === "max_tokens") {
    throw new PresenceTruncatedError();
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("No monthly content was generated.");
  }

  return monthlyPresenceSchema.parse(toolUse.input);
}

/**
 * Génération gardée, avec l'appel modèle injecté — le point d'entrée des tests.
 *
 * Ne renvoie jamais un livrable non conforme : soit le mois passe la validation
 * structurelle ET la validation déontologique, soit l'appel lève et rien n'est
 * persisté.
 *
 * Le calendrier est recalé sur le mois réel APRÈS la garde : un 31 février est
 * une erreur sur UNE entrée, pas une raison de jeter douze posts.
 */
export function generatePresenceWithModel(
  input: PresenceInput,
  callModel: PresenceModelCall
): Promise<MonthlyPresence> {
  const prompt = buildPresencePrompt(input);

  return generateWithEthicsGuard(
    async (feedback) => {
      const generated = await callModel(prompt, feedback);
      return {
        ...generated,
        calendar: clampCalendar(generated.calendar, input.daysInMonth),
      };
    },
    {
      publishableText: publishablePresenceText,
      label: MONTHLY_PRESENCE.label.toLowerCase(),
      maxRetries: ETHICS_MAX_RETRIES,
    }
  );
}

export function generateMonthlyPresence(
  input: PresenceInput
): Promise<MonthlyPresence> {
  return generatePresenceWithModel(input, callAnthropic);
}
