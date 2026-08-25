import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext, practiceName } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { PAGES_WANTED, type BriefDraft } from "@/lib/brief/schemas";
import { optionLabel, PAGE_OPTIONS } from "@/lib/brief/steps";
import {
  kitContentSchema,
  publishableKitText,
  type KitContent,
} from "@/lib/kit/content";
import type { KitScope, PageKey } from "@/lib/kit/tiers";
import type { Palette } from "@/lib/ai/directions";

/*
 * Génération du kit de marque, en anglais américain — même mécanique que
 * `directions.ts` : SDK Anthropic serveur-only, outil unique forcé, schéma
 * strict, validation zod, puis garde déontologique.
 *
 * Trois gardes se cumulent, et une génération doit passer les TROIS avant
 * d'être persistée :
 * - structurelle : outil forcé + `kitGenerationSchema` (formes valides) ;
 * - de périmètre : les pages rendues doivent couvrir celles que le tier
 *   autorise (`applyScope`) — un kit à qui il manque une page est un livrable
 *   incomplet, pas un livrable ;
 * - déontologique : `ETHICS_SYSTEM_RULES` dans le prompt système (niveau 1) et
 *   `generateWithEthicsGuard` autour de l'appel (niveau 2).
 *
 * C'est la plus grosse surface publiable du produit : le kit contient les
 * textes que le praticien collera sur son site. Les pages About et Approach
 * sont le point de fuite le plus probable — c'est là qu'une promesse de
 * résultat s'écrit sans y penser — d'où l'avertissement explicite dans le
 * prompt système et l'aplatissement intégral dans `publishableKitText`.
 *
 * Sens de dépendance : lib/ai importe lib/ethics, jamais l'inverse.
 */

/*
 * La direction choisie, telle qu'elle entre dans le prompt. Volontairement une
 * forme locale et non `Tables<"directions">` : la génération n'a besoin ni des
 * timestamps ni des ids, et les tests n'ont pas à fabriquer une ligne de base.
 */
export type ChosenDirection = {
  name: string;
  description: string;
  palette: Partial<Palette>;
  heading_font: string;
  body_font: string;
};

export type KitInput = {
  projectName: string;
  draft: BriefDraft;
  direction: ChosenDirection;
  scope: KitScope;
};

/*
 * Le prompt multi-plateformes voyage avec le contenu à la génération, puis se
 * sépare à la persistance (colonne `multi_builder_prompt`). D'où un schéma de
 * génération = contenu + prompt, et pas un seul bloc.
 */
export const kitGenerationSchema = kitContentSchema.extend({
  // Borne haute large, même raison que dans `lib/kit/content.ts` : ce prompt
  // décrit jusqu'à 8 pages, et le rogner n'aurait aucun sens.
  website_prompt: z.string().trim().min(1).max(60000),
});

export type KitGeneration = z.infer<typeof kitGenerationSchema>;

/**
 * Levée quand le modèle a été coupé par `max_tokens` avant d'avoir fini.
 *
 * Distincte des autres échecs : elle est ACTIONNABLE (réessayer, ou demander
 * moins de pages), là où une erreur de structure ne l'est pas. Sans elle, une
 * réponse tronquée se présente comme un JSON d'outil invalide et l'utilisateur
 * reçoit « Something went wrong » pour un problème de longueur.
 */
export class KitTruncatedError extends Error {
  constructor() {
    super("Le modèle a été coupé par max_tokens avant la fin du kit.");
    this.name = "KitTruncatedError";
  }
}

/** Levée quand le kit rendu ne couvre pas les pages du périmètre demandé. */
export class KitScopeError extends Error {
  readonly missing: PageKey[];

  constructor(missing: PageKey[]) {
    super(
      `Le kit généré ne couvre pas les pages demandées : ${missing.join(", ")}.`
    );
    this.name = "KitScopeError";
    this.missing = missing;
  }
}

export const KIT_TOOL: Anthropic.Tool = {
  name: "compose_brand_kit",
  description:
    "Return the complete brand kit for this practice: positioning, brand story, voice guide, website copy for each requested page, branded social template specs, and one multi-platform website prompt.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      positioning_statement: {
        type: "string",
        description:
          "Two or three sentences naming who this practice is for, what the work is, and what makes it this practice rather than another. Psychoeducation only — never what the work will produce.",
      },
      brand_story: {
        type: "string",
        description:
          "Two short paragraphs the clinician could adapt for an About page: why this practice exists, how the work is done. Warm, specific, first person. No promise of results, no invented credential.",
      },
      voice_and_tone: {
        type: "object",
        description: "The voice guide.",
        properties: {
          adjectives: {
            type: "array",
            description:
              "Exactly 3 adjectives describing this practice's voice. One or two words each.",
            items: { type: "string" },
          },
          do_examples: {
            type: "array",
            description:
              "3 to 5 short sentences written the way this practice should sound. Publishable copy: each one must satisfy the advertising-ethics rules.",
            items: { type: "string" },
          },
          dont_examples: {
            type: "array",
            description:
              "3 to 5 short counter-examples, each NAMING the mistake rather than demonstrating it — write \"Naming a timeframe for how someone will feel\" or \"Borrowing authority from a training you did not complete\", not the offending sentence itself. These are shown to the clinician under \"never write this\".",
            items: { type: "string" },
          },
        },
        required: ["adjectives", "do_examples", "dont_examples"],
        additionalProperties: false,
      },
      website_copy: {
        type: "array",
        description:
          "One entry per requested page, in the order the pages are listed in the request. Do not add a page that was not requested, and do not leave one out.",
        items: {
          type: "object",
          properties: {
            page: {
              type: "string",
              // Énuméré côté outil en plus du zod : le modèle ne peut pas
              // inventer une clé de page, plutôt que d'échouer après coup.
              enum: [...PAGES_WANTED],
              description:
                "The page key, exactly as given in the request.",
            },
            sections: {
              type: "array",
              description:
                "The page's sections in reading order, 2 to 6 of them, each with a heading and finished body copy.",
              items: {
                type: "object",
                properties: {
                  heading: {
                    type: "string",
                    description: "Section heading, as it appears on the page.",
                  },
                  body: {
                    type: "string",
                    description:
                      "Finished, publishable body copy. Plain prose, no placeholder, no lorem ipsum, no bracketed blanks.",
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
          "Specs for 3 to 4 reusable branded social templates. Return an empty array if social templates were not requested.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Template name." },
            purpose: {
              type: "string",
              description: "What this template is for and when to reach for it.",
            },
            layout: {
              type: "string",
              description:
                "Layout spec: format and aspect ratio, composition, which palette hex goes where, which typeface at which weight and rough size.",
            },
            example_caption: {
              type: "string",
              description:
                "One example caption in this practice's voice. Publishable copy — psychoeducation only.",
            },
          },
          required: ["name", "purpose", "layout", "example_caption"],
          additionalProperties: false,
        },
      },
      website_prompt: {
        type: "string",
        description:
          "One single ready-to-paste prompt that builds this website, written to work in Squarespace, Lovable, Framer and Webflow. Describe the site once, then add a short per-platform note wherever the instruction differs between the four. Include the exact hex values, both typeface names, the page structure and the primary action.",
      },
    },
    required: [
      "positioning_statement",
      "brand_story",
      "voice_and_tone",
      "website_copy",
      "social_templates",
      "website_prompt",
    ],
    additionalProperties: false,
  },
};

/*
 * Garde-fou de niveau 1 : le socle déontologique pilote le modèle dès la
 * première tentative. Il vient AVANT le cadrage produit — aucune consigne de
 * style ne peut se lire comme une permission de l'assouplir.
 *
 * L'avertissement About/Approach est explicite : c'est la page où l'on
 * raconte pourquoi on fait ce métier, donc celle où « et vous repartirez
 * apaisé » s'écrit tout seul.
 */
export const KIT_SYSTEM_PROMPT = `${ETHICS_SYSTEM_RULES}

You are a senior brand strategist and copywriter for Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States.

Everything you write here is copy this clinician will publish on their own website, under their own license. Two pages deserve particular care:

- The ABOUT page is where a clinician's own story turns into a claim about what the reader will get. Write why this practice exists and how the clinician works. Never write what the reader will feel, become, or be free of.
- The APPROACH page is where a modality turns into a promised outcome. Name the modality, explain what a session actually looks like, say what the work attends to. Never say what it achieves, resolves, or how long it takes.

Every heading and every sentence of every page must satisfy the rules above. When a sentence is borderline, rewrite it as a description of the work.`;

/** Nombre de reprises accordées au modèle après une violation bloquante. */
const ETHICS_MAX_RETRIES = 2;

function pageLabel(page: PageKey): string {
  return optionLabel(PAGE_OPTIONS, page) ?? page;
}

function hexList(palette: Partial<Palette>): string {
  const entries = Object.entries(palette).filter(([, hex]) => Boolean(hex));
  if (entries.length === 0) return "not specified";
  return entries.map(([role, hex]) => `${role} ${hex}`).join(", ");
}

export function buildKitPrompt({
  projectName,
  draft,
  direction,
  scope,
}: KitInput): string {
  const name = practiceName(projectName, draft);

  const pages = scope.pages
    .map((page) => `  - ${page} (${pageLabel(page)})`)
    .join("\n");

  const social = scope.includeSocialTemplates
    ? "Specs for 3 to 4 branded social templates: format and aspect ratio, composition, which palette color goes where, which typeface at which weight, and one example caption per template in this practice's voice."
    : "No social templates in this deliverable — return an empty array for social_templates.";

  return `${buildBriefContext(projectName, draft, { includeProof: true })}

The clinician has chosen this creative direction, and the whole kit must sound and look like it:

- Direction: ${direction.name}
- What it is: ${direction.description}
- Palette: ${hexList(direction.palette)}
- Heading typeface: ${direction.heading_font}
- Body typeface: ${direction.body_font}

Build the complete brand kit for "${name}".

Website copy — write finished, publishable copy for exactly these pages, in this order, and no others:
${pages}

Each page gets 2 to 6 sections, each with a heading and real body copy. No placeholders, no bracketed blanks, no "insert your…". Where a page needs a fact you were not given — a fee, an address, a license number — write the sentence around it so the clinician only has to drop the value in, and never invent one.

Social templates — ${social}

Website prompt — one single prompt the clinician can paste into a site builder to get this website built. It has to work in Squarespace, Lovable, Framer AND Webflow: describe the site once, then note per platform wherever the instruction differs between the four. Spell out the exact hex values, both typeface names, the page structure, and the primary action ("${draft.primary_action ?? "the main call to action"}").

Write everything in warm, grounded, plain American English. No hype, no startup vocabulary, no sales pressure: this is a clinician speaking to someone who is deciding whether to reach out.`;
}

/**
 * Appel modèle, isolé pour que la garde déontologique et les tests puissent
 * l'envelopper. `feedback` est nul à la première tentative, puis porte
 * l'instruction corrective construite à partir des violations trouvées.
 */
export type KitModelCall = (
  prompt: string,
  feedback: string | null
) => Promise<KitGeneration>;

/*
 * Budget de sortie du kit. Il est bien plus large que celui des directions :
 * jusqu'à 8 pages de copy, les specs sociales et le prompt multi-plateformes
 * dans une seule réponse — auxquels s'ajoutent les jetons de raisonnement, la
 * réflexion adaptative étant active par défaut sur Claude Opus 5.
 */
export const KIT_MAX_TOKENS = 32000;

/*
 * Au-delà de ce budget, le SDK REFUSE un appel non streamé.
 *
 * `Anthropic.calculateNonstreamingTimeout()` estime la durée à
 * `60 min × max_tokens / 128000` et lève dès que ça dépasse 10 minutes, soit
 * `max_tokens > 21333`. C'est un garde CLIENT : il se déclenche avant le
 * moindre appel réseau, en zéro seconde, sans statut HTTP ni entrée dans
 * l'onglet Réseau — ce qui rendait la panne invisible.
 *
 * C'est exactement ce qui séparait les deux générations : les directions
 * (8000 jetons) passent sous le seuil, le kit (32000) le franchit. Même clé,
 * même SDK, même modèle — seul le budget différait.
 *
 * D'où le streaming ci-dessous, qui est la réponse prévue par le SDK.
 */
export const NON_STREAMING_MAX_TOKENS = Math.floor((128000 * 10) / 60);

const callAnthropic: KitModelCall = async (prompt, feedback) => {
  /*
   * Streaming obligatoire, pas décoratif : sans lui, `messages.create()` lève
   * côté client avant d'émettre la requête (cf. NON_STREAMING_MAX_TOKENS).
   * `finalMessage()` rassemble le flux et rend le message complet, donc le
   * reste de la fonction reste identique à celui des directions.
   */
  const response = await getAnthropicClient()
    .messages.stream({
      model: "claude-opus-5",
      max_tokens: KIT_MAX_TOKENS,
      output_config: { effort: "medium" },
      system: KIT_SYSTEM_PROMPT,
      tools: [KIT_TOOL],
      tool_choice: { type: "tool", name: KIT_TOOL.name },
      messages: [
        {
          role: "user",
          content: feedback ? `${prompt}\n\n${feedback}` : prompt,
        },
      ],
    })
    .finalMessage();

  return parseKitResponse(response);
};

/**
 * Transforme une réponse du modèle en kit validé, ou lève en nommant la raison.
 *
 * Extrait de l'appel réseau pour être testable sans API : c'est ici que se
 * décide la différence entre un échec DIAGNOSTIQUÉ et un « Something went
 * wrong » opaque.
 */
export function parseKitResponse(response: Anthropic.Message): KitGeneration {
  if (response.stop_reason === "refusal") {
    throw new Error("The model refused to generate the brand kit.");
  }

  /*
   * Coupure par `max_tokens` : le bloc d'outil est alors incomplet et son JSON
   * ne se valide pas. On le dit ICI, tant qu'on connaît la vraie raison —
   * sinon l'échec se présente plus bas comme une banale erreur de structure.
   */
  if (response.stop_reason === "max_tokens") {
    throw new KitTruncatedError();
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("No brand kit was generated.");
  }

  return kitGenerationSchema.parse(toolUse.input);
}

/**
 * Aligne le kit sur le périmètre demandé : lève si une page manque, écarte
 * celles qui n'ont pas été demandées, et remet l'ensemble dans l'ordre du
 * périmètre.
 *
 * Une page en trop est un surplus sans conséquence (on la retire, en le
 * journalisant) ; une page en moins est un livrable incomplet, donc un échec.
 */
export function applyScope(
  generation: KitGeneration,
  scope: KitScope
): KitGeneration {
  const byPage = new Map(
    generation.website_copy.map((page) => [page.page, page])
  );

  const missing = scope.pages.filter((page) => !byPage.has(page));
  if (missing.length > 0) {
    throw new KitScopeError(missing);
  }

  const extra = generation.website_copy
    .map((page) => page.page)
    .filter((page) => !scope.pages.includes(page));
  if (extra.length > 0) {
    console.warn(
      `[kit] pages rendues sans avoir été demandées, écartées : ${extra.join(", ")}`
    );
  }

  return {
    ...generation,
    website_copy: scope.pages.map((page) => byPage.get(page)!),
  };
}

/**
 * Génération gardée, avec l'appel modèle injecté — le point d'entrée des tests.
 *
 * Ne renvoie jamais un résultat non conforme : soit le kit passe la validation
 * structurelle, la validation de périmètre ET la validation déontologique, soit
 * l'appel lève (`EthicsComplianceError` après épuisement des reprises,
 * `KitScopeError`, ou l'erreur structurelle) et rien n'est persisté.
 */
export function generateKitWithModel(
  input: KitInput,
  callModel: KitModelCall
): Promise<KitGeneration> {
  const prompt = buildKitPrompt(input);

  return generateWithEthicsGuard(
    async (feedback) => applyScope(await callModel(prompt, feedback), input.scope),
    {
      publishableText: (kit: KitGeneration) =>
        publishableKitText(kit as KitContent, kit.website_prompt),
      label: "kit",
      maxRetries: ETHICS_MAX_RETRIES,
    }
  );
}

export function generateBrandKit(input: KitInput): Promise<KitGeneration> {
  return generateKitWithModel(input, callAnthropic);
}
