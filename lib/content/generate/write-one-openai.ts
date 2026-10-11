import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { copyCallFor, validateCopy, type CopyResult } from "@/lib/content/generate/copy-batch";
import { meteredCall, openAiRefusal, type OpenAiTransport, type SpendMeter } from "@/lib/content/generate/openai";
import { openAiBody, openAiText } from "@/lib/content/generate/provider";
import type { WriteOneInput, WriteOneResult } from "@/lib/content/generate/write-one";

/*
 * ── « WRITE IT » SUR LE FOURNISSEUR RETENU ──────────────────────────────
 *
 * ⚠ LE MÊME CONTRAT QUE `writeOnePost`, SUR OPENAI. « Write it » appelait
 * Anthropic, dont la clé n'existe dans aucun environnement (F44) : le bouton
 * restait éteint pendant que le mois, lui, passait sur OpenAI. Ce module garde
 * l'ordre du rédacteur unitaire — archétype vérifié avant l'appel, une seule
 * relance, `validateCopy` — et le corps est celui du mois (`openAiBody` sur
 * `copyCallFor`) : sortie stricte sur le schéma de l'archétype, même préfixe.
 *
 * ⚠ ET IL REND SON COÛT, CALCULÉ AU TARIF LU. Le coût Anthropic
 * (`syncCostUsd`) appliqué à des jetons OpenAI mettrait au livre un chiffre faux.
 */
export type OpenAiWriteOneConfig = {
  transport: OpenAiTransport;
  /** Le compteur de CETTE requête : il borne ce qu'un clic peut coûter. */
  meter: SpendMeter;
  model: string;
};

export type PricedWriteOneResult = WriteOneResult & { costUsd: number };

export function openAiWriteOne(config: OpenAiWriteOneConfig) {
  return async function writeOne(input: WriteOneInput): Promise<PricedWriteOneResult> {
    const { brand, topic } = input;
    if (!ARCHETYPE_KEYS.includes(topic.archetypeKey)) {
      return {
        topicId: topic.topicId,
        ok: false,
        reason: "unknown_archetype",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        retried: false,
        costUsd: 0,
      };
    }
    const body = openAiBody({ ...copyCallFor(brand, topic), model: config.model });

    const attempt = async (): Promise<{ result: CopyResult; usage: WriteOneResult["usage"]; costUsd: number }> => {
      const { response, usage, costUsd } = await meteredCall(
        config.transport,
        config.meter,
        config.model,
        body,
        `write it ${topic.topicId}`
      );
      const refusal = openAiRefusal(response);
      const result: CopyResult = refusal
        ? { topicId: topic.topicId, ok: false, reason: "model_refusal", family: "refused" }
        : { ...validateCopy(topic.archetypeKey, openAiText(response)), topicId: topic.topicId };
      return { result, usage, costUsd };
    };

    const first = await attempt();
    if (first.result.ok || input.retryOnce === false) {
      return { ...first.result, topicId: topic.topicId, usage: first.usage, retried: false, costUsd: first.costUsd };
    }
    /* Une seule relance, à l'identique — comme le mois et comme `writeOnePost`. */
    const second = await attempt();
    return {
      ...second.result,
      topicId: topic.topicId,
      usage: {
        input: first.usage.input + second.usage.input,
        output: first.usage.output + second.usage.output,
        cacheRead: first.usage.cacheRead + second.usage.cacheRead,
        cacheWrite: first.usage.cacheWrite + second.usage.cacheWrite,
      },
      retried: true,
      costUsd: first.costUsd + second.costUsd,
    };
  };
}

/**
 * La clé du rédacteur est-elle là ? Lue à la requête, jamais au chargement.
 *
 * ⚠ ICI ET PAS DANS LA PAGE : seul le générateur nomme ce qui dépense
 * (`content-never-generates.test.ts`).
 */
export function onDemandWriterConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
