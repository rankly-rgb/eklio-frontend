import type Anthropic from "@anthropic-ai/sdk";
import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { budgetErrors, type BudgetError } from "@/lib/compose/budget";
import { CANVAS, CONTENT_MIN_AT_CANVAS, THUMB, TYPE } from "@/lib/compose/constants";

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

/**
 * Le modèle de rédaction de masse.
 *
 * ── ⚠ SONNET PAR DÉFAUT DEPUIS LE 2026-09-24, ET C'EST UNE DÉCISION ────
 *
 * Les sept contrôles de F26 ont supprimé exactement les sept défauts qu'ils
 * nomment, et la note d'écriture est passée de 1,4 à 1,6 sur 5. **Un contrôle
 * refuse, il n'améliore pas.** Ce qui écrit doit changer.
 *
 * Le repli est Haiku, par la même variable : `CONTENT_COPY_MODEL=claude-haiku-4-5`
 * remet l'ancien comportement sans redéploiement.
 */
export const MASS_COPY_MODEL_DEFAULT = "claude-sonnet-5";

/** Le repli, quand la dépense l'impose. */
export const MASS_COPY_MODEL_FALLBACK = "claude-haiku-4-5-20251001";

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
const RATE_SHAPE = {
  /** Batch: -50 % sur l'entrée comme sur la sortie. */
  batchMultiplier: 0.5,
  /** Un token lu depuis le cache coûte ~10 % d'un token d'entrée. */
  cacheReadMultiplier: 0.1,
  /** L'écrire coûte ~25 % de plus qu'un token d'entrée ordinaire. */
  cacheWriteMultiplier: 1.25,
} as const;

/**
 * Les tarifs par modèle, en dollars par million de tokens.
 *
 * ── ⚠ LE TARIF SUIT LE MODÈLE, SINON TOUT CHIFFRE DE COÛT EST FAUX ─────
 *
 * `HAIKU_PRICE` était une constante, et `massCopyModel()` une variable
 * d'environnement. Basculer sur Sonnet sans toucher au tarif aurait rendu un
 * coût **divisé par deux** — les deux moitiés justes, la jonction fausse.
 * C'est exactement la classe de F27, et elle ne recommence pas sur la seule
 * grandeur dont cette session doit mesurer la variation.
 */
export const MODEL_RATES: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-5": { inputPerMTok: 2.0, outputPerMTok: 10.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  "claude-haiku-4-5-20251001": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  "claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
};

/**
 * ⚠ UN MODÈLE SANS TARIF PREND LE PLUS CHER CONNU, JAMAIS ZÉRO.
 *
 * Un tarif manquant qui rendrait 0 ferait apparaître un modèle inconnu comme
 * gratuit — et un plafond de session se lit sur ce chiffre-là. L'erreur penche
 * vers la surestimation : on préfère s'arrêter trop tôt que dépenser sans le
 * voir.
 */
export function rateFor(model: string): { inputPerMTok: number; outputPerMTok: number } {
  const known = MODEL_RATES[model];
  if (known) return known;
  const dearest = Object.values(MODEL_RATES).reduce((a, b) =>
    b.outputPerMTok > a.outputPerMTok ? b : a
  );
  return dearest;
}

/**
 * Tarifs, en dollars par million de tokens, pour l'estimation de coût.
 *
 * ⚠ CE SONT DES ESTIMATIONS, ET `settle_credit` ÉCRIT LE COÛT RÉEL. Elles
 * servent à réserver avant l'appel, jamais à facturer : le ledger porte
 * `estimated_cost_usd` et `actual_cost_usd` dans deux colonnes distinctes
 * précisément pour que l'écart soit mesurable.
 */
export const HAIKU_PRICE = { ...RATE_SHAPE, ...MODEL_RATES["claude-haiku-4-5"] } as const;

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
  /*
   * ── ⚠ UNE TECHNIQUE NOMMÉE, PAS UN SIGLE FABRIQUÉ ────────────────────
   *
   * La forme disait « 3 letters » et le modèle en fabriquait un depuis les
   * initiales de ses propres tuiles : « EMP », « EMD », « FTG », « ARC ».
   * Mesuré sur dix essais gelés, il en a inventé un à CHAQUE carte.
   *
   * ⚠ ET « EMD » EST À UNE LETTRE D'« EMDR ». Sur la carte d'une praticienne
   * EMDR, ça se lit comme une faute de frappe, ou pire comme un protocole
   * qu'elle aurait inventé.
   *
   * L'archétype existe pour porter une technique que la lectrice EMPORTE.
   * Le sigle est donc DONNÉ, choisi dans un catalogue, et les tuiles
   * développent ses lettres — l'inverse de ce qui se passait.
   */
  lettered_technique: {
    shape:
      `{"acronym": "EXACTLY one of: RAIN, STOP, HALT, SIFT, TIPP, GROW, SAFE, CALM, NAME, FACE", ` +
      `"items": [ONE PER LETTER OF THAT ACRONYM, IN ORDER, each ` +
      `{"label": "1 to 3 words STARTING with that letter", "gloss": "1 to 6 words"}]}`,
    example:
      `{"acronym": "STOP", "items": [{"label": "Stop", "gloss": "whatever you are doing"}, ` +
      `{"label": "Take a breath", "gloss": "one, slowly"}, ` +
      `{"label": "Observe", "gloss": "what the body is doing"}, ` +
      `{"label": "Proceed", "gloss": "with that in hand"}]}` +
      `  ⚠ NEVER invent an acronym from your own labels, and NEVER use a ` +
      `modality name. "EMDR", "IFS", "CBT", "ACT", "DBT" are treatments, not ` +
      `techniques a reader can carry out of a post, and a card that offers ` +
      `one as a mnemonic is refused. Pick a word from the list above and ` +
      `write a label for each of ITS letters, in order.`,
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
  /*
   * ⚠ `practitioner_card` N'EST PLUS ICI, ET C'EST LE POINT.
   *
   * Sa forme demandait au modèle « des faits sur sa façon de travailler ».
   * N'en ayant aucun, il en a fabriqué : « Rowan Mercier Therapy » et
   * « rowan@rowanmercier.com » sont sortis sur le mois d'une AUTRE
   * praticienne, dans deux mois sur douze.
   *
   * Ses lignes sont désormais assemblées depuis le brief
   * (`lib/content/practitioner.ts`) au moment de composer. Le modèle n'est
   * plus interrogé pour cet archétype : ce qu'il ne peut pas écrire, il ne
   * peut pas l'inventer. Un contrôle bloquant reste en place, mais comme
   * filet — plus comme seule défense.
   */
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
/**
 * Les archétypes dont le modèle écrit le payload.
 *
 * ⚠ CE N'EST PLUS LA LISTE DES ARCHÉTYPES. `practitioner_card` en est sorti :
 * ses lignes viennent du brief, pas d'un modèle. Tout ce qui tire un sujet ou
 * compose un mois doit lire CETTE liste, sinon il demandera au modèle un
 * payload qu'il n'a pas le droit d'écrire.
 */
export const MODEL_WRITTEN_ARCHETYPES = Object.keys(SHAPES);

/** Les archétypes qu'un carrousel a le droit d'empiler. */
export const CAROUSEL_INNER_ARCHETYPES = MODEL_WRITTEN_ARCHETYPES.filter((k) => k !== "carousel");

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
      /*
       * ── ⚠ LE MOT « payload » APPARAÎT DEUX FOIS, ET LE MODÈLE CONFOND ──
       *
       * Mesuré le 2026-09-23 : ZÉRO carrousel sur quatre-vingt-dix posts
       * livrés. Chacun était tiré, envoyé, PAYÉ, puis refusé sur
       * `payload_shape`. Une sonde a montré ce que le modèle rendait :
       *
       *   {"cards": [...], "card_line": "...", "caption": "..."}
       *
       * — `cards` au PREMIER niveau, et donc `o.payload` indéfini. Le
       * carrousel est le seul archétype dont la forme emploie elle-même le mot
       * « payload », pour les cartes qu'elle empile : le modèle a lu le
       * deuxième et aplati le premier.
       *
       * Les dix autres archétypes n'ont pas ce piège, et c'est pour ça que
       * personne ne l'a vu : l'enveloppe était décrite une fois, dans le
       * préfixe, et elle suffisait partout ailleurs.
       */
      /*
       * ⚠ UN VOLET SANS ÉNONCÉ AFFICHE LE TITRE DU CARROUSEL. Deux volets
       * pareils dans un même post, et la lectrice qui swipe revoit la même
       * carte : même phrase en tête, même dessin, même gabarit. Mesuré sur
       * dix essais gelés : dix carrousels sur dix en portaient au moins deux,
       * l'un en portait trois.
       */
      `⚠ AT MOST ONE card may be something other than "single_statement".`,
      `Every other archetype has no headline of its own, so it prints the`,
      `carousel's own line: two of them and the reader swipes past the same`,
      `card twice. Three to six cards, at most one diagram among them.`,
      ``,
      `⚠ "cards" GOES INSIDE "payload", NOT AT THE TOP LEVEL. The word`,
      `"payload" appears twice below and they are not the same one: the outer`,
      `envelope has one, and every card inside has its own. Your whole reply`,
      `is shaped like this, and anything else is thrown away:`,
      `{"payload": {"cards": [...]}, "card_line": "...", "caption": "...",`,
      ` "alt_text": "...", "rationale": "..."}`,
      ``,
      `A CONFORMING EXAMPLE of "payload" — count the words in it before you`,
      `write your own:`,
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
    `- "card_line" is the line printed across the top of the card: AT MOST ${CARD_LINE_MAX}`,
    `  CHARACTERS, including spaces. Count them.`,
    `- "caption" is what she posts: at most ${CAPTION_MAX} characters.`,
    `- "alt_text" describes the card for a screen reader: at most ${ALT_TEXT_MAX} characters.`,
    `- "rationale" is one sentence, at most ${RATIONALE_MAX_WORDS} words, completing "Why this one:".`,
    ``,
    /*
     * ⚠ CHAQUE CHIFFRE DE CE BLOC EST INTERPOLÉ, ET AUCUN N'EST ÉCRIT EN DUR.
     *
     * Il enseignait encore, trois corrections après le changement de règle,
     * qu'« un libellé ne dépasse jamais LE TIERS » et que la lisibilité se
     * mesure « dans une vignette de 350px » à « 11,7px ». Les deux étaient
     * faux : c'est la moitié, et 390px. Le modèle recevait donc une consigne
     * qui contredisait le moteur qui allait juger sa réponse.
     *
     * Une consigne périmée ne se contente pas d'être inutile — celle-ci
     * poussait à écrire des lignes plus courtes que nécessaire. Le texte vient
     * maintenant des constantes ; il ne peut plus diverger sans qu'un test le
     * voie (voir `prompt-constants.test.ts`).
     */
    `⚠ WHY "card_line" IS ${CARD_LINE_MAX} CHARACTERS AND NOT A TITLE. The card sets`,
    `that line as large as it fits, and every other size on the card is derived`,
    `from it — a label may never exceed 1/${TYPE.minTitleToLabelRatio} of it. At ${CARD_LINE_MAX} characters`,
    `the line sets at ${TYPE.display.max}px and a label may reach ${Math.floor(TYPE.display.max / TYPE.minTitleToLabelRatio)}px.`,
    `Legibility is measured at ${THUMB.width}px, a post at full phone width in a`,
    `feed, where nothing may fall under ${THUMB.minPx}px — which is why no label or`,
    `gloss is ever set under ${CONTENT_MIN_AT_CANVAS}px on the ${CANVAS.width}px canvas.`,
    ``,
    `⚠ "card_line" MUST BE A FINISHED PHRASE. Not a sentence cut short: "When`,
    `life interrupts" is fine, "When life interrupts, you get" is not, and`,
    `neither is anything ending on a function word such as: ${DANGLING_SAMPLE_WORDS.map((w) => `"${w}"`).join(", ")}.`,
    `If it does not fit in ${CARD_LINE_MAX} characters finished, write a shorter thought.`,
    ``,
    `⚠ "card_line" NEVER APPEARS INSIDE "payload". The card prints it once, at`,
    `the top, at the largest size on the card; repeating it as a label or as a`,
    `practitioner line prints the same words twice in two sizes and wastes the`,
    `field it sits in. Measured: all three practitioner cards of one month had`,
    `their first line identical to their card_line.`,
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

/**
 * L'effort de raisonnement des appels de rédaction.
 *
 * ── ⚠ SONNET PENSE PAR DÉFAUT, ET CE N'EST PAS CE QU'ON VEUT ICI ───────
 *
 * Sur Sonnet 5, omettre `thinking` lance le raisonnement adaptatif : le modèle
 * réfléchit avant d'écrire, et la sortie facturée gonfle. Pour trente payloads
 * de carte de moins de trente mots, ce raisonnement coûte plus que ce qu'il
 * écrit.
 *
 * `low` garde le raisonnement — le désactiver a ses propres défauts — et le
 * borne. La variable existe pour que la mesure puisse le faire varier sans
 * redéploiement, comme le modèle lui-même.
 *
 * ⚠ ET C'EST `output_config`, PAS UN CHAMP DE PREMIER NIVEAU. `budget_tokens`
 * est refusé par un 400 sur Sonnet 5 : la borne de raisonnement se règle par
 * l'effort et par rien d'autre.
 */
export type CopyEffort = "low" | "medium" | "high" | "xhigh" | "max";

export function copyEffort(): CopyEffort {
  const asked = process.env.CONTENT_COPY_EFFORT;
  const allowed: CopyEffort[] = ["low", "medium", "high", "xhigh", "max"];
  return allowed.includes(asked as CopyEffort) ? (asked as CopyEffort) : "low";
}

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
      output_config: { effort: copyEffort() },
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

  /*
   * ── ⚠ UN PAYLOAD APLATI EST RELEVÉ, PAS JETÉ ─────────────────────────
   *
   * Mesuré : zéro carrousel sur quatre-vingt-dix posts livrés, chacun tiré,
   * envoyé, PAYÉ, puis refusé sur `payload_shape`. Le modèle rendait ses
   * `cards` au premier niveau, à côté de `card_line` et `caption`, au lieu de
   * les poser sous `payload` — le carrousel est le seul archétype dont la
   * forme emploie elle-même le mot « payload », et il a lu le mauvais.
   *
   * La consigne est corrigée. Ce relevé reste, parce que le contenu était
   * JUSTE : seules les accolades étaient mal placées, et jeter un appel payé
   * pour un niveau d'imbrication est le défaut qu'on répare, pas celui qu'on
   * accepte. Il est étroit exprès — la forme doit parser telle quelle, sinon
   * le refus tient.
   */
  const flattened = entry.parse(o.payload) === null ? entry.parse(o) : null;
  const payload: unknown = flattened === null ? o.payload : o;
  if (entry.parse(payload) === null) return { ...base, reason: "payload_shape" };

  const budget = budgetErrors(archetypeKey, payload);
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
    return { ...base, reason: "over_budget", budget, payload: payload,
             caption: typeof o.caption === "string" ? o.caption : undefined,
             altText: typeof o.alt_text === "string" ? o.alt_text : undefined,
             rationale: typeof o.rationale === "string" ? o.rationale : undefined,
             cardLine: typeof o.card_line === "string" ? clampCardLine(o.card_line) : undefined };
  }

  return {
    topicId: "",
    ok: true,
    /*
     * ⚠ LA PONCTUATION EST NORMALISÉE ICI, UNE FOIS, POUR TOUT LE PAYLOAD.
     * Dix essais gelés sur dix ont été refusés sur des apostrophes droites :
     * le modèle écrit « isn't » parce que c'est l'anglais tel qu'on le tape.
     * Une substitution déterministe tient ce que la consigne ne tiendrait pas.
     */
    payload: deepTypographic(payload),
    /*
     * ⚠ TRONQUÉE, JAMAIS REFUSÉE, ET SUR UNE FRONTIÈRE DE MOT. Trente
     * caractères est une contrainte de rendu, pas une règle de fond : un
     * modèle qui en écrit trente-deux a répondu à la question. `clampTitle`
     * du mois faisait déjà ce geste plus bas dans la chaîne ; le faire ici
     * évite qu'il y ait deux endroits où la même borne se décide.
     */
    cardLine: typeof o.card_line === "string" ? typographicQuotes(clampCardLine(o.card_line)) : undefined,
    caption: typographicQuotes(String(o.caption)),
    altText: typographicQuotes(String(o.alt_text)),
    rationale: typeof o.rationale === "string" ? typographicQuotes(o.rationale) : "",
  };
}

/** `typographicQuotes` sur toute chaîne d'une structure, où qu'elle soit rangée. */
export function deepTypographic(value: unknown): unknown {
  if (typeof value === "string") return typographicQuotes(value);
  if (Array.isArray(value)) return value.map(deepTypographic);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepTypographic(v)])
    );
  }
  return value;
}

/** Quelques mots outils cités en exemple dans la consigne, pris de la liste. */
const DANGLING_SAMPLE_WORDS = ["what", "the", "your", "and", "doesn't"] as const;

/** Au plus `CARD_LINE_MAX` caractères. */
export const CARD_LINE_MAX = 30;

/** Les autres bornes que la consigne cite, nommées ici et nulle part ailleurs. */
export const CAPTION_MAX = 2200;
export const ALT_TEXT_MAX = 420;
export const RATIONALE_MAX_WORDS = 20;

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
export const DANGLING = new Set([
  "a", "an", "the", "and", "or", "but", "if", "when", "while", "that", "this",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as", "into",
  "is", "are", "was", "were", "be", "been", "am", "do", "does", "did",
  "have", "has", "had", "get", "gets", "got", "your", "you", "its", "it",
  /*
   * ⚠ « no » ET « yes » NE SONT PAS ICI. Ce sont des COMPLÉMENTS, pas des
   * mots en attente : « When the body says no » est un titre fini, et il a
   * été refusé à tort par cette liste. Quatrième faux positif de la même
   * famille — un mot outil dans un rôle plein.
   */
  "their", "they", "we", "our", "my", "his", "her", "not", "so", "than",
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  "what", "which", "who", "how", "why", "still", "even", "just", "about",
  /*
   * ⚠ LES CONTRACTIONS NÉGATIVES AUSSI. « Your nervous system doesn't » est
   * sorti tel quel sur une carte du mois de marlow.quint : la liste tenait
   * « does » et « not » séparément, et « doesn't » n'est ni l'un ni l'autre.
   * Une négation sans son verbe attend la suite exactement comme « you get ».
   */
  "doesn't", "don't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "won't", "can't", "couldn't", "wouldn't", "shouldn't", "hasn't", "haven't",
  "hadn't", "it's", "that's", "there's", "you're", "they're", "we're",
]);

/** Retire les mots outils traînants d'une ligne déjà coupée. */
function withoutDangling(text: string): string {
  let words = text.trim().split(/\s+/);
  // ⚠ ON NE DESCEND JAMAIS SOUS DEUX MOTS. Un titre d'un seul mot est un
  // sujet, pas un titre — mieux vaut alors la ligne telle quelle.
  while (words.length > 2 && DANGLING.has(words[words.length - 1].toLowerCase().replace(/[^a-z']/g, ""))) {
    words = words.slice(0, -1);
  }
  return words.join(" ").replace(/[,;:]$/, "");
}

/**
 * Les apostrophes et guillemets droits, remplacés par leurs formes
 * typographiques.
 *
 * ── ⚠ DÉTERMINISTE, PAS DEMANDÉ AU MODÈLE ──────────────────────────────
 *
 * Mesuré sur dix essais gelés : `text.straightQuote` a refusé LES DIX. Le
 * modèle écrit « isn't », « don't », « life's » — c'est l'anglais tel qu'on
 * le tape, et aucune consigne ne l'en empêchera de façon fiable.
 *
 * Or U+0027 dans un empattement de display à 90 px rend un trait vertical nu.
 * La notation indépendante l'a relevé sans hésiter : « dans un système de
 * cartes dont le seul vrai atout est le serif, ça se voit d'en face de la
 * pièce ».
 *
 * ⚠ CE N'EST PAS UN CONTOURNEMENT DU CONTRÔLE. Le contrôle existe pour
 * qu'une carte n'IMPRIME jamais un guillemet de machine à écrire ; le faire
 * tenir par une substitution déterministe est plus sûr que de le demander, et
 * le contrôle reste comme filet. Demander au modèle ce qu'une ligne de code
 * garantit est le mauvais partage du travail.
 *
 * L'apostrophe droite devient ’ partout — en anglais elle n'est jamais un
 * guillemet ouvrant. Les guillemets doubles deviennent une paire, ouvrant
 * puis fermant, en alternance.
 */
export function typographicQuotes(text: string): string {
  let open = true;
  return text
    .replace(/'/g, "\u2019")
    .replace(/"/g, () => {
      const mark = open ? "\u201C" : "\u201D";
      open = !open;
      return mark;
    });
}

export function clampCardLine(line: string): string {
  const trimmed = line.trim();
  /*
   * ⚠ LE ROGNAGE S'APPLIQUE AUSSI À CE QUI N'A PAS ÉTÉ COUPÉ. Il ne valait que
   * pour les lignes trop longues, sur l'idée qu'un mot outil traînant est un
   * artefact de la coupe. Il ne l'est pas toujours : « Efficiency can mask
   * what » fait vingt-cinq caractères, personne ne l'a coupée, et elle est
   * sortie telle quelle sur une carte du mois de marlow.quint. Le modèle avait
   * simplement écrit une phrase inachevée.
   */
  if (trimmed.length <= CARD_LINE_MAX) return withoutDangling(trimmed);

  const cut = trimmed.slice(0, CARD_LINE_MAX);

  // Une frontière de proposition : un endroit où la phrase s'arrêtait déjà.
  const clause = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(";"), cut.lastIndexOf(":"), cut.lastIndexOf(" — "));
  if (clause > 12) return cut.slice(0, clause).trimEnd();

  const boundary = cut.lastIndexOf(" ");
  return withoutDangling((boundary > 12 ? cut.slice(0, boundary) : cut).trimEnd());
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
  const rate = rateFor(massCopyModel());
  const m = RATE_SHAPE.batchMultiplier;
  let total = 0;
  for (const u of usages) {
    total += (u.input / 1e6) * rate.inputPerMTok * m;
    total += (u.output / 1e6) * rate.outputPerMTok * m;
    total += (u.cacheRead / 1e6) * rate.inputPerMTok * RATE_SHAPE.cacheReadMultiplier * m;
    total += (u.cacheWrite / 1e6) * rate.inputPerMTok * RATE_SHAPE.cacheWriteMultiplier * m;
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
  const rate = rateFor(massCopyModel());
  return (
    (usage.input / 1e6) * rate.inputPerMTok +
    (usage.output / 1e6) * rate.outputPerMTok +
    (usage.cacheRead / 1e6) * rate.inputPerMTok * RATE_SHAPE.cacheReadMultiplier +
    (usage.cacheWrite / 1e6) * rate.inputPerMTok * RATE_SHAPE.cacheWriteMultiplier
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
