import type Anthropic from "@anthropic-ai/sdk";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE FOURNISSEUR DE RÉDACTION, DERRIÈRE UNE SEULE COUTURE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `lib/content/generate/model.ts` portait déjà la décision, prise au lot 2 :
 * un seul fournisseur pour le texte, et une interface pour que « passer sur
 * OpenAI plus tard soit une implémentation d'une interface ». C'est ce fichier.
 *
 * ⚠ CE QU'IL ABSTRAIT EST ÉTROIT, ET C'EST VOULU. Un appel de rédaction, chez
 * l'un comme chez l'autre, c'est cinq choses : un modèle, un préfixe stable
 * qu'on veut voir mis en cache, une partie variable, un plafond de sortie, un
 * effort. Tout le reste du pipeline — `cachedPrefix`, `variablePart`,
 * `validateCopy`, les bornes de budget de mots, les onze archétypes — est déjà
 * neutre et ne bouge pas d'une ligne.
 *
 * ⚠ AUCUN ACCÈS RÉSEAU ICI. Ce module ne fait que traduire. Le transport est
 * injecté, comme `lib/images/client.ts` le fait depuis l'origine : c'est ce qui
 * permet d'éprouver les deux traductions sans dépenser un centime, et c'est la
 * seule raison pour laquelle ce fichier a des tests alors qu'aucune clef OpenAI
 * n'a jamais été utilisée dans ce dépôt pour du texte.
 */

export type CopyProviderName = "anthropic" | "openai";

/**
 * Le fournisseur, piloté par l'environnement.
 *
 * ⚠ ANTHROPIC PAR DÉFAUT, ET PAS PAR PRUDENCE — par mesurabilité. Le bras de
 * référence doit rester celui qu'on obtient sans rien poser.
 */
export function copyProvider(): CopyProviderName {
  return process.env.CONTENT_COPY_PROVIDER === "openai" ? "openai" : "anthropic";
}

/** Un appel de rédaction, dit sans vocabulaire de fournisseur. */
export type CopyCall = {
  model: string;
  /** Le préfixe stable. C'est lui qu'on veut voir lu depuis le cache. */
  prefix: string;
  /** Ce qui change d'un post à l'autre. */
  variable: string;
  maxTokens: number;
  effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  /**
   * L'archétype, qui sert de clef de cache.
   *
   * ⚠ UNE ENTRÉE DE CACHE PAR ARCHÉTYPE, DES DEUX CÔTÉS. Le préfixe contient
   * la forme de l'archétype ; chez OpenAI le schéma de sortie en dépend aussi,
   * et `text_format_changed` est l'un des motifs d'invalidation déclarés par
   * le SDK. Mélanger deux archétypes sous une même clef ne cacherait rien.
   */
  archetypeKey: string;
};

/** Ce qu'un appel rend, dit sans vocabulaire de fournisseur. */
export type CopyUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

/* ── 1. La traduction vers Anthropic ─────────────────────────────────── */

export function anthropicBody(call: CopyCall): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: call.model,
    max_tokens: call.maxTokens,
    /*
     * ⚠ LE PRÉFIXE EST DANS `system`, PAS DANS `messages`. L'ordre de rendu est
     * tools → system → messages : un préfixe placé dans le premier message
     * d'utilisateur serait précédé, dans le rendu, par un `system` qui pourrait
     * bouger — et il faudrait alors cacher les deux.
     */
    system: [{ type: "text", text: call.prefix, cache_control: { type: "ephemeral" } }],
    output_config: { effort: call.effort },
    messages: [{ role: "user", content: call.variable }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming;
}

export function anthropicUsage(usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): CopyUsage {
  return {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    cacheRead: usage?.cache_read_input_tokens ?? 0,
    cacheWrite: usage?.cache_creation_input_tokens ?? 0,
  };
}

/* ── 2. La traduction vers OpenAI ────────────────────────────────────── */

/**
 * Le corps d'un appel `POST /v1/responses`.
 *
 * ── ⚠ CHAQUE NOM DE CHAMP VIENT DES DÉCLARATIONS DU SDK OFFICIEL ────────
 *
 * Les pages de documentation d'OpenAI sont inaccessibles depuis cet
 * environnement (403 au CONNECT sur `developers.openai.com`,
 * `platform.openai.com` et `api.openai.com`). Les noms ci-dessous ont donc été
 * lus dans `openai@7.23.0`, `resources/responses/responses.d.ts`, qui est
 * généré depuis la spécification de l'API et fait foi sur la FORME :
 *
 *   `instructions`            l'équivalent du `system` d'Anthropic
 *   `input`                   la partie variable
 *   `max_output_tokens`       le plafond de sortie
 *   `reasoning.effort`        none|minimal|low|medium|high|xhigh|max
 *   `text.format`             `{type:"json_schema", name, schema, strict}`
 *   `prompt_cache_key`        la clef qui route vers la même entrée de cache
 *   `prompt_cache_retention`  'in_memory' | '24h'
 *
 * ⚠ LA MISE EN CACHE N'EST PAS MARQUÉE BLOC PAR BLOC ICI. Anthropic demande un
 * `cache_control` sur le bloc à cacher ; OpenAI cache le préfixe commun tout
 * seul et `prompt_cache_key` ne fait que router les requêtes vers la même
 * entrée. Le SDK déclare les motifs d'invalidation, et deux d'entre eux nous
 * concernent directement : `text_format_changed` et `reasoning_effort_changed`.
 * L'effort et le schéma doivent donc être CONSTANTS pour une clef donnée, sinon
 * le cache se reconstruit à chaque appel et la remise disparaît.
 */
export function openAiBody(call: CopyCall): Record<string, unknown> {
  return {
    model: call.model,
    instructions: call.prefix,
    input: call.variable,
    max_output_tokens: call.maxTokens,
    reasoning: { effort: call.effort },
    prompt_cache_key: `eklio-copy-${call.archetypeKey}`,
    prompt_cache_retention: "24h",
    text: { format: copyEnvelopeFormat() },
    /*
     * ⚠ ON NE STOCKE PAS LA RÉPONSE CHEZ LE FOURNISSEUR. Ce sont des textes
     * publiés sous la licence d'une clinicienne ; les garder côté fournisseur
     * n'apporte rien au pipeline et ajoute une copie à laquelle personne n'a
     * pensé.
     */
    store: false,
  };
}

/**
 * Le schéma de sortie : l'ENVELOPPE, pas le payload.
 *
 * ── ⚠ POURQUOI `strict: false` ET NON `true` ────────────────────────────
 *
 * La sortie structurée stricte est le meilleur argument d'OpenAI pour ce
 * pipeline : la classe d'échec « not_json / champ manquant » disparaît par
 * construction. Mais `strict: true` exige `additionalProperties: false` sur
 * CHAQUE objet du schéma — donc un schéma complet pour le payload de chacun des
 * onze archétypes.
 *
 * Or les formes d'archétype n'ont PAS de définition machine dans ce dépôt :
 * `SHAPES` (copy-batch.ts) les décrit en prose à l'intention du modèle, et le
 * moteur de composition les lit champ par champ. Écrire onze schémas JSON à la
 * main créerait une SECONDE SOURCE DE VÉRITÉ pour la forme des cartes — et
 * celle des deux qu'on oublie de mettre à jour est celle qui décide.
 *
 * L'enveloppe, elle, est fixe et identique pour les onze. Elle est donc
 * contrainte ici, strictement dans son esprit sinon dans son drapeau, et le
 * payload reste libre. C'est là que vivaient les échecs de forme mesurables :
 * un champ absent, une clef mal nommée, du texte avant l'accolade.
 *
 * Le jour où les archétypes gagnent une définition machine — un schéma zod
 * dans `lib/compose/archetypes` que le moteur ET le prompt liraient — ce
 * schéma-ci devient dérivable et `strict: true` devient gratuit. Consigné.
 */
export function copyEnvelopeFormat(): Record<string, unknown> {
  return {
    type: "json_schema",
    name: "eklio_copy",
    strict: false,
    schema: {
      type: "object",
      properties: {
        payload: { type: "object", description: "the archetype's shape, exactly as the prefix describes it" },
        card_line: { type: "string" },
        caption: { type: "string" },
        alt_text: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["payload", "card_line", "caption", "alt_text", "rationale"],
    },
  };
}

/** Le texte d'une réponse `/v1/responses`. */
export function openAiText(response: {
  output_text?: string | null;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }> | null;
} | null | undefined): string {
  /*
   * ⚠ `output_text` EST UNE COMMODITÉ, PAS UNE GARANTIE. Le SDK la fournit et
   * la documente comme « à préférer là où elle existe » ; la forme canonique
   * reste la liste `output`. On lit la commodité, et on retombe sur la liste —
   * l'inverse aurait fait dépendre le pipeline d'un champ que la version
   * suivante peut cesser de remplir.
   */
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const blocks = response?.output ?? [];
  return blocks
    .flatMap((b) => b.content ?? [])
    .filter((c) => c?.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
}

export function openAiUsage(usage: {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null;
} | null | undefined): CopyUsage {
  return {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    /*
     * ⚠ OPENAI DÉCLARE LES DEUX MOITIÉS, comme Anthropic : `cached_tokens` pour
     * la lecture, `cache_write_tokens` pour l'écriture. La comptabilité de coût
     * du pipeline n'a donc rien à approximer d'un côté ni de l'autre.
     */
    cacheRead: usage?.input_tokens_details?.cached_tokens ?? 0,
    cacheWrite: usage?.input_tokens_details?.cache_write_tokens ?? 0,
  };
}

/* ── 3. Le Batch, et ce qu'il impose de différent ────────────────────── */

/**
 * Ce qu'un lot OpenAI exige, et qui n'a pas d'équivalent chez Anthropic.
 *
 * ⚠ TROIS APPELS LÀ OÙ ANTHROPIC EN DEMANDE UN. Anthropic prend les requêtes
 * dans le corps de `messages.batches.create`. OpenAI exige d'abord un FICHIER
 * JSONL téléversé (`POST /v1/files`, `purpose: "batch"`), puis
 * `POST /v1/batches` qui référence son identifiant, puis un téléchargement du
 * fichier de sortie. Le pipeline qui soumet doit donc connaître cette
 * différence — elle n'est pas cachable derrière la traduction d'un corps.
 *
 * ⚠ ET LA FENÊTRE EST DE 24 H, SEULE VALEUR DÉCLARÉE. `BatchCreateParams`
 * n'accepte que `completion_window: '24h'`. Le harnais de mois abandonne un lot
 * au bout de 90 minutes (`BATCH_DEADLINE_MS`) : cette borne est la nôtre, pas
 * celle du fournisseur, et elle reste valable — mais un lot OpenAI abandonné à
 * 90 minutes peut continuer à être facturé jusqu'à son terme.
 */
export const OPENAI_BATCH = {
  endpoint: "/v1/responses",
  completionWindow: "24h",
  filesPurpose: "batch",
} as const;

/** Une ligne du JSONL d'un lot OpenAI. */
export function openAiBatchLine(customId: string, call: CopyCall): Record<string, unknown> {
  return {
    custom_id: customId,
    method: "POST",
    url: OPENAI_BATCH.endpoint,
    body: openAiBody(call),
  };
}

/* ── 4. Les deux candidats OpenAI, et le tarif qu'on n'a pas pu lire ──── */

/**
 * Les deux candidats retenus pour la mesure à trois bras.
 *
 * ── ⚠ CHOISIS SUR LE CATALOGUE DE PREMIÈRE MAIN, PAS SUR LEUR PRIX ──────
 *
 * Le prix n'a PAS pu être lu. Tous les domaines d'OpenAI sont refusés par la
 * politique d'egress de cet environnement — `developers.openai.com`,
 * `platform.openai.com`, `api.openai.com`, `openai.com`, `cdn.openai.com` :
 * 403 au CONNECT. Une recherche web rend des agrégateurs tiers, et ils se
 * contredisent sur le même modèle au sein d'une même page (« $4/$20 » puis
 * « $5/$30 » pour `gpt-5.6-sol`). Un tarif tiers contradictoire n'est pas une
 * source, et le brief demandait la fiche.
 *
 * Ce qui A pu être lu de première main est le CATALOGUE, dans
 * `openai@7.23.0`, `resources/shared.d.ts`, type `ChatModel`. Il est ordonné
 * du plus récent au plus ancien, et à l'intérieur d'une génération, du plus
 * capable au moins capable :
 *
 *   gpt-6-astra, gpt-6-sol, gpt-6-luna,
 *   gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna,
 *   gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, …
 *
 * Trois paliers nommés dans la famille 5.6, dans cet ordre. D'où :
 *
 *   `economy`  `gpt-5.6-luna`  le palier bas de la famille complète la plus
 *                              récente — la position qu'occupaient `mini` puis
 *                              `nano` dans les générations précédentes.
 *   `quality`  `gpt-5.6-terra` le palier médian, celui dont on attend une
 *                              qualité voisine de Sonnet.
 *
 * ⚠ CE CHOIX EST UNE HYPOTHÈSE DE POSITION, PAS UNE MESURE DE PRIX. Il ne
 * devient un choix qu'une fois les deux tarifs lus sur la page. C'est la
 * première commande de la session suivante, et `priceRefusal` ci-dessous
 * l'impose plutôt que de la recommander.
 */
export const OPENAI_COPY_CANDIDATES = {
  economy: "gpt-5.6-luna",
  quality: "gpt-5.6-terra",
} as const;

/** Où le tarif se lit. Écrit ici pour qu'un message d'erreur puisse le citer. */
export const PRICE_SOURCE = "https://developers.openai.com/api/docs/pricing";

/**
 * Les modèles dont le tarif a été LU à la source, avec la date de lecture.
 *
 * ── ⚠ UN TARIF NON VÉRIFIÉ NE DOIT PAS POUVOIR PRODUIRE UN COÛT ─────────
 *
 * `rateFor` retombe sur le tarif le plus cher connu quand un modèle lui est
 * inconnu, et c'est le bon comportement POUR UN PLAFOND : on préfère s'arrêter
 * trop tôt. Mais c'est le mauvais comportement pour la seule grandeur que cette
 * bascule doit mesurer — un candidat OpenAI facturé au tarif d'Opus sortirait
 * cinq fois plus cher qu'il n'est, et la comparaison conclurait l'inverse de la
 * vérité.
 *
 * Deux besoins, deux réponses. Le plafond garde l'estimation prudente ; la
 * MESURE, elle, refuse de rendre un chiffre. C'est exactement la classe de F27
 * (« les deux moitiés justes, la jonction fausse ») et celle de F41 (« un taux
 * sans son dénominateur est une opinion »).
 */
export const PRICE_VERIFIED_ON: Record<string, string> = {
  "claude-sonnet-5": "2026-09-21",
  "claude-haiku-4-5": "2026-09-21",
  "claude-haiku-4-5-20251001": "2026-09-21",
  "claude-opus-5": "2026-09-21",
};

export function priceVerified(model: string): boolean {
  return Boolean(PRICE_VERIFIED_ON[model]);
}

/**
 * Le message à afficher plutôt qu'un coût, quand le tarif n'a pas été lu.
 *
 * ⚠ IL NOMME LE MODÈLE ET LA PAGE. « Tarif inconnu » envoie chercher ; « lis
 * gpt-5.6-luna sur cette page » se règle en une minute.
 */
export function priceRefusal(model: string): string | null {
  if (priceVerified(model)) return null;
  return (
    `refus de chiffrer un coût pour « ${model} » : son tarif n'a pas été lu à la source. ` +
    `Lire l'entrée de ce modèle sur ${PRICE_SOURCE} (entrée, sortie, et entrée mise en cache), ` +
    `l'ajouter à MODEL_RATES et la dater dans PRICE_VERIFIED_ON. ` +
    `Sans cela, rateFor() applique le tarif le plus cher connu — prudent pour un plafond, ` +
    `faux pour une comparaison.`
  );
}
