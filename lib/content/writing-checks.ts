import type { Finding } from "@/lib/content/month-checks";

/*
 * ── LES SEPT CONTRÔLES D'ÉCRITURE ───────────────────────────────────────
 *
 * ⚠ UN MOIS AU VERT SUR QUINZE BARRIÈRES A NOTÉ 1,4 SUR 5 EN ÉCRITURE.
 *
 * Le 2026-09-23, le mois d'`odile.marchetti` passait `checkMonth` en entier.
 * Une notation indépendante y a trouvé sept défauts, tous vérifiés ensuite en
 * base, aucun vu par une suite :
 *
 *   1. quatre titres qui s'arrêtent avant leur sens ;
 *   2. deux volets qui se répètent DANS un carrousel ;
 *   3. un titre d'ouvrage repris sans source ;
 *   4. une affirmation clinique fausse, sur un champ que rien ne lisait ;
 *   5. deux volets de clôture qui vendent des créneaux ;
 *   6. treize champs à apostrophe droite ;
 *   7. trois sigles fabriqués depuis des initiales, dont un à une lettre de
 *      la modalité de la praticienne.
 *
 * Chacun est écrit ici contre les données réelles de ce mois-là. Un contrôle
 * écrit après coup sur un exemple commode prouve qu'il marche sur l'exemple.
 */

/* ── 1. La phrase qui s'arrête avant son sens ────────────────────────── */

/**
 * ⚠ LE PROBLÈME N'EST PAS LA LONGUEUR, C'EST LA COMPLÉTUDE.
 *
 * Les quatre titres fautifs du mois livré font 25, 26, 27 et 27 caractères,
 * tous SOUS la limite de trente : `clampCardLine` n'y a pas touché. Le modèle
 * les a écrits ainsi, et `checkDangling` les a laissés passer parce qu'il ne
 * regarde qu'un DERNIER MOT contre une liste.
 *
 *   « When life changes without »    → dernier mot : une préposition
 *   « Success masks an overdriven »  → dernier mot : un adjectif
 *   « The thing that works costs »   → dernier mot : un verbe transitif
 *   « High performance masks held »  → dernier mot : un participe
 *
 * Une liste de mots ne peut trancher que le premier. Les trois autres
 * demandent de savoir ce qui MANQUE après, ce qu'aucun lexique ne dit.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE PENCHE VERS LE PERMISSIF ────────────────
 *
 * Trois tours de faux positifs ont établi que l'anglais STRANDE ses
 * prépositions : « information to work with », « where it comes from », « what
 * she's good at » sont finis. Le lexique ne tranche donc QUE les cas où il n'y
 * a pas de doute, et rend `undecided` partout ailleurs. C'est au juge — un
 * appel court — de décider du reste, et à personne de deviner.
 */
export type Completeness = "finished" | "unfinished" | "undecided";

/**
 * Les prépositions qui ne strandent pas.
 *
 * ⚠ CETTE LISTE EST COURTE EXPRÈS. `with`, `for`, `about`, `at`, `from`, `on`,
 * `in` strandent tous en anglais courant et ont tous produit un faux refus
 * dans une version antérieure. Celles qui restent n'ont aucun emploi en fin de
 * proposition : on ne dit pas « the thing I went without » sans relatif, et
 * quand il y en a un la règle ci-dessous le voit.
 */
const NEVER_STRANDS = new Set([
  "without", "during", "toward", "towards", "between", "among", "amongst",
  "despite", "unlike", "versus", "via", "amid", "besides", "throughout",
  "upon", "of", "than",
]);

/**
 * Ce qui autorise une préposition à rester seule en fin de proposition.
 *
 * ⚠ `when`, `why`, `how` N'Y SONT PAS, ET C'EST LA DIFFÉRENCE QUI COMPTE.
 * Une préposition ne stranded que si son OBJET a été déplacé devant :
 * « where it comes from », « what she is good at » — l'objet est le mot en
 * tête. « When », « why », « how » mettent en tête un COMPLÉMENT DE PHRASE,
 * pas un objet : « When life changes without » ne laisse rien en fin de
 * ligne qui puisse y avoir été pris.
 *
 * Mesuré : avec `when` dans la liste, le seul des quatre titres fautifs que
 * le lexique pouvait trancher passait quand même.
 */
const LICENSES_STRANDING = /\b(that|which|who|whom|what|where)\b|\bto\s+\w+/i;

/**
 * Mots outils qui ne finissent jamais rien, relatif ou pas.
 *
 * ⚠ CETTE LISTE A ÉTÉ TAILLÉE DEUX FOIS, ET CHAQUE COUPE EST MESURÉE.
 *
 * `no` en est sorti : « When the body says no » et « nervous system says no »
 * sont finis, et ce sont de vraies lignes du mois. `this`, `these`, `those`
 * aussi — « one of those » finit. `while` aussi — « for a while » finit.
 * `every`, `each`, `another`, `some`, `any` : tous pronominaux en anglais.
 *
 * Ne restent que les déterminants qui n'ont AUCUN emploi pronominal, les
 * coordonnants et les relatifs.
 */
const NEVER_ENDS = new Set([
  // déterminants sans emploi pronominal
  "a", "an", "the", "my", "your", "our", "their", "its",
  // coordonnants
  "and", "or", "but", "nor",
  // subordonnants
  "because", "although", "though", "unless", "until", "whereas",
  // relatifs
  "which", "who", "whom", "whose",
]);

const words = (text: string) =>
  text.trim().replace(/[.!?…]+$/, "").split(/\s+/).filter(Boolean);

const bare = (w: string) => w.toLowerCase().replace(/[^a-z'’]/g, "");

/**
 * Ce que le lexique seul peut dire d'une ligne.
 *
 * ⚠ IL NE REND `unfinished` QUE QUAND IL EN EST SÛR. Tout le reste est
 * `undecided` : c'est le signal qu'il faut un juge, pas un laissez-passer.
 */
export function completenessOf(text: string): Completeness {
  const w = words(text);
  // Un mot seul est une étiquette, pas une phrase suspendue.
  if (w.length < 2) return "finished";

  const last = bare(w[w.length - 1]);

  if (NEVER_ENDS.has(last)) return "unfinished";
  if (NEVER_STRANDS.has(last) && !LICENSES_STRANDING.test(text)) return "unfinished";

  /*
   * ── ⚠ ET C'EST TOUT CE QUE LE LEXIQUE PEUT DIRE ───────────────────────
   *
   * Une règle « déterminant + un seul mot = inachevé » a été écrite puis
   * retirée le jour même : elle attrapait « an overdriven », et avec lui
   * « Rest is not a reward », « The choice », « the memo », « back at the
   * desk » — six lignes finies du même mois. La différence entre « an
   * overdriven » et « a reward » est que l'un est un adjectif et l'autre un
   * nom, et AUCUNE LISTE DE MOTS NE LE SAIT.
   *
   * C'est exactement là que le lexique s'arrête et que le juge commence.
   */
  return "undecided";
}

/**
 * Les lignes que le lexique n'a pas su trancher, dédoublonnées.
 *
 * ⚠ C'EST CE QU'ON ENVOIE AU JUGE, ET RIEN D'AUTRE. Les certitudes lexicales
 * ne coûtent pas un appel, et les lignes répétées n'en coûtent qu'un seul.
 */
export function undecidedIn(lines: Array<{ where: string; text: string }>): string[] {
  return [...new Set(lines.filter((l) => completenessOf(l.text) === "undecided").map((l) => l.text))];
}

/** Ce que le juge rend : par ligne, finie ou non. */
export type CompletenessVerdicts = Record<string, boolean>;

/**
 * ⚠ SANS VERDICTS, LE CONTRÔLE NE RAPPORTE QUE LES CERTITUDES LEXICALES.
 *
 * C'est voulu, et c'est ce qui le rend testable : une suite tourne hors ligne,
 * et un contrôle qui exigerait un appel pour s'exécuter ne serait jamais
 * lancé. Les verdicts viennent d'un appel court en génération, et d'un
 * ENREGISTREMENT en rejeu — les mêmes données, le même verdict, pas d'appel.
 *
 * ⚠ ET UNE LIGNE QUE LE JUGE N'A PAS NOMMÉE PASSE. L'absence de verdict n'est
 * pas un verdict : un juge muet, en panne ou hors budget ne doit pas refuser
 * un mois entier. L'erreur penche vers le permissif, comme partout ici.
 */
export function checkUnfinished(
  lines: Array<{ where: string; text: string }>,
  verdicts: CompletenessVerdicts = {}
): Finding[] {
  const out: Finding[] = [];
  for (const { where, text } of lines) {
    const verdict = completenessOf(text);
    const unfinished = verdict === "unfinished" || (verdict === "undecided" && verdicts[text] === false);
    if (unfinished) {
      out.push({ check: "text.unfinished", detail: `${where} s'arrête avant son sens : « ${text} »` });
    }
  }
  return out;
}

/* ── 2. Deux volets qui se répètent dans un carrousel ────────────────── */

/**
 * ⚠ LE SEUL ARCHÉTYPE INTERNE QUI PORTE SON PROPRE TITRE EST LA PHRASE.
 *
 * Un volet dont la carte interne n'a pas d'énoncé affiche le titre DU
 * CARROUSEL. Deux volets pareils dans un même post, et la lectrice qui swipe
 * revoit la même carte : même phrase en tête, même dessin — celui de
 * l'archétype — et même gabarit.
 *
 * Mesuré sur le mois livré : « Rest does not look productive » empile deux
 * `surface_and_beneath`, « Your body knows what you deny » un
 * `surface_and_beneath` et un `cycle`. Quatre volets sur quarante-huit.
 *
 * `checkIdenticalPayloads` ne pouvait pas le voir : il compare les payloads de
 * POSTS, et un carrousel n'en a qu'un — la répétition est à l'intérieur.
 */
const CARRIES_ITS_OWN_HEADLINE = "single_statement";

export function checkCarouselPanels(posts: Array<{ cardLine: string; archetype: string; payload: unknown }>): Finding[] {
  const out: Finding[] = [];
  for (const post of posts) {
    if (post.archetype !== "carousel") continue;
    const cards = (post.payload as { cards?: Array<{ archetype_key?: string; payload?: unknown }> })?.cards;
    if (!Array.isArray(cards)) continue;

    const inherits = cards.filter((c) => c?.archetype_key !== CARRIES_ITS_OWN_HEADLINE);
    if (inherits.length > 1) {
      out.push({
        check: "carousel.samePanel",
        detail:
          `« ${post.cardLine} » — ${inherits.length} volets sans énoncé propre affichent tous le titre du ` +
          `carrousel : ${inherits.map((c) => c?.archetype_key ?? "?").join(", ")}`,
      });
    }

    const seen = new Map<string, number>();
    for (const card of cards) {
      const key = JSON.stringify(card?.payload ?? null);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, n] of seen) {
      if (n > 1 && key !== "null" && key !== "{}") {
        out.push({
          check: "carousel.samePanel",
          detail: `« ${post.cardLine} » — ${n} volets au payload identique`,
        });
      }
    }
  }
  return out;
}

/* ── 3. Un titre d'ouvrage repris sans source ────────────────────────── */

/**
 * ⚠ « Your body keeps score of what rest meant » — van der Kolk, dans la voix
 * de la praticienne, sans une ligne de source.
 *
 * Une carte n'a AUCUN champ de source : toute reprise y est donc
 * nécessairement non attribuée, et la règle est simple à énoncer — on ne
 * reprend pas le titre d'un ouvrage du domaine.
 *
 * La liste ne porte que des titres, jamais des termes techniques :
 * « fenêtre de tolérance » ou « polyvagal » sont du vocabulaire, pas des
 * citations, et les refuser interdirait de parler du métier.
 */
const BORROWED_TITLES: Array<[RegExp, string]> = [
  [/\bbody keeps (?:the )?score\b/i, "The Body Keeps the Score — Bessel van der Kolk"],
  [/\bwaking the tiger\b/i, "Waking the Tiger — Peter Levine"],
  [/\bthe myth of normal\b/i, "The Myth of Normal — Gabor Maté"],
  [/\bin the realm of hungry ghosts\b/i, "In the Realm of Hungry Ghosts — Gabor Maté"],
  /*
   * ⚠ « What Happened to You? » N'EST PAS DANS CETTE LISTE, et ne peut pas y
   * être : la phrase est de l'anglais ordinaire — « it changes how your
   * nervous system holds what happened to you » — et la refuser interdirait
   * de dire la chose la plus banale du métier. Un titre ne compte ici que
   * s'il est RECONNAISSABLE hors de son livre.
   */
  [/\bthe drama of the gifted child\b/i, "The Drama of the Gifted Child — Alice Miller"],
  [/\bfrom surviving to thriving\b/i, "Complex PTSD: From Surviving to Thriving — Pete Walker"],
  [/\bno bad parts\b/i, "No Bad Parts — Richard Schwartz"],
];

export function checkBorrowed(lines: Array<{ where: string; text: string }>): Finding[] {
  const out: Finding[] = [];
  for (const { where, text } of lines) {
    for (const [pattern, source] of BORROWED_TITLES) {
      if (pattern.test(text)) {
        out.push({
          check: "text.borrowed",
          detail: `${where} reprend un titre sans le dire — ${source} : « ${text} »`,
        });
      }
    }
  }
  return out;
}

/* ── 4. Une affirmation clinique que rien ne lisait ──────────────────── */

/**
 * ⚠ « Efficiency can become trauma. », sous `BEHIND THE PRACTICE`, signée par
 * une clinicienne EMDR.
 *
 * `checkEthics` existait, il était juste, et il ne lisait PAS ce champ : il
 * recevait `caption + altText + payload`, et cette phrase était le TITRE. Ses
 * violations n'allaient d'ailleurs que dans une liste de rapport, jamais dans
 * les constats bloquants du mois. Deux fois le même défaut de branchement.
 *
 * Ce contrôle-ci ajoute ce qu'aucune règle déontologique ne disait : on ne
 * rend pas un mot de diagnostic prédicat d'un comportement ordinaire.
 * « L'efficacité peut devenir un traumatisme » banalise ce qu'elle soigne.
 */
const DIAGNOSES =
  "trauma|ptsd|depression|anxiety|burnout|dissociation|addiction|psychosis|a disorder";

const CLINICAL_CLAIM: Array<[RegExp, string]> = [
  [
    new RegExp(`\\b(?:is|are|becomes?|can become|turns into|means)\\s+(?:a\\s+|an\\s+)?(?:${DIAGNOSES})\\b`, "i"),
    "rend un mot de diagnostic prédicat d'autre chose",
  ],
  [
    new RegExp(`\\b(?:cures?|heals?|fixes|erases?|removes?|eliminates?)\\s+(?:your\\s+|the\\s+)?(?:${DIAGNOSES})\\b`, "i"),
    "promet de guérir",
  ],
  [
    /\b(?:you|your (?:body|nervous system|brain))\s+(?:will|must|needs? to)\s+(?:break down|collapse|fall apart)\b/i,
    "annonce un effondrement nécessaire",
  ],
];

export function checkClinicalClaim(lines: Array<{ where: string; text: string }>): Finding[] {
  const out: Finding[] = [];
  for (const { where, text } of lines) {
    for (const [pattern, why] of CLINICAL_CLAIM) {
      if (pattern.test(text)) {
        out.push({ check: "text.clinicalClaim", detail: `${where} ${why} : « ${text} »` });
      }
    }
  }
  return out;
}

/* ── 5. Un volet qui vend un créneau ─────────────────────────────────── */

/**
 * ⚠ « October evening slots now open for those learning to unfreeze. » et
 * « Evening slots opening in October. » ferment deux carrousels différents.
 *
 * Vendre un rendez-vous dans la langue d'un symptôme est le genre de ligne
 * qu'une clinicienne ne signe pas. Et ce n'est pas au modèle d'écrire la
 * disponibilité : elle vit dans le brief, et `practitioner_card` la porte
 * depuis F16 — c'est pourquoi cet archétype est exclu ici.
 */
/*
 * ⚠ `places?` ET `spots?` SONT SORTIS DE LA LISTE NUE, MESURÉ SUR QUATRE MOIS.
 *
 * Quatre faux refus d'un coup, tous sur le mot ordinaire : « holds tension in
 * place », « everything in place », « Therapy is the place to stop
 * performing », « work and rest trade places ». « blind spots » aurait suivi.
 *
 * Ils ne comptent donc que COLLÉS à un mot de disponibilité. `slots`,
 * `openings` et `waitlist` n'ont pas cet emploi courant et restent nus.
 */
const SELLS = new RegExp(
  [
    String.raw`\b(?:slots?|openings?|waitlist)\b`,
    String.raw`\b(?:spots?|places?)\b\s+(?:open|available|free|left|remaining)\b`,
    String.raw`\b(?:a few|two|three|limited)\s+(?:spots?|places?)\b`,
    String.raw`\b(?:book|booking|dm me|message me)\s+(?:a|your|an|now)\b`,
    String.raw`\bnow (?:taking|accepting|booking)\b`,
  ].join("|"),
  "i"
);

export function checkSellsSlots(
  lines: Array<{ where: string; text: string; archetype: string }>
): Finding[] {
  const out: Finding[] = [];
  for (const { where, text, archetype } of lines) {
    // La carte praticienne tire ses lignes du brief : elle a le droit de dire
    // qu'elle prend de nouvelles clientes, parce que la praticienne l'a écrit.
    if (archetype === "practitioner_card") continue;
    if (SELLS.test(text)) {
      out.push({ check: "text.sellsSlots", detail: `${where} vend un créneau : « ${text} »` });
    }
  }
  return out;
}

/* ── 6. L'apostrophe droite ──────────────────────────────────────────── */

/**
 * ⚠ TREIZE CHAMPS DU MOIS LIVRÉ, DANS UN EMPATTEMENT DE DISPLAY À 90 PX.
 *
 * U+0027 dans « doesn't » rend un trait vertical nu au milieu d'un serif à
 * fort contraste. La notation indépendante l'a relevé sans hésiter : « dans un
 * système de cartes dont le seul vrai atout est le serif, ça se voit d'en face
 * de la pièce ».
 *
 * Le guillemet droit U+0022 est refusé pour la même raison.
 */
export function checkStraightQuotes(lines: Array<{ where: string; text: string }>): Finding[] {
  const out: Finding[] = [];
  for (const { where, text } of lines) {
    if (/['"]/.test(text)) {
      out.push({
        check: "text.straightQuote",
        detail: `${where} porte une apostrophe ou un guillemet droit : « ${text} »`,
      });
    }
  }
  return out;
}

/* ── 7. Le sigle fabriqué ────────────────────────────────────────────── */

/**
 * ⚠ « EMP », « EMD », « FTG » — trois sigles pour trois cartes, tous
 * fabriqués depuis les initiales des tuiles.
 *
 * `lettered_technique` existe pour porter une technique NOMMÉE, qu'une
 * lectrice emporte : la référence porte « RAIN ». Un sigle inventé n'est pas
 * une technique, c'est trois rectangles colorés et une chaîne en mono de 10 px
 * accrochée à rien.
 *
 * ⚠ ET « EMD » EST À UNE LETTRE D'« EMDR ». Sur la carte d'une praticienne
 * EMDR, il se lira comme une faute de frappe, ou pire comme un protocole
 * qu'elle aurait inventé. Ce cas-là est nommé à part parce qu'il est plus
 * grave que les deux autres.
 *
 * ⚠ CONSÉQUENCE ASSUMÉE : tant que la banque ne produit pas de technique du
 * catalogue, cet archétype n'est plus livrable. C'est le bon résultat — mieux
 * vaut dix archétypes qu'un onzième qui ne tient pas sa promesse.
 */
const NAMED_TECHNIQUES = new Set([
  "RAIN", "STOP", "HALT", "SIFT", "TIPP", "ACT", "GROW", "SAFE", "PLEASE",
  "DEARMAN", "SOBER", "SOLER", "WRAP", "RULER", "NAME", "FACE", "CALM",
]);

/** La distance d'édition, bornée : on ne veut savoir que « à une lettre ? ». */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0, j = 0, edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) { i += 1; j += 1; } else { j += 1; }
  }
  return edits + (long.length - j) + (short.length - i) <= 1;
}

export function checkAcronym(
  posts: Array<{ cardLine: string; archetype: string; payload: unknown }>,
  /** Les modalités que la praticienne a saisies : EMDR, IFS, CBT… */
  modalities: string[] = []
): Finding[] {
  const out: Finding[] = [];
  for (const post of posts) {
    const acronym = (post.payload as { acronym?: unknown })?.acronym;
    if (typeof acronym !== "string" || acronym.trim().length === 0) continue;
    const letters = acronym.toUpperCase().replace(/[^A-Z]/g, "");

    for (const modality of modalities) {
      const m = modality.toUpperCase().replace(/[^A-Z]/g, "");
      if (m.length >= 3 && letters !== m && withinOneEdit(letters, m)) {
        out.push({
          check: "text.acronym",
          detail:
            `« ${post.cardLine} » — le sigle « ${acronym} » est à une lettre de « ${modality} » : ` +
            `il se lira comme une faute de frappe`,
        });
      }
    }

    if (!NAMED_TECHNIQUES.has(letters)) {
      out.push({
        check: "text.acronym",
        detail:
          `« ${post.cardLine} » — « ${acronym} » n'est pas une technique nommée, c'est un sigle ` +
          `fabriqué depuis les initiales des tuiles`,
      });
    }
  }
  return out;
}
