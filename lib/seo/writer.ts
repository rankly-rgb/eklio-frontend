import { OPENAI_COPY_MODEL, openAiText, type CopyUsage } from "@/lib/content/generate/provider";
import {
  meteredCall,
  openAiRefusal,
  worstCaseCallUsd,
  type OpenAiTransport,
  type SpendMeter,
} from "@/lib/content/generate/openai";
import { writerSystemPrompt, writerUserPrompt, type FailureReport, type SeoWriterBrief } from "@/lib/seo/brief";
import { writerOutputJsonSchema } from "@/lib/seo/output";
import { META_RANGE, TITLE_MAX } from "@/lib/seo/kinds";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE RÉDACTEUR SEO — UN PORT, LE SEUL ACCÈS PAYANT DU PIPELINE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE N'EST PAS LE `WriterPort` INSTAGRAM, ET C'EST VOULU. Celui-là
 * (`lib/content/month/orchestrate.ts:160`) prend des sujets tirés d'une banque
 * et rend des posts de carte ; une page de 1 000 mots n'a ni sujet, ni carte, ni
 * archétype. On réutilise ce qui EST générique en dessous, sans y toucher :
 *
 *   openAiTransport   l'appel HTTP, ses relances et ses erreurs typées ;
 *   meteredCall       la réservation du PIRE coût avant l'envoi, puis le coût réel ;
 *   spendMeter        le plafond, qui refuse l'appel qui le franchirait ;
 *   OPENAI_COPY_MODEL le modèle retenu et son tarif lu (`gpt-5.6-terra`).
 *
 * Le port ne valide rien et ne décide de rien : il rend ce que le modèle a écrit,
 * analysé en JSON ou non. Les contrôles sont au pipeline (`checks.ts`). Un
 * rédacteur qui filtrerait serait un second arbitre.
 *
 * ⚠ AUCUNE DOUBLURE DE CE PORT DANS LE PRODUIT. Les tests en injectent une ; le
 * produit n'a que celle-ci. Une doublure dans `lib/` finirait appelée par une
 * route un jour de clé absente, et rendrait un faux mois « vert ».
 */

export type SeoWriteRequest = { brief: SeoWriterBrief; failure?: FailureReport };

export type SeoWriteResult = {
  /** Le JSON rendu, ou null quand la réponse n'en était pas (refus, coupure). */
  output: unknown;
  /** Pourquoi `output` est null, en clair. */
  problem: string | null;
  model: string;
  costUsd: number;
  usage: CopyUsage;
};

/*
 * ── LA RÉPARATION D'UN CHAMP (session 3) ────────────────────────────────
 *
 * La meta description trop courte (ou trop longue), le title trop long : la première
 * cause d'échec mesurée, et un défaut du modèle que le brief n'a pas su corriger.
 * Les réécrire en réécrivant TOUTE la pièce coûtait un appel complet et remettait en
 * jeu tout le reste du texte. La réparation est un appel COURT, qui ne rend que le
 * champ fautif, avec le début de la pièce en contexte. Le pipeline repasse ensuite la
 * pièce réparée par TOUS les contrôles, Ethics Guard compris.
 */
export type RepairableField = "meta_description" | "title";

export type FieldRepairRequest = {
  field: RepairableField;
  current: string;
  /** Le constat, tel que le contrôle l'a écrit. */
  problem: string;
  primaryQuery: string;
  h1: string;
  /** Le premier paragraphe de la pièce : de quoi elle parle. */
  intro: string;
};

export type FieldRepairResult = {
  /** Le nouveau texte du champ, ou null si la réponse n'en contenait pas. */
  value: string | null;
  model: string;
  costUsd: number;
  usage: CopyUsage;
};

export type SeoWriterPort = {
  readonly model: string;
  /** Le pire coût de cet appel, en dollars — ce que le livre réserve avant. */
  worstCaseUsd(request: SeoWriteRequest): number;
  write(request: SeoWriteRequest): Promise<SeoWriteResult>;
  worstCaseRepairUsd(request: FieldRepairRequest): number;
  repairField(request: FieldRepairRequest): Promise<FieldRepairResult>;
};

const FIELD_RULE: Record<RepairableField, (r: FieldRepairRequest) => string> = {
  meta_description: () =>
    `${META_RANGE.min} to ${META_RANGE.max} characters (aim for 150), one or two sentences, no quotation marks. Count the characters before answering.`,
  title: (r) => `at most ${TITLE_MAX} characters, and it contains the exact phrase "${r.primaryQuery}".`,
};

/** Le plafond d'une réparation : une phrase, plus le raisonnement facturé en sortie. */
const REPAIR_MAX_OUTPUT_TOKENS = 2_000;

export function repairRequestBody(model: string, r: FieldRepairRequest): Record<string, unknown> {
  return {
    model,
    instructions: [
      "You fix ONE field of a web page written for a licensed psychotherapist in the United States. American English.",
      `The field is the page ${r.field === "title" ? "title (the <title> tag)" : "meta description"}.`,
      `It must be ${FIELD_RULE[r.field](r)}`,
      "Keep the meaning and the tone of the current version. Describe the work; never promise an outcome, never diagnose, no testimonials, no superlatives.",
      "Return only the JSON object the schema describes.",
    ].join("\n"),
    input: [
      `Current ${r.field}: ${JSON.stringify(r.current)}`,
      `Why it fails: ${r.problem}`,
      `Page H1: ${JSON.stringify(r.h1)}`,
      `Opening paragraph: ${JSON.stringify(r.intro.slice(0, 1200))}`,
    ].join("\n"),
    max_output_tokens: REPAIR_MAX_OUTPUT_TOKENS,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "eklio_seo_field",
        strict: true,
        schema: { type: "object", additionalProperties: false, required: ["value"], properties: { value: { type: "string" } } },
      },
    },
    store: false,
  };
}

/**
 * Le plafond de sortie : 1 600 mots ≈ 2 200 jetons, la FAQ, l'enveloppe JSON, et
 * le raisonnement facturé en sortie. Assez pour ne pas couper une page ; borné
 * pour que le pire coût réservé reste lisible (≈ 0,15 $).
 */
const MAX_OUTPUT_TOKENS = 12_000;

export function seoRequestBody(model: string, request: SeoWriteRequest): Record<string, unknown> {
  return {
    model,
    instructions: writerSystemPrompt(request.brief),
    input: writerUserPrompt(request.brief, request.failure),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { effort: "low" },
    text: {
      format: { type: "json_schema", name: "eklio_seo_piece", strict: true, schema: writerOutputJsonSchema() },
    },
    /* Même règle que le rédacteur Instagram : un texte publié sous une licence ne se stocke pas chez le fournisseur. */
    store: false,
  };
}

export function openAiSeoWriter(config: {
  transport: OpenAiTransport;
  meter: SpendMeter;
  model?: string;
}): SeoWriterPort {
  const model = config.model ?? OPENAI_COPY_MODEL;
  return {
    model,
    worstCaseUsd: (request) => worstCaseCallUsd(model, seoRequestBody(model, request)),
    async write(request) {
      const { response, usage, costUsd } = await meteredCall(
        config.transport,
        config.meter,
        model,
        seoRequestBody(model, request),
        `seo:${request.brief.kind}${request.failure ? ":rewrite" : ""}`
      );
      const refusal = openAiRefusal(response);
      if (refusal) return { output: null, problem: `the model refused: ${refusal}`, model, costUsd, usage };
      if (response.status && response.status !== "completed") {
        return {
          output: null,
          problem: `response ${response.status}: ${response.incomplete_details?.reason ?? "unknown"}`,
          model,
          costUsd,
          usage,
        };
      }
      const text = openAiText(response);
      try {
        return { output: JSON.parse(text), problem: null, model, costUsd, usage };
      } catch {
        return { output: null, problem: "the answer was not valid JSON", model, costUsd, usage };
      }
    },
    worstCaseRepairUsd: (request) => worstCaseCallUsd(model, repairRequestBody(model, request)),
    async repairField(request) {
      const { response, usage, costUsd } = await meteredCall(
        config.transport,
        config.meter,
        model,
        repairRequestBody(model, request),
        `seo:repair:${request.field}`
      );
      if (openAiRefusal(response) || (response.status && response.status !== "completed")) {
        return { value: null, model, costUsd, usage };
      }
      try {
        const parsed = JSON.parse(openAiText(response)) as { value?: unknown };
        return { value: typeof parsed.value === "string" ? parsed.value.trim() : null, model, costUsd, usage };
      } catch {
        return { value: null, model, costUsd, usage };
      }
    },
  };
}
