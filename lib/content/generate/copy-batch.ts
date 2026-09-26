import CONFORMING_EXAMPLES from "./fixtures/conforming-examples.json";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicBody, type CopyCall } from "@/lib/content/generate/provider";
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
    /*
     * ── ⚠ LA RÈGLE DU CARROUSEL N'ÉTAIT NULLE PART ────────────────────────
     *
     * Elle n'était que SUGGÉRÉE par l'exemple, qui empile énoncé /
     * surface_and_beneath / énoncé — donc un seul volet héritant. Le modèle
     * lisait « any archetype except carousel » et en choisissait trois
     * différents. Neuf des quatorze constats `carousel.samePanel` disent
     * exactement cela : « 2 volets sans énoncé propre affichent tous le titre
     * du carrousel ».
     *
     * Un exemple n'est pas une règle : il montre un cas permis, il ne dit pas
     * ce qui est interdit.
     */
    shape:
      `{"cards": [3 to 6 x {"archetype_key": "any archetype except carousel", "payload": {that archetype's shape}}]}` +
      `\n⚠ AT MOST ONE panel may use an archetype other than "single_statement". ` +
      `"single_statement" is the only inner archetype that prints a headline of its own; ` +
      `every other one shows THE CAROUSEL'S OWN card_line at the top. Two of them and the ` +
      `reader swipes past what looks like the same card twice — same line, same drawing, ` +
      `same template — and the whole month is refused for it. ` +
      `Three to six panels, of which at least (n-1) are "single_statement", each with a ` +
      `DIFFERENT statement: a panel that repeats another panel's payload is refused too.`,
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
/*
 * ── ⚠ LE MODÈLE N'A JAMAIS VU UN BON POST ──────────────────────────────
 *
 * Tout ce qui précède est une RÈGLE, et une règle dit ce qu'il ne faut pas
 * faire. Trente caractères au plus. Pas de promesse de résultat. Quatre mots
 * par libellé. Pas d'apostrophe droite. Aucune ne montre ce qu'il FAUT faire.
 *
 * La notation indépendante met l'écriture à 1,6 sur 5, trois planches de
 * suite. Les sept contrôles de F26 n'ont pas déplacé ce chiffre : ils ont
 * supprimé les sept défauts qu'ils nomment, exactement, et rien d'autre. Un
 * contrôle refuse, il n'améliore pas — ce qu'on sait formuler, on l'attrape ;
 * le reste, non.
 *
 * ── CE QUE CES EXEMPLES SONT ───────────────────────────────────────────
 *
 * Des posts RÉELLEMENT PRODUITS, choisis parmi les 701 de la base par
 * `scripts/local-render/15-examples.ts` : ils passent les vingt-trois
 * contrôles entiers, le juge de complétude sur les lignes que le lexique ne
 * tranche pas, et aucun ne porte les formules que F29 a nommées. Aucun n'a été
 * écrit pour l'occasion, aucun n'a été retouché — seule la normalisation
 * typographique de la chaîne leur a été appliquée.
 *
 * ⚠ CE SONT DES FIXTURES, PAS DU CONTENU. Elles vivent dans `fixtures/`,
 * elles sont versionnées, et elles ne sont jamais livrées à personne. Le jour
 * où un mois meilleur sort, on rejoue le script et elles changent.
 */
/*
 * ── ⚠ MESURÉ, ET RETIRÉ : LES EXEMPLES N'ONT RIEN APPORTÉ ───────────────
 *
 * Deux mois, même code, même banque, même mois calendaire, un seul
 * commutateur de différence :
 *
 *   conformité au premier appel, sans exemples   35 / 72  = 48,6 %
 *   conformité au premier appel, avec            314 / 652 = 48,2 %
 *
 * Le second chiffre porte sur neuf mois et six cent cinquante-deux candidats :
 * il est bien échantillonné, et il ne bouge pas. ⚠ C'EST LA SEULE GRANDEUR
 * DURE DONT ON DISPOSE, et elle dit non.
 *
 * Les deux notations indépendantes donnent l'écriture à 2,3 sans exemples et
 * 2,2 avec — mais elles ne tranchent rien : sur des critères que ni les
 * exemples ni la révision ne peuvent toucher (typographie, lisibilité), les
 * deux notations s'écartent de 0,6. Le bruit du notateur dépasse l'effet
 * cherché.
 *
 * ⚠ LE MÉCANISME RESTE, ÉTEINT. `scripts/local-render/15-examples.ts`, les
 * fixtures et leurs tests sont intacts : `CONTENT_EXAMPLES=on` les rallume.
 * Ce qui a été mesuré est « aucun gain à ce protocole-là », pas « l'idée est
 * fausse » — et un protocole capable de trancher demanderait plusieurs mois
 * par bras et un même notateur sur les deux.
 */
export function examplesOn(): boolean {
  return process.env.CONTENT_EXAMPLES === "on";
}

function examplesFor(archetypeKey: string): string[] {
  /*
   * ⚠ `CONTENT_EXAMPLES=off` LES RETIRE, et c'est ce qui rend leur effet
   * mesurable. Trois changements dans la même session — le modèle, les
   * exemples, la passe de révision — et une note qui monte ne dit pas lequel a
   * payé. Un commutateur par changement, ou la mesure ne mesure rien.
   */
  if (!examplesOn()) return [];
  const examples = (CONFORMING_EXAMPLES as Record<string, Example[]>)[archetypeKey];
  if (!examples?.length) return [];
  return [
    ``,
    `EXAMPLES — ${examples.length} posts of this shape that were accepted. The topic`,
    `each one was written from is above its answer. Read what makes them work:`,
    `the line uses the width it has, the labels do not repeat each other, and`,
    `nothing is explained twice in two sizes.`,
    ...examples.flatMap((e) => [
      ``,
      `TOPIC: ${e.topic}`,
      JSON.stringify({ card_line: e.cardLine, payload: e.payload }),
    ]),
    ``,
    `⚠ DO NOT REUSE THEIR WORDS. They are here for their shape and their`,
    `restraint, not their content — a month that repeats them is a month of`,
    `duplicates, and duplicates are refused.`,
  ];
}

export function cachedPrefix(brand: BrandContext, archetypeKey: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: cachedPrefixText(brand, archetypeKey), cache_control: { type: "ephemeral" } }];
}

/**
 * Le préfixe, en texte nu.
 *
 * ⚠ C'EST LA FORME NEUTRE, ET ELLE EXISTE PARCE QU'IL Y A DEUX FOURNISSEURS.
 * Anthropic veut un bloc marqué `cache_control` ; OpenAI veut une chaîne dans
 * `instructions` et cache le préfixe commun tout seul. Le préfixe lui-même est
 * le même texte, et il ne doit être écrit qu'une fois.
 */
export function cachedPrefixText(brand: BrandContext, archetypeKey: string): string {
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
     * ── ⚠ TOUT CE QUI PRÉCÈDE SE LISAIT COMME PORTANT SUR LA CARTE ────────
     *
     * Mesuré le 2026-09-24, et c'est le plus gros défaut de consigne trouvé
     * dans ce préfixe. La seule chose qui était dite de la légende était sa
     * LONGUEUR ; les règles de déontologie, la liste des « NEVER » et tout le
     * reste se lisaient comme des règles de carte.
     *
     * Le modèle a fait ce qu'on lui demandait : il a écrit des cartes propres
     * et des légendes qui promettent. Une fois la légende contrôlée, CINQ mois
     * sur cinq ont été refusés — trois sur une promesse d'efficacité dans la
     * légende, deux sur une phrase empruntée.
     *
     * ⚠ ET CE N'ÉTAIT PAS UN DÉFAUT DE MODÈLE. La consigne ne le disait pas.
     */
    `⚠ "caption" AND "alt_text" ARE PUBLISHED TEXT UNDER HER LICENCE, and every`,
    `rule above applies to them exactly as it applies to the card. The caption`,
    `is the LONGEST thing a reader sees. It is not a place where the rules relax;`,
    `it is where a board would look first. Five specific ways a caption fails:`,
    ``,
    `1. IT PROMISES A RESULT. "EMDR helps you integrate what happened" is an`,
    `   efficacy claim stated as fact. Write "EMDR can help…", "some people`,
    `   find…", "the work is designed to…" — the hedge is not softness, it is`,
    `   the difference between a sentence she may publish and one she may not.`,
    `2. IT TALKS ABOUT HER CLIENTS. "Almost everyone who came in this month had`,
    `   just gone back to work" describes a real, small caseload in a named city:`,
    `   a client recognises herself. Write about people in general, never about`,
    `   who came in.`,
    `3. IT COMPARES. "The processing happens faster than talk alone" is a`,
    `   measurable claim with no measurement, and it disparages a colleague's`,
    `   modality. Describe what the work does, never what it beats.`,
    `4. IT BORROWS. "the body keeps the score" is the title of someone else's`,
    `   book. Say it in her own words.`,
    `5. IT SELLS A SLOT. "Two evening slots opening in October. They fill fast."`,
    `   Availability lives in her brief, not in your sentence, and urgency aimed`,
    `   at a distressed reader is the one kind of pressure this practice refuses.`,
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
    /*
     * ── ⚠ TROIS CLASSES FAISAIENT LE GROS DES REFUS, ET LES CONSIGNES
     *      EXISTAIENT — MAL PORTÉES ───────────────────────────────────────
     *
     * Mesuré sur seize essais (2026-09-24/25), conformité au premier appel
     * 46/102. Les constats résiduels ne sont pas dispersés :
     *
     *   text.unfinished     62 constats · ligne de carte et libellés de payload
     *   carousel.samePanel  14 constats · dont 9 « 2 volets sans énoncé propre »
     *   text.clinicalClaim  10 constats · alternatif, ligne de carte, énoncés
     *
     * ⚠ AUCUNE DES TROIS N'ÉTAIT UNE RÈGLE MANQUANTE. Chacune était écrite
     * quelque part et portait sur la mauvaise surface :
     *
     *   * la complétude n'était exigée que de `card_line`, alors que le
     *     contrôle lit CHAQUE ligne écrite du payload ;
     *   * la règle du carrousel — un seul volet peut hériter du titre —
     *     n'était nulle part, seulement suggérée par l'exemple ;
     *   * la nuance clinique était dans le bloc LÉGENDE, donc lue comme une
     *     règle de légende, alors que le contrôle lit toutes les surfaces.
     *
     * Ce bloc les sort de leur surface d'origine et les dit pour toutes.
     */
    `⚠ EVERY WRITTEN LINE MUST BE FINISHED — not just "card_line". The check`,
    `reads each line you write: "card_line", every label, statement, gloss and`,
    `panel line inside "payload". A line is unfinished when its last word DEMANDS`,
    `A COMPLEMENT that never comes. This is not about function words; these are`,
    `real refusals, and every one of them ends on a content word:`,
    ``,
    `   refused                        why                    write instead`,
    `   "The cost of unshakeable"      unshakeable WHAT       "The cost of never wavering"`,
    `   "Function isn't the same"      the same AS WHAT       "Function is not recovery"`,
    `   "Stuck between one chapter"    between one AND WHAT   "Stuck between two chapters"`,
    `   "When your life script"        script DOES WHAT       "When the old script runs"`,
    ``,
    `Comparatives and relational words are the trap: "the same", "more than",`,
    `"as … as", "between", "the cost of", "instead of", "closer to". Each one`,
    `opens a slot. Fill it, or choose a phrase that opens none.`,
    ``,
    `⚠ THE CLINICAL NUANCE APPLIES TO EVERY SURFACE, not only the caption. A`,
    `card line of four words is read under her licence exactly as a caption of`,
    `three hundred is. Two forms, side by side:`,
    ``,
    `   may not publish              may publish`,
    `   "EMDR helps"                 "EMDR can help"`,
    `   "Bilateral stimulation       "Bilateral stimulation is designed to give`,
    `    gives a nervous system       an overworked nervous system a way to`,
    `    a way to power down"         settle"`,
    `   "Reprocessing lets a         "Reprocessing may let a memory settle"`,
    `    memory settle"`,
    ``,
    `The hedge — can, may, often, sometimes, for some, is designed to, aims to —`,
    `is the whole difference. A named technique as the SUBJECT of a result verb,`,
    `with no hedge, is the single most common way this copy fails.`,
    ``,
    /*
     * ⚠ CETTE DERNIÈRE CONSIGNE CONTOURNE UN FAUX POSITIF, ET CE N'EST PAS LÀ
     * QUE LA CORRECTION DEVRAIT ÊTRE.
     *
     * `checkClinicalClaim` refuse « Not all change is trauma » — une phrase
     * DÉ-pathologisante, exactement ce que le contrôle prétend protéger — et
     * accepte « Change is not always trauma », qui dit la même chose. Mesuré :
     * 2 des 10 constats de cette classe sont de cette forme. C'est la même
     * classe que F38, dans un autre contrôle, et la corriger est une décision
     * de contrôle déontologique que cette session n'a pas le droit de prendre
     * seule (voir F39). En attendant, le modèle est prévenu.
     */
    `⚠ WHEN YOU SAY SOMETHING IS *NOT* A DIAGNOSIS, put the negation inside the`,
    `verb phrase, never in front of the sentence. "Not all change is trauma" and`,
    `"Change is not always trauma" mean the same thing; the first is refused and`,
    `the second is not. Write "X is not trauma", "Grief is not a disorder",`,
    `"Overwork is not burnout" — never "Not every X is Y".`,
    ``,
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
    ...examplesFor(archetypeKey),
  ].join("\n");

  return text;
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
type Example = { topic: string; intent: string; cardLine: string; payload: unknown };

export type CopyEffort = "low" | "medium" | "high" | "xhigh" | "max";

export function copyEffort(): CopyEffort {
  const asked = process.env.CONTENT_COPY_EFFORT;
  const allowed: CopyEffort[] = ["low", "medium", "high", "xhigh", "max"];
  return allowed.includes(asked as CopyEffort) ? (asked as CopyEffort) : "low";
}

/**
 * Le plafond de sortie d'un appel de rédaction.
 *
 * ⚠ IL ÉTAIT ÉCRIT DEUX FOIS, en littéral, ici et dans `write-one.ts` — les
 * deux à 2000, et rien n'aurait dit lequel avait bougé.
 */
export const COPY_MAX_TOKENS = 2000;

/**
 * L'appel de rédaction, dit sans vocabulaire de fournisseur.
 *
 * ⚠ LE SEUL ENDROIT QUI ASSEMBLE UN APPEL. Le mois (par lot) et « Write it »
 * (synchrone) construisaient les mêmes paramètres à deux endroits, chacun avec
 * son littéral de plafond et sa propre lecture du préfixe. Les deux passent
 * maintenant par ici, puis par la traduction du fournisseur retenu.
 */
export function copyCallFor(brand: BrandContext, topic: TopicRequest): CopyCall {
  return {
    model: massCopyModel(),
    prefix: cachedPrefixText(brand, topic.archetypeKey),
    variable: variablePart(topic),
    maxTokens: COPY_MAX_TOKENS,
    effort: copyEffort(),
    archetypeKey: topic.archetypeKey,
  };
}

export function buildBatchRequests(
  brand: BrandContext,
  topics: TopicRequest[]
): Anthropic.Messages.Batches.BatchCreateParams["requests"] {
  return topics.map((topic) => ({
    custom_id: topic.topicId,
    params: anthropicBody(copyCallFor(brand, topic)),
  }));
}

/*
 * ── ⚠ UNE PANNE DE FACTURATION S'EST LUE 216 FOIS COMME « schema » ──────
 *
 * Le 2026-09-24, le solde du compte fournisseur s'est épuisé pendant une
 * mesure. Trois lots de 72 candidats sont revenus `{"succeeded":0,
 * "errored":72}`, et le rapport a dit « schema » — « le modèle a rendu une
 * forme invalide » — deux cent seize fois. Il n'avait rien rendu du tout.
 *
 * ⚠ ET LE MOIS A ÉTÉ REFUSÉ SUR `month.short`, c'est-à-dire « un mois court,
 * donc un défaut de génération », alors qu'il n'y avait pas eu de génération.
 * C'est ce verdict-là qu'on lit en premier, et il envoie chercher le défaut
 * dans la consigne, le payload et la validation — trois endroits où il n'y
 * avait rien.
 *
 * Trois familles, distinguées À LA SOURCE, parce qu'elles appellent trois
 * gestes différents :
 *
 *   `unavailable`  le fournisseur n'a pas répondu — solde, quota d'API,
 *                  surcharge, lot expiré. ⚠ RIEN N'A ÉTÉ TENTÉ. Ce n'est ni
 *                  un essai refusé ni une ligne à relire : c'est un geste
 *                  d'exploitation, et aucun chiffre de qualité n'en sort.
 *   `technical`    une réponse est arrivée et on n'a pas su la lire — JSON
 *                  illisible, sujet inconnu. Le défaut est de notre côté.
 *   `refused`      le modèle a écrit, et ce qu'il a écrit ne passe pas —
 *                  budget de mots, forme de payload, légende trop longue.
 *                  C'est le seul cas qui mesure quelque chose sur l'écriture.
 */
export type FailureFamily = "unavailable" | "technical" | "refused";

/** Ce que le fournisseur rend pour une entrée de lot qui n'a pas abouti. */
const UNAVAILABLE = new Set(["errored", "expired", "canceled", "overloaded", "rate_limited", "no_credit"]);
const TECHNICAL = new Set(["not_json", "unknown_topic", "unknown_archetype", "no_message"]);

/**
 * À quelle famille appartient un motif d'échec.
 *
 * ⚠ LE DÉFAUT EST `refused`, ET C'EST VOULU DANS CE SENS-LÀ. Un motif inconnu
 * décrit une réponse qu'on a reçue et jugée ; le ranger en `unavailable`
 * effacerait un essai réel de la mesure, ce qui est le pire des deux.
 */
export function failureFamily(reason: string | undefined): FailureFamily {
  if (!reason) return "refused";
  if (UNAVAILABLE.has(reason)) return "unavailable";
  if (TECHNICAL.has(reason)) return "technical";
  return "refused";
}

export type CopyResult = {
  topicId: string;
  ok: boolean;
  /**
   * ⚠ POSÉE À LA SOURCE, JAMAIS DEVINÉE PLUS LOIN. Un appelant qui
   * reclasserait un motif par sa forme referait l'erreur de septembre : le
   * seul endroit qui SAIT si le modèle a répondu est celui qui lit la
   * réponse.
   */
  family?: FailureFamily;
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
/**
 * Valide une réponse du modèle, et range son échec dans sa famille.
 *
 * ⚠ LA FAMILLE EST POSÉE ICI, PAS PAR L'APPELANT. `validateCopy` ne voit que
 * des réponses REÇUES : tout ce qu'elle refuse est du texte que le modèle a
 * écrit, donc `refused` ou `technical`, jamais `unavailable`. Laisser
 * l'appelant deviner est exactement ce qui a rangé deux cent seize pannes de
 * facturation sous « schema ».
 */
export function validateCopy(archetypeKey: string, raw: string): CopyResult {
  const verdict = validateCopyResponse(archetypeKey, raw);
  if (verdict.ok || verdict.family) return verdict;
  return { ...verdict, family: failureFamily(verdict.reason) };
}

function validateCopyResponse(archetypeKey: string, raw: string): CopyResult {
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
    /*
     * ⚠ ET IL NORMALISE, COMME LE CHEMIN QUI RÉUSSIT. Mesuré le 2026-09-24 :
     * dix-huit champs publiés portaient encore une apostrophe droite dans les
     * neuf mois livrés de F34, tous sur des posts RÉPARÉS. Le retour de
     * succès, vingt lignes plus bas, appelait `typographicQuotes` ; celui-ci
     * rendait le texte brut, et la réparation le reprenait tel quel.
     *
     * ⚠ C'EST LA CLASSE DE F27, dans la fonction qui la nomme : deux sorties
     * de la même fonction, une seule normalisée, et le défaut ne se voit que
     * sur les posts passés par l'autre.
     */
    return { ...base, reason: "over_budget", budget, payload: deepTypographic(payload),
             caption: typeof o.caption === "string" ? typographicQuotes(o.caption) : undefined,
             altText: typeof o.alt_text === "string" ? typographicQuotes(o.alt_text) : undefined,
             rationale: typeof o.rationale === "string" ? typographicQuotes(o.rationale) : undefined,
             cardLine: typeof o.card_line === "string" ? typographicQuotes(clampCardLine(o.card_line)) : undefined };
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
      /*
       * ⚠ `type` EST LE MOT DU FOURNISSEUR — `errored`, `expired`,
       * `canceled` — et il dit que rien n'a été écrit. Une entrée qui a
       * abouti mais dont le message manque est un défaut de notre lecture,
       * pas du fournisseur : les deux ne se confondent pas.
       */
      const reason = entry.result.type === "succeeded" ? "no_message" : entry.result.type;
      return { topicId: entry.custom_id, ok: false, reason, family: failureFamily(reason) };
    }

    const message = entry.result.message;
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const archetypeKey = archetypeByTopic.get(entry.custom_id);
    if (!archetypeKey) {
      return { topicId: entry.custom_id, ok: false, reason: "unknown_topic", family: "technical" };
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
