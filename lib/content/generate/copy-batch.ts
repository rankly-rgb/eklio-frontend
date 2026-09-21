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
/*
 * ── LA FORME, LES COMPTES, ET UN EXEMPLE QUI PASSE ──────────────────────
 *
 * ⚠ TROIS CHOSES, PAS UNE. Dire « 1-3 words » ne suffit pas : mesuré le
 * 2026-09-21, le lot rendait 1 post valide sur 30 et 29 refus, dont 13 sur le
 * seul budget de mots, toujours par 1 à 3 mots de trop. Un modèle qui dépasse
 * de deux mots n'a pas mal lu la borne, il ne l'a pas comptée.
 *
 * Chaque archétype porte donc : sa forme, le COMPTE de chaque champ écrit en
 * toutes lettres, et un EXEMPLE conforme — un objet complet qui passerait la
 * base tel quel. Un exemple est la seule façon de montrer à quoi ressemblent
 * trois mots.
 *
 * ⚠ ET TROIS ENTRÉES, LÀ OÙ LA BASE EN ACCEPTE PLUS. `content_topic_payload_valid`
 * autorise jusqu'à six nœuds ou cinq stratégies ; on en demande trois. La
 * mesure dit pourquoi : à quatre entrées et plus, le libellé se pose à son
 * plancher de 28px, ce qui fait 9,1px dans une vignette de 350. La borne de la
 * base ne bouge pas — on lui demande moins que ce qu'elle tolère.
 */
type Shape = { shape: string; example: string };

const SHAPES: Record<string, Shape> = {
  single_statement: {
    shape: `{"statement": "ONE sentence, between 3 and 24 words"}`,
    example: `{"statement": "Rest is not a switch your body flips when the day ends."}  (11 words)`,
  },
  quadrant_model: {
    shape:
      `{"axis_x": "1 to 3 words", "axis_y": "1 to 3 words", ` +
      `"items": [EXACTLY 4 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}]}`,
    example:
      `{"axis_x": "effort", "axis_y": "rest", "items": [` +
      `{"label": "Sunday dread", "gloss": "starts before the alarm"}, ` +
      `{"label": "Rest fails", "gloss": "the body stays braced"}, ` +
      `{"label": "Still bracing", "gloss": "nothing asked it to"}, ` +
      `{"label": "Sleep breaks", "gloss": "waking at four"}]}`,
  },
  cycle: {
    shape: `{"nodes": [3 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}]}`,
    example:
      `{"nodes": [{"label": "Push harder", "gloss": "the list gets done"}, ` +
      `{"label": "Run empty", "gloss": "nothing left by Friday"}, ` +
      `{"label": "Brace again", "gloss": "Monday asks the same"}]}`,
  },
  surface_and_beneath: {
    shape:
      `{"surface": {"label": "1 to 3 words", "gloss": "1 to 6 words"}, ` +
      `"beneath": {"label": "1 to 3 words", "gloss": "1 to 6 words"}}`,
    example:
      `{"surface": {"label": "Handling it", "gloss": "every deadline met"}, ` +
      `"beneath": {"label": "Running empty", "gloss": "no memory of resting"}}`,
  },
  comparison_pair: {
    shape:
      `{"left": [2 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}], ` +
      `"right": [THE SAME NUMBER, same shape]}`,
    example:
      `{"left": [{"label": "Looks fine", "gloss": "shows up on time"}, ` +
      `{"label": "Sounds steady", "gloss": "answers every message"}], ` +
      `"right": [{"label": "Feels braced", "gloss": "shoulders never drop"}, ` +
      `{"label": "Sleeps light", "gloss": "awake before the alarm"}]}`,
  },
  numbered_strategies: {
    shape: `{"items": [3 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}]}`,
    example:
      `{"items": [{"label": "Name it", "gloss": "say what today cost"}, ` +
      `{"label": "Slow down", "gloss": "one thing at a time"}, ` +
      `{"label": "Stop early", "gloss": "before the tank empties"}]}`,
  },
  lettered_technique: {
    shape:
      `{"acronym": "3 letters", "items": [ONE PER LETTER, IN ORDER, each ` +
      `{"label": "1 to 3 words STARTING with that letter", "gloss": "1 to 6 words"}]}`,
    example:
      `{"acronym": "RSV", "items": [{"label": "Rest", "gloss": "before it is earned"}, ` +
      `{"label": "Slow", "gloss": "one thing at a time"}, ` +
      `{"label": "Voice", "gloss": "say what it costs"}]}`,
  },
  concentric_control: {
    shape: `{"rings": [3 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}], outermost first}`,
    example:
      `{"rings": [{"label": "The workload", "gloss": "not yours to set"}, ` +
      `{"label": "The pace", "gloss": "partly yours to set"}, ` +
      `{"label": "The stopping", "gloss": "entirely yours"}]}`,
  },
  annotated_curve: {
    shape:
      `{"axis_x": "1 to 3 words", "axis_y": "1 to 3 words", ` +
      `"points": [3 x {"label": "1 to 3 words", "gloss": "1 to 6 words"}]}`,
    example:
      `{"axis_x": "weeks back", "axis_y": "load", "points": [` +
      `{"label": "First day", "gloss": "running on relief"}, ` +
      `{"label": "Week three", "gloss": "the relief runs out"}, ` +
      `{"label": "Week six", "gloss": "the old pace returns"}]}`,
  },
  practitioner_card: {
    shape: `{"lines": [2 to 4 strings, each 1 to 8 words]}`,
    example: `{"lines": ["EMDR for burnout", "Oakland, California", "Taking new clients"]}`,
  },
  carousel: {
    shape: `{"cards": [3 to 6 x {"archetype_key": "any archetype except carousel", "payload": {that archetype's shape}}]}`,
    example:
      `{"cards": [{"archetype_key": "single_statement", "payload": ` +
      `{"statement": "Rest is not a switch your body flips."}}, ` +
      `{"archetype_key": "surface_and_beneath", "payload": ` +
      `{"surface": {"label": "Handling it", "gloss": "every deadline met"}, ` +
      `"beneath": {"label": "Running empty", "gloss": "no memory of resting"}}}, ` +
      `{"archetype_key": "single_statement", "payload": ` +
      `{"statement": "Safety is learned, and learning it takes longer than a weekend."}}]}`,
  },
};

/**
 * Le schéma de l'archétype, en mots, pour le modèle.
 *
 * Dérivé du catalogue plutôt que recopié : un archétype absent du catalogue
 * lève ici, avant l'appel.
 */
export function archetypeInstruction(archetypeKey: string): string {
  const entry = ARCHETYPES[archetypeKey];
  if (!entry) throw new Error(`copy-batch: unknown archetype ${archetypeKey}`);
  const shape = SHAPES[archetypeKey];
  if (!shape) throw new Error(`copy-batch: no shape written for ${archetypeKey}`);

  /*
   * ── ⚠ LE CARROUSEL EST LE SEUL À QUI ON NE DISAIT PAS LE BUDGET ───────
   *
   * Dix archétypes recevaient leurs bornes en toutes lettres ; le onzième,
   * celui qui EMPILE trois à huit payloads, recevait « that archetype's
   * shape » et rien d'autre. Il suffisait d'un `gloss` trop long pour que
   * `validateCopy` refuse le carrousel entier.
   */
  if (archetypeKey === "carousel") {
    const inner = Object.entries(SHAPES)
      .filter(([key]) => key !== "carousel")
      .map(([key, value]) => `  * "${key}": ${value.shape}`)
      .join("\n");

    return [
      `Archetype "carousel". The payload object must be exactly:`,
      shape.shape,
      ``,
      `A CONFORMING EXAMPLE — count the words in it before you write your own:`,
      shape.example,
      ``,
      `Each card's "archetype_key" is one of these, and its "payload" must`,
      `match that archetype's shape EXACTLY — the same word limits apply to`,
      `every card, and one label of four words throws the whole carousel away:`,
      inner,
    ].join("\n");
  }

  return [
    `Archetype "${archetypeKey}". The payload object must be exactly:`,
    shape.shape,
    ``,
    `A CONFORMING EXAMPLE — count the words in it before you write your own:`,
    shape.example,
  ].join("\n");
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
    `{"payload": {...}, "card_line": "...", "caption": "...", "alt_text": "...", "rationale": "..."}`,
    ``,
    `- "payload" follows the archetype shape below, exactly.`,
    `- "card_line" is the line printed across the top of the card: AT MOST 30`,
    `  CHARACTERS, including spaces. Count them.`,
    `- "caption" is what she posts: at most 2200 characters.`,
    `- "alt_text" describes the card for a screen reader: at most 420 characters.`,
    `- "rationale" is one sentence, at most 20 words, completing "Why this one:".`,
    ``,
    `⚠ WHY "card_line" IS THIRTY CHARACTERS AND NOT A TITLE. The card sets that`,
    `line as large as it fits, and every other size on the card is derived from`,
    `it — a label may never exceed a third of it. Measured: at 30 characters the`,
    `line sets at 110px and the labels at 36px, which is 11.7px in a 350px`,
    `Instagram thumbnail. At 34 characters the line drops to 96px, the labels to`,
    `32px, and the diagram stops being readable in a feed. Four characters.`,
    ``,
    `⚠ WORD COUNTS ARE HARD LIMITS, not suggestions, and this is where answers`,
    `die. A database CHECK counts the words and refuses the whole card; nothing`,
    `is repaired for you. Measured on the first real month: 29 cards of 30 were`,
    `refused, 13 of them on the word budget alone, and EVERY overrun was by one`,
    `to three words.`,
    ``,
    `Count articles, prepositions and hyphenated halves as words. Write the`,
    `shortest true phrase, never a sentence. If a phrase runs long, cut it`,
    `rather than rephrase it.`,
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
  /**
   * La ligne imprimée en haut de la carte, au plus 30 caractères.
   *
   * ⚠ FACULTATIVE DANS LA VALIDATION, DEMANDÉE DANS LE PRÉFIXE. La rendre
   * obligatoire ferait échouer tout ce qui a été écrit avant qu'elle existe —
   * y compris les relances d'un lot déjà parti — pour un champ dont l'absence
   * a un repli évident : le titre du sujet.
   */
  cardLine?: string;
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
  if (budget.length > 0) {
    /*
     * ⚠ LE PAYLOAD PART AVEC LE REFUS, et c'est ce qui rend une réparation
     * possible. Il a été lu, il parse, il ne lui manque que quelques mots ;
     * le jeter obligeait l'appelant à tout redemander — légende, texte
     * alternatif et diagramme — pour un `gloss` trop long.
     *
     * ⚠ `ok` RESTE FAUX. Rendre le payload n'est pas l'accepter : personne
     * ne doit pouvoir l'écrire en base sans être passé par une réparation
     * qui le fait rentrer dans les bornes.
     */
    return { ...base, reason: "over_budget", budget, payload: o.payload,
             caption: typeof o.caption === "string" ? o.caption : undefined,
             altText: typeof o.alt_text === "string" ? o.alt_text : undefined,
             rationale: typeof o.rationale === "string" ? o.rationale : undefined,
             cardLine: typeof o.card_line === "string" ? clampCardLine(o.card_line) : undefined };
  }

  return {
    topicId: "",
    ok: true,
    payload: o.payload,
    /*
     * ⚠ TRONQUÉE, JAMAIS REFUSÉE, ET SUR UNE FRONTIÈRE DE MOT. Trente
     * caractères est une contrainte de rendu, pas une règle de fond : un
     * modèle qui en écrit trente-deux a répondu à la question. `clampTitle`
     * du mois faisait déjà ce geste plus bas dans la chaîne ; le faire ici
     * évite qu'il y ait deux endroits où la même borne se décide.
     */
    cardLine: typeof o.card_line === "string" ? clampCardLine(o.card_line) : undefined,
    caption: o.caption,
    altText: o.alt_text,
    rationale: typeof o.rationale === "string" ? o.rationale : "",
  };
}

/** Au plus `CARD_LINE_MAX` caractères. */
export const CARD_LINE_MAX = 30;

/*
 * ── ⚠ « WHEN LIFE INTERRUPTS, YOU GET » ────────────────────────────────
 *
 * C'est le titre qu'une carte du mois de wren.ashcombe a porté, et le contrôle
 * indépendant l'a nommé le défaut le plus visible du lot : « titre tronqué en
 * plein milieu d'une phrase — ne se termine jamais ».
 *
 * La coupe était pourtant correcte au sens où elle était écrite : trente
 * caractères, sur une frontière de mot. Le défaut n'est pas le point de coupe,
 * c'est de s'arrêter sur un MOT OUTIL. « you get » n'a de sens qu'en attendant
 * la suite ; « When life interrupts » se tient tout seul.
 *
 * La coupe préfère donc, dans l'ordre : une frontière de proposition — une
 * virgule, un tiret, deux points, qui sont des endroits où une phrase a le
 * droit de s'arrêter — puis une frontière de mot dont on retire les mots
 * outils traînants.
 */

/** Les mots sur lesquels un titre ne peut pas se terminer. */
const DANGLING = new Set([
  "a", "an", "the", "and", "or", "but", "if", "when", "while", "that", "this",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as", "into",
  "is", "are", "was", "were", "be", "been", "am", "do", "does", "did",
  "have", "has", "had", "get", "gets", "got", "your", "you", "its", "it",
  "their", "they", "we", "our", "my", "his", "her", "not", "no", "so", "than",
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  "what", "which", "who", "how", "why", "still", "even", "just", "about",
]);

export function clampCardLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length <= CARD_LINE_MAX) return trimmed;

  const cut = trimmed.slice(0, CARD_LINE_MAX);

  // Une frontière de proposition : un endroit où la phrase s'arrêtait déjà.
  const clause = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(";"), cut.lastIndexOf(":"), cut.lastIndexOf(" — "));
  if (clause > 12) return cut.slice(0, clause).trimEnd();

  const boundary = cut.lastIndexOf(" ");
  let words = (boundary > 12 ? cut.slice(0, boundary) : cut).trimEnd().split(/\s+/);

  // ⚠ ON NE DESCEND JAMAIS SOUS DEUX MOTS. Retirer les mots outils d'un titre
  // qui n'en a que deux laisserait un seul mot, ce qui est un sujet et non un
  // titre — mieux vaut alors la coupe telle quelle.
  while (words.length > 2 && DANGLING.has(words[words.length - 1].toLowerCase().replace(/[^a-z']/g, ""))) {
    words = words.slice(0, -1);
  }
  return words.join(" ").replace(/[,;:]$/, "");
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
