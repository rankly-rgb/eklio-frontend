import type Anthropic from "@anthropic-ai/sdk";
import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { budgetErrors, type BudgetError } from "@/lib/compose/budget";

/*
 * ── LA RÉDACTION DE MASSE : BATCH + PROMPT CACHING ──────────────────────
 *
 * Trente publications par mois et par abonnée. À ce volume, deux réglages ne
 * sont pas des optimisations mais la différence entre une marge et aucune :
 *
 *   * la BATCH API : -50 % sur l'entrée ET la sortie ;
 *   * le PROMPT CACHING : le préfixe (marque, règles ACA/APA, format de
 *     sortie, schéma de l'archétype) est identique d'une carte à l'autre. Il
 *     est long et il ne bouge pas ; seul le sujet change.
 *
 * Les deux multiplicateurs se cumulent.
 *
 * ── ⚠ LE PRÉFIXE DOIT ÊTRE STABLE À L'OCTET ─────────────────────────────
 *
 * Le cache est un préfixe, pas un ensemble. Un seul octet différent n'importe
 * où dedans, et tout ce qui suit est réécrit au plein tarif — silencieusement,
 * avec la bonne réponse et la mauvaise facture.
 *
 * Les invalidateurs silencieux qu'on évite ici, nommément :
 *   * aucune date, aucun identifiant de requête, aucun compteur dans le
 *     préfixe ;
 *   * les règles déontologiques sont TRIÉES par id avant d'être rendues — la
 *     base ne promet pas d'ordre, et un `select` qui rend les six dans un
 *     autre ordre un jour sur deux n'a jamais de cache ;
 *   * la section variable vient APRÈS le dernier `cache_control`, toujours.
 *
 * `usage.cache_read_input_tokens` est lu et rapporté par `collectCopy` : un
 * zéro constant est la preuve qu'un invalidateur est entré, et c'est le seul
 * symptôme qu'il ait.
 *
 * ── SUR L'IDENTIFIANT DE MODÈLE ─────────────────────────────────────────
 *
 * `claude-haiku-4-5-20251001` est l'identifiant Claude API de Haiku 4.5, et il
 * est DATÉ. Les identifiants non datés (`claude-opus-5`, `claude-sonnet-5`)
 * valent pour les modèles plus récents ; les deux formes coexistent, selon la
 * génération.
 *
 * Piloté par `CONTENT_COPY_MODEL` pour qu'un changement de modèle soit une
 * variable et non un déploiement.
 */

/** Le modèle de rédaction de masse. Identifiant daté, voir la note ci-dessus. */
export const MASS_COPY_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

/**
 * ⚠ UNE FONCTION, PAS UNE CONSTANTE DE MODULE. Même raison que pour le modèle
 * d'image : une lecture d'environnement au chargement fige la réponse à
 * l'import. Aucune lecture d'environnement au chargement d'un module dans ce
 * dépôt — voir `CONTENT_BUG_REPORT.md` §2.2.
 */
export function massCopyModel(): string {
  return process.env.CONTENT_COPY_MODEL ?? MASS_COPY_MODEL_DEFAULT;
}

/**
 * Tarifs, en dollars par million de tokens, pour l'estimation de coût.
 *
 * ⚠ CE SONT DES ESTIMATIONS, ET `settle_credit` ÉCRIT LE COÛT RÉEL. Elles
 * servent à réserver avant l'appel, jamais à facturer : le ledger porte
 * `estimated_cost_usd` et `actual_cost_usd` dans deux colonnes distinctes
 * précisément pour que l'écart soit mesurable.
 */
export const HAIKU_PRICE = {
  inputPerMTok: 1.0,
  outputPerMTok: 5.0,
  /** Batch: -50 % sur l'entrée comme sur la sortie. */
  batchMultiplier: 0.5,
  /** Un token lu depuis le cache coûte ~10 % d'un token d'entrée. */
  cacheReadMultiplier: 0.1,
  /** L'écrire coûte ~25 % de plus qu'un token d'entrée ordinaire. */
  cacheWriteMultiplier: 1.25,
} as const;

export type BrandContext = {
  practiceName: string;
  voice: string;
  offLimits: string;
  /** Les six règles déontologiques, telles que la base les porte. */
  ethicsRules: Array<{ id: string; short_label: string; description: string }>;
};

export type TopicRequest = {
  /** `custom_id` du batch. ⚠ Les résultats reviennent dans un ordre quelconque. */
  topicId: string;
  archetypeKey: string;
  title: string;
  hook: string;
  intent: string;
  /** Ce que son check-in a dit ce mois-ci. Variable, donc après le cache. */
  checkin: string;
};

/* ── Le préfixe stable ───────────────────────────────────────────────── */

/**
 * Le schéma de l'archétype, en mots, pour le modèle.
 *
 * Dérivé du catalogue plutôt que recopié : le jour où un archétype change de
 * bornes, la consigne donnée au modèle change avec lui. Une consigne recopiée
 * serait une troisième source, après la base et le validateur.
 */
export function archetypeInstruction(archetypeKey: string): string {
  const entry = ARCHETYPES[archetypeKey];
  if (!entry) throw new Error(`copy-batch: unknown archetype ${archetypeKey}`);

  const SHAPES: Record<string, string> = {
    single_statement: `{"statement": "one sentence, 3 to 24 words"}`,
    quadrant_model: `{"axis_x": "1-3 words", "axis_y": "1-3 words", "items": [4 x {"label": "1-3 words", "gloss": "1-6 words"}]}`,
    cycle: `{"nodes": [3 to 6 x {"label": "1-3 words", "gloss": "1-6 words"}]}`,
    surface_and_beneath: `{"surface": {"label": "1-3 words", "gloss": "1-6 words"}, "beneath": {same}}`,
    /*
     * ⚠ « [2-4 items] » NE DIT PAS CE QU'EST UN ITEM, et c'était la seule
     * ligne de cette table à ne pas le dire. Les neuf autres écrivent
     * `{"label": …, "gloss": …}` en toutes lettres ; celle-ci laissait le
     * modèle inventer la forme, et `entry.parse` refusait ensuite le payload
     * en bloc — `payload_shape`, sans dire quelle clef manquait. Le premier
     * mois réel a rendu dix refus de cette famille sur trente.
     */
    comparison_pair:
      `{"left": [2 to 4 x {"label": "1-3 words", "gloss": "1-6 words"}], ` +
      `"right": [the SAME number, same shape]}`,
    numbered_strategies: `{"items": [3 to 5 x {"label": "1-3 words", "gloss": "1-6 words"}]}`,
    lettered_technique: `{"acronym": "3 to 5 letters", "items": [one per letter, each label STARTING with that letter, in order]}`,
    concentric_control: `{"rings": [2 to 4 x {"label": "1-3 words", "gloss": "1-6 words"}], outermost first}`,
    annotated_curve: `{"axis_x": "1-3 words", "axis_y": "1-3 words", "points": [2 to 4 x {"label": "1-3 words", "gloss": "1-6 words"}]}`,
    practitioner_card: `{"lines": [2 to 4 strings, each 1 to 8 words]}`,
    carousel: `{"cards": [3 to 8 x {"archetype_key": "any archetype except carousel", "payload": {that archetype's shape}}]}`,
  };

  /*
   * ── ⚠ LE CARROUSEL EST LE SEUL À QUI ON NE DISAIT PAS LE BUDGET ───────
   *
   * Dix archétypes recevaient leurs bornes en toutes lettres — « 1-3 words »,
   * « 1-6 words ». Le onzième, celui qui EMPILE trois à huit payloads,
   * recevait « that archetype's shape » et rien d'autre : ni les formes, ni
   * les nombres. Le modèle devait deviner, sur chaque carte, et il suffisait
   * d'un seul `gloss` trop long pour que `validateCopy` refuse le carrousel
   * entier. Deux tentatives, puis « That came out too long for a card. »
   *
   * Trouvé par le premier rendu réel : le carrousel à la demande a échoué
   * trois fois de suite sur `over_budget`, pendant que les cartes simples
   * passaient.
   *
   * Les formes sont reprises de `SHAPES`, jamais recopiées — une seconde
   * liste serait la façon exacte dont le budget d'un archétype changerait
   * ici sans changer là.
   */
  if (archetypeKey === "carousel") {
    const inner = Object.entries(SHAPES)
      .filter(([key]) => key !== "carousel")
      .map(([key, shape]) => `  * "${key}": ${shape}`)
      .join("\n");

    return [
      `Archetype "carousel". The payload object must be exactly:`,
      SHAPES.carousel,
      ``,
      `Each card's "archetype_key" is one of these, and its "payload" must`,
      `match that archetype's shape EXACTLY — the same word limits apply to`,
      `every card, and one label of four words throws the whole carousel away:`,
      inner,
    ].join("\n");
  }

  return `Archetype "${archetypeKey}". The payload object must be exactly:\n${SHAPES[archetypeKey]}`;
}

/**
 * Le préfixe mis en cache : marque, déontologie, format, schéma.
 *
 * ⚠ RIEN DE VARIABLE N'ENTRE ICI. Pas de date, pas d'identifiant de sujet, pas
 * de compteur. Le check-in du mois non plus — il change chaque mois, et il
 * réécrirait le cache à chaque fois.
 */
export function cachedPrefix(brand: BrandContext, archetypeKey: string): Anthropic.TextBlockParam[] {
  // ⚠ TRIÉES. La base ne promet aucun ordre, et six règles rendues dans un
  // ordre différent d'un run à l'autre suffisent à ne jamais rien cacher.
  const rules = [...brand.ethicsRules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `- ${r.short_label}: ${r.description}`)
    .join("\n");

  const text = [
    `You write social copy for a licensed psychotherapist in private practice.`,
    ``,
    `PRACTICE: ${brand.practiceName}`,
    `VOICE: ${brand.voice}`,
    `OFF LIMITS: ${brand.offLimits || "nothing stated"}`,
    ``,
    `ADVERTISING ETHICS (ACA / APA). These are not style notes. A board reads`,
    `what is published under a licensee's name, and a promise of outcome is the`,
    `kind of sentence that costs a licence rather than a client.`,
    rules,
    ``,
    `NEVER: guarantee an outcome, diagnose, imply a cure, name or describe a`,
    `client (real, composite or anonymised), compare yourself to other`,
    `practitioners, or claim a speciality you were not given.`,
    ``,
    `OUTPUT FORMAT. Reply with ONE JSON object and nothing else — no prose`,
    `before it, no code fence around it:`,
    `{"payload": {...}, "caption": "...", "alt_text": "...", "rationale": "..."}`,
    ``,
    `- "payload" follows the archetype shape below, exactly.`,
    `- "caption" is what she posts: at most 2200 characters.`,
    `- "alt_text" describes the card for a screen reader: at most 420 characters.`,
    `- "rationale" is one sentence, at most 20 words, completing "Why this one:".`,
    ``,
    `⚠ WORD COUNTS ARE HARD LIMITS, not suggestions. A label of four words is`,
    `rejected and the whole card is regenerated. Count before you answer.`,
    ``,
    archetypeInstruction(archetypeKey),
  ].join("\n");

  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

/** La partie variable. Après le dernier `cache_control`, toujours. */
export function variablePart(topic: TopicRequest): string {
  return [
    `TOPIC: ${topic.title}`,
    `HOOK: ${topic.hook}`,
    `INTENT: ${topic.intent}`,
    topic.checkin ? `THIS MONTH SHE SAID: ${topic.checkin}` : `THIS MONTH SHE SAID: nothing`,
  ].join("\n");
}

/* ── Le batch ────────────────────────────────────────────────────────── */

export function buildBatchRequests(
  brand: BrandContext,
  topics: TopicRequest[]
): Anthropic.Messages.Batches.BatchCreateParams["requests"] {
  return topics.map((topic) => ({
    custom_id: topic.topicId,
    params: {
      model: massCopyModel(),
      max_tokens: 2000,
      /*
       * ⚠ LE PRÉFIXE EST DANS `system`, PAS DANS `messages`. L'ordre de rendu
       * est tools → system → messages : un préfixe placé dans le premier
       * message d'utilisateur serait précédé, dans le rendu, par un `system`
       * qui pourrait bouger — et il faudrait alors cacher les deux.
       */
      system: cachedPrefix(brand, topic.archetypeKey),
      messages: [{ role: "user" as const, content: variablePart(topic) }],
    },
  }));
}

export type CopyResult = {
  topicId: string;
  ok: boolean;
  payload?: unknown;
  caption?: string;
  altText?: string;
  rationale?: string;
  reason?: string;
  budget?: BudgetError[];
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
};

/**
 * Valide une sortie de modèle contre le schéma de l'archétype.
 *
 * ⚠ REJETÉE, JAMAIS RÉPARÉE. Le brief demande une relance unique puis un
 * échec marqué : « pas de dégradation silencieuse ». Réparer un payload à trois
 * items pour en faire un quadrant produirait une carte que personne n'a écrite,
 * et personne ne saurait qu'elle a été fabriquée ici.
 */
export function validateCopy(archetypeKey: string, raw: string): CopyResult {
  const base = { topicId: "", ok: false as const };

  let parsed: unknown;
  try {
    // Un modèle qui entoure son JSON d'un fence malgré la consigne est une
    // sortie non conforme, mais c'en est une qu'on sait lire sans rien deviner.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { ...base, reason: "not_json" };
  }

  const o = parsed as Record<string, unknown>;
  if (typeof o?.caption !== "string" || typeof o?.alt_text !== "string") {
    return { ...base, reason: "missing_fields" };
  }
  if (o.caption.length > 2200) return { ...base, reason: "caption_too_long" };
  if (o.alt_text.length > 420) return { ...base, reason: "alt_text_too_long" };

  const entry = ARCHETYPES[archetypeKey];
  if (!entry) return { ...base, reason: "unknown_archetype" };
  if (entry.parse(o.payload) === null) return { ...base, reason: "payload_shape" };

  const budget = budgetErrors(archetypeKey, o.payload);
  if (budget.length > 0) return { ...base, reason: "over_budget", budget };

  return {
    topicId: "",
    ok: true,
    payload: o.payload,
    caption: o.caption,
    altText: o.alt_text,
    rationale: typeof o.rationale === "string" ? o.rationale : "",
  };
}

/**
 * Ce qu'un batch a coûté, en dollars, depuis ses `usage`.
 *
 * ⚠ LE CACHE ET LE BATCH SE CUMULENT, et l'ordre des multiplications le dit :
 * un token lu depuis le cache coûte un dixième d'un token d'entrée, puis la
 * moitié parce que c'est un batch.
 */
export function batchCostUsd(
  usages: Array<{ input: number; output: number; cacheRead: number; cacheWrite: number }>
): number {
  const m = HAIKU_PRICE.batchMultiplier;
  let total = 0;
  for (const u of usages) {
    total += (u.input / 1e6) * HAIKU_PRICE.inputPerMTok * m;
    total += (u.output / 1e6) * HAIKU_PRICE.outputPerMTok * m;
    total +=
      (u.cacheRead / 1e6) * HAIKU_PRICE.inputPerMTok * HAIKU_PRICE.cacheReadMultiplier * m;
    total +=
      (u.cacheWrite / 1e6) * HAIKU_PRICE.inputPerMTok * HAIKU_PRICE.cacheWriteMultiplier * m;
  }
  return total;
}

/**
 * Le même calcul, pour un appel qui n'est PAS dans un lot.
 *
 * ⚠ IL EXISTE PARCE QUE LE LEDGER ÉTAIT VIDE D'ARGENT. `batchCostUsd` était
 * le seul chemin vers un coût, et la moitié synchrone du produit — « Write
 * it » — n'avait donc rien à écrire dans `credit_ledger.actual_cost_usd` :
 * elle passait `null`. Le crédit était compté, la dépense ne l'était pas, et
 * un plafond lu dans le ledger lisait zéro quoi qu'il arrive.
 *
 * La remise de 50 % du lot ne s'applique pas ici, et c'est la seule
 * différence : les prix, les multiplicateurs de cache et la table sont ceux
 * d'à côté, pour qu'un changement de tarif n'ait qu'un endroit à corriger.
 */
export function syncCostUsd(
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
): number {
  return (
    (usage.input / 1e6) * HAIKU_PRICE.inputPerMTok +
    (usage.output / 1e6) * HAIKU_PRICE.outputPerMTok +
    (usage.cacheRead / 1e6) * HAIKU_PRICE.inputPerMTok * HAIKU_PRICE.cacheReadMultiplier +
    (usage.cacheWrite / 1e6) * HAIKU_PRICE.inputPerMTok * HAIKU_PRICE.cacheWriteMultiplier
  );
}

/**
 * Lit les résultats d'un batch terminé.
 *
 * ⚠ LES RÉSULTATS REVIENNENT DANS UN ORDRE QUELCONQUE. Ils sont indexés par
 * `custom_id`, jamais par position — c'est écrit dans la documentation de
 * l'API et c'est le genre de détail dont l'oubli produit trente cartes
 * correctes attribuées aux mauvais sujets.
 */
export function collectCopy(
  entries: Array<{
    custom_id: string;
    result: { type: string; message?: Anthropic.Message };
  }>,
  archetypeByTopic: Map<string, string>
): CopyResult[] {
  return entries.map((entry) => {
    if (entry.result.type !== "succeeded" || !entry.result.message) {
      return { topicId: entry.custom_id, ok: false, reason: entry.result.type };
    }

    const message = entry.result.message;
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const archetypeKey = archetypeByTopic.get(entry.custom_id);
    if (!archetypeKey) {
      return { topicId: entry.custom_id, ok: false, reason: "unknown_topic" };
    }

    const usage = {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    };

    return { ...validateCopy(archetypeKey, text), topicId: entry.custom_id, usage };
  });
}
