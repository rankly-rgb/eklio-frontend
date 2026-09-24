import type Anthropic from "@anthropic-ai/sdk";
import {
  cachedPrefix,
  massCopyModel,
  copyEffort,
  validateCopy,
  variablePart,
  type BrandContext,
  type CopyResult,
  type TopicRequest,
} from "@/lib/content/generate/copy-batch";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";

/*
 * ── ÉCRIRE UN SEUL POST, MAINTENANT ─────────────────────────────────────
 *
 * ⚠ CE N'EST PAS UN SECOND CHEMIN DE GÉNÉRATION, ET C'EST LA CONTRAINTE
 * CENTRALE DE CE FICHIER.
 *
 * Même préfixe mis en cache (`cachedPrefix`), même partie variable
 * (`variablePart`), même validateur (`validateCopy`), mêmes bornes de budget
 * de mots, même catalogue d'archétypes. La seule différence avec le mois est
 * l'appel : `messages.create` au lieu de `messages.batches.create`.
 *
 * Un second prompt, même « juste pour un post », voudrait dire deux endroits
 * où les règles déontologiques sont écrites — et le jour où l'un des deux
 * change, la moitié des posts sort sous des règles périmées sans que rien ne
 * le dise.
 *
 * ⚠ ET LE PRÉFIXE EST TOUJOURS CACHÉ. Un appel synchrone perd la remise Batch
 * de 50 %, pas le cache : le même préfixe, à la même place, vaut une lecture à
 * 0,1× dès le deuxième post écrit dans la fenêtre. C'est ce qui rend « Write
 * it » bon marché au onzième clic, pas au premier.
 */

/** Ce que l'appelant injecte. Aucun accès réseau n'est construit ici. */
export type WriteOnePort = {
  create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
};

export type WriteOneInput = {
  brand: BrandContext;
  topic: TopicRequest;
  /**
   * ⚠ UNE SEULE RELANCE, ET ELLE EST DANS LE CONTRAT, PAS DANS UNE BOUCLE.
   * Le mois relance une fois puis marque l'échec ; ici c'est pareil. Une
   * boucle transformerait un archétype que le modèle n'arrive pas à remplir
   * en une facture qui monte pendant qu'elle regarde un spinner.
   */
  retryOnce?: boolean;
};

export type WriteOneResult = CopyResult & {
  /** Ce que l'appel a réellement consommé, pour le règlement du crédit. */
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** Vrai quand la première sortie a été rejetée et une seconde demandée. */
  retried: boolean;
};

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function usageOf(message: Anthropic.Message) {
  const u = message.usage;
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Un post, écrit et validé.
 *
 * ⚠ LE RÉSULTAT PORTE SON `usage` MÊME QUAND IL ÉCHOUE. Une sortie rejetée a
 * coûté des jetons ; les oublier ferait mentir le journal dans le sens qui
 * arrange, et le coût réel d'une fonctionnalité se mesure sur ses échecs
 * autant que sur ses succès.
 */
export async function writeOnePost(
  port: WriteOnePort,
  input: WriteOneInput
): Promise<WriteOneResult> {
  const { brand, topic } = input;

  if (!ARCHETYPE_KEYS.includes(topic.archetypeKey)) {
    /*
     * Refusé AVANT l'appel : `cachedPrefix` lèverait de toute façon sur un
     * archétype inconnu, mais après avoir laissé croire qu'un appel partait.
     */
    return {
      topicId: topic.topicId,
      ok: false,
      reason: "unknown_archetype",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      retried: false,
    };
  }

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: massCopyModel(),
    max_tokens: 2000,
    // ⚠ MÊME PLACE QUE DANS LE BATCH : `system`, pas le premier message.
    // L'ordre de rendu est tools → system → messages ; déplacer le préfixe
    // invaliderait le cache que le mois vient de remplir.
    system: cachedPrefix(brand, topic.archetypeKey),
    output_config: { effort: copyEffort() },
    messages: [{ role: "user", content: variablePart(topic) }],
  };

  const first = await port.create(params);
  const firstUsage = usageOf(first);
  const firstResult = validateCopy(topic.archetypeKey, textOf(first));

  if (firstResult.ok || input.retryOnce === false) {
    return { ...firstResult, topicId: topic.topicId, usage: firstUsage, retried: false };
  }

  /*
   * ⚠ LA RELANCE NE DIT PAS AU MODÈLE CE QU'IL A RATÉ, et c'est délibéré :
   * ajouter le motif d'échec à la fin du message changerait la partie
   * variable, pas le préfixe — donc le cache tient — mais ça ferait deux
   * formes de demande pour une même tâche, et la seconde n'est éprouvée par
   * aucune suite. Le mois relance à l'identique ; ici aussi.
   */
  const second = await port.create(params);
  const secondUsage = usageOf(second);
  const secondResult = validateCopy(topic.archetypeKey, textOf(second));

  return {
    ...secondResult,
    topicId: topic.topicId,
    usage: {
      input: firstUsage.input + secondUsage.input,
      output: firstUsage.output + secondUsage.output,
      cacheRead: firstUsage.cacheRead + secondUsage.cacheRead,
      cacheWrite: firstUsage.cacheWrite + secondUsage.cacheWrite,
    },
    retried: true,
  };
}
