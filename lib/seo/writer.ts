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

export type SeoWriterPort = {
  readonly model: string;
  /** Le pire coût de cet appel, en dollars — ce que le livre réserve avant. */
  worstCaseUsd(request: SeoWriteRequest): number;
  write(request: SeoWriteRequest): Promise<SeoWriteResult>;
};

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
  };
}
