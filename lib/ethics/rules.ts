/*
 * Socle déontologique publicitaire — praticiens de santé mentale licenciés (US).
 *
 * Un seul socle commun, volontairement lu de la façon la plus restrictive, pour
 * tenir sous l'ACA Code of Ethics, l'APA Ethics Code et n'importe quel board
 * d'État sans maintenir 50 jeux de règles. Les règles d'un État peuvent être
 * plus strictes sur un point précis : le disclaimer rappelle que la
 * responsabilité finale reste au praticien (voir lib/ethics/disclaimer.ts).
 *
 * Module pur : aucun I/O, aucune variable d'environnement, aucun import de
 * lib/ai. C'est lib/ai qui importera cette couche (Lot 2), jamais l'inverse.
 */

/*
 * Bloc injecté tel quel dans les prompts de génération. C'est le garde-fou de
 * niveau 1 (pilotage du modèle) ; FORBIDDEN_PATTERNS ci-dessous est le niveau 2
 * (vérification côté code), parce qu'un prompt seul ne suffit jamais.
 */
export const ETHICS_SYSTEM_RULES = `ADVERTISING ETHICS — NON-NEGOTIABLE RULES

You are writing copy for a licensed mental-health clinician in private practice
in the United States. Their advertising is governed by the ACA Code of Ethics,
the APA Ethics Code, and their state licensing board. Non-compliant copy can put
their license at risk. Every sentence you write must satisfy all of the rules
below. When a sentence is borderline, rewrite it as a description of the work.

1. PSYCHOEDUCATION ONLY.
   Explain what a concept means, what the work looks like, what a first session
   involves, who the practice serves. Never state or imply what the work will
   produce for the reader.

2. NO OUTCOME PROMISES, GUARANTEES, OR SUCCESS RATES.
   Forbidden: "heal your anxiety in 12 weeks", "proven results", "clinically
   proven", "guaranteed relief", "lasting relief", "90% of my clients feel
   better", "end your panic attacks".
   Write instead: "understand what your anxiety is protecting you from",
   "a space to look at the patterns that keep repeating",
   "learn how your nervous system responds to stress".

3. NO CLIENT TESTIMONIALS, REVIEWS, RATINGS, OR PARAPHRASED CLIENT PRAISE.
   Never quote a client, never paraphrase one ("my clients say..."), never
   invent one, never leave a placeholder for one, never suggest collecting them.
   Soliciting testimonials from current or former clients is prohibited for this
   audience. Use credentials, training, modalities and professional memberships
   as proof instead.

4. CREDENTIALS EXACTLY AS PROVIDED.
   State the license type, license number and state of licensure verbatim, as
   given to you. Never infer, upgrade or invent a credential, never present a
   training or a workshop as a certification, and never borrow authority from an
   unrelated degree.

5. NEVER DIAGNOSE THE READER.
   Do not write "you have anxiety" or "you are suffering from trauma". Naming
   who the practice serves is fine ("people navigating anxiety"); telling the
   reader what they have, or promising to treat a named condition to a promised
   result, is not.

6. NO URGENCY, SCARCITY, OR SELF-AWARDED SUPERLATIVES.
   Forbidden: "only 2 spots left", "book before rates go up", "act now",
   "best therapist in town", "#1 counselor", "top-rated practice".

Write warm, grounded, plain American English. No hype, no sales pressure, no
startup vocabulary.`;

export type EthicsSeverity = "block" | "warn";

export type ForbiddenPattern = {
  /** Insensible à la casse, sans drapeau `g` (exec doit rester sans état). */
  pattern: RegExp;
  /** Formulation lisible, réutilisée dans le feedback de régénération. */
  reason: string;
  severity: EthicsSeverity;
};

/*
 * Conditions cliniques nommées le plus souvent dans ce type de copy. Sert à
 * n'attraper une promesse de résolution que lorsqu'elle porte sur une condition
 * ("cure your anxiety") et pas sur autre chose ("fix a broken booking link").
 */
const CONDITION =
  "anxiety|anxieties|depression|trauma|traumas|ptsd|panic\\s+attacks?|panic|ocd|grief|addiction|addictions|burnout|stress|insomnia|adhd|phobias?|shame|codependency|overwhelm";

/* Verbes qui transforment la mention d'une condition en promesse de résultat. */
const RESOLUTION_VERB =
  "heal|heals|healed|healing|cure|cures|cured|curing|fix|fixes|fixed|fixing|" +
  "eliminate|eliminates|eliminated|eliminating|erase|erases|erasing|" +
  "end|ends|ending|resolve|resolves|resolved|resolving|" +
  "overcome|overcomes|overcoming|banish|banishes|banishing|" +
  "remove|removes|removing|conquer|conquers|conquering|defeat|defeats";

/*
 * Chaque pattern porte en commentaire sa base déontologique, pour qu'on puisse
 * distinguer une obligation d'une préférence de style avant de l'affaiblir.
 *
 * `block` : jamais persisté — déclenche une régénération, puis une erreur.
 * `warn`  : journalisé pour affinage, ne bloque pas la génération.
 *
 * Les limites de mots (\b) sont systématiques : "cure" ne doit pas se
 * déclencher sur "manicure", "secure" ou "obscure" (cas testés).
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  // ── Promesses de résultat ────────────────────────────────────────────────
  {
    // ACA C.3.a / APA 5.01(b) — aucune affirmation sur le résultat des services.
    pattern: new RegExp(
      `\\b(?:${RESOLUTION_VERB})\\b(?:\\s+\\w+){0,3}\\s+\\b(?:${CONDITION})\\b`,
      "i"
    ),
    reason:
      "Promet de résoudre une condition nommée. Décrire le travail, jamais son résultat.",
    severity: "block",
  },
  {
    // ACA C.3.a — "free you from / rid you of" : la même promesse sans le verbe.
    pattern:
      /\b(?:free\s+you\s+from|rid\s+you\s+of|get\s+rid\s+of|take\s+away\s+your|make\s+(?:it|your\s+\w+)\s+go\s+away)\b/i,
    reason:
      "Promet de faire disparaître la difficulté du lecteur. Reformuler vers la compréhension de cette difficulté.",
    severity: "block",
  },
  {
    // ACA C.3.a — promesse d'état final, écrite sans verbe de résolution :
    // "in six weeks your anxiety is gone".
    pattern: new RegExp(
      `\\b(?:${CONDITION})\\b[^.!?]{0,30}?\\b(?:is|are|will\\s+be|'?ll\\s+be)\\s+(?:gone|behind\\s+you|history|a\\s+thing\\s+of\\s+the\\s+past|no\\s+longer\\s+(?:a\\s+problem|an\\s+issue))\\b`,
      "i"
    ),
    reason:
      "Promet la disparition de la difficulté. Décrire le travail, pas l'état supposé qu'il laisse.",
    severity: "block",
  },
  {
    // ACA C.3.a — une promesse datée reste une promesse de résultat.
    pattern:
      /\b(?:results?|relief|change|changes|healing|progress|improvement|breakthrough|transformation|better)\b[^.!?]{0,40}?\bin\s+(?:as\s+little\s+as\s+|just\s+|only\s+)?\d+\s*(?:days?|weeks?|months?|sessions?)\b/i,
    reason:
      "Promet un résultat dans un délai donné. Retirer le délai et la promesse.",
    severity: "block",
  },
  {
    // ACA C.3.a — "guarantee" est une promesse de résultat sous toutes ses formes.
    pattern: /\bguarantee(?:s|d|ing)?\b/i,
    reason:
      "Garantit un résultat. Aucun résultat thérapeutique ne peut être garanti en publicité.",
    severity: "block",
  },
  {
    // APA 5.01(b)(3) — aucune affirmation sur le fondement scientifique de ses
    // propres services. Dire qu'une modalité est "evidence-based" reste permis ;
    // dire que les résultats sont "proven" ne l'est pas.
    pattern:
      /\b(?:clinically|scientifically|medically|statistically)\s+proven\b|\bproven\s+(?:to\b|results?\b|method|approach|system|technique|protocol|track\s+record)/i,
    reason:
      "Affirme une efficacité prouvée. Nommer la modalité sans affirmer que le résultat est prouvé.",
    severity: "block",
  },
  {
    // ACA C.3.a — un taux de réussite est une affirmation de résultat chiffrée.
    // Volontairement chiffré : « most of my clients stay six months » décrit
    // une pratique, pas un résultat (cas testé). Un éloge non chiffré du type
    // « most of my clients feel better » est attrapé par le pattern témoignage.
    pattern:
      /\b(?:\d{1,3}\s*(?:%|percent)|\d+\s+out\s+of\s+\d+|nine\s+out\s+of\s+ten)\s+(?:of\s+)?(?:my|our|her|his|their)?\s*(?:clients?|patients?)\b|\bsuccess\s+rate\b/i,
    reason:
      "Annonce un taux de réussite auprès des clients. Les statistiques de résultat sont interdites.",
    severity: "block",
  },
  {
    // ACA C.3.a — promettre la durabilité d'un résultat reste une promesse.
    pattern:
      /\b(?:lasting|permanent|life-?long|complete|full)\s+(?:relief|results?|recovery|healing|peace|calm|freedom)\b/i,
    reason:
      "Promet un résultat durable ou total. Décrire la direction du travail, pas sa permanence.",
    severity: "block",
  },
  {
    // ACA C.3.a — "therapy that works" est une affirmation d'efficacité.
    // Cas autorisé (testé) : "the approach that works best for you" décrit une
    // personnalisation, pas une efficacité — d'où le lookahead négatif.
    pattern:
      /\b(?:treatment|therapy|approach|method)\s+that\s+(?:actually\s+|really\s+)?(?:works|will\s+work)\b(?!\s+(?:best\s+)?for\s+you)/i,
    reason:
      "Affirme que la prise en charge fonctionne. Décrire la modalité sans promettre qu'elle réussit.",
    severity: "block",
  },

  // ── Témoignages clients ──────────────────────────────────────────────────
  {
    // ACA C.3.b / APA 5.05 — solliciter ou publier un témoignage de client
    // (actuel ou ancien) est interdit ; nommer le format l'est donc aussi.
    pattern: /\btestimonials?\b/i,
    reason:
      "Fait référence à des témoignages. Cette audience ne peut en publier aucun.",
    severity: "block",
  },
  {
    // ACA C.3.b / APA 5.05 — l'éloge de client paraphrasé est un témoignage.
    pattern:
      /\b(?:my|our|her|his|their)\s+(?:clients?|patients?)\s+(?:say|says|said|report|reports|reported|tell|told|describe|describes|rave|love|feel|feels|felt|often\s+say)\b/i,
    reason:
      "Paraphrase l'éloge de clients. Un témoignage client ne peut être ni sollicité ni publié.",
    severity: "block",
  },
  {
    // ACA C.3.b — avis et notes fonctionnent comme des témoignages publiés.
    // "reviewed by" exige un contexte client : "reviewed by a licensed
    // supervisor" reste légitime (cas testé).
    pattern:
      /\bclient\s+(?:reviews?|feedback|ratings?)\b|\bpatient\s+reviews?\b|\b(?:reviewed|rated|recommended)\s+by\s+(?:my|our|former|past|hundreds\s+of|\d+)\s*(?:clients?|patients?)\b/i,
    reason:
      "Utilise un langage d'avis ou de note client, qui fonctionne comme un témoignage.",
    severity: "block",
  },
  {
    // ACA C.3.b — une note en étoiles est un avis client, glyphe compris.
    pattern:
      /\bfive[-\s]star\b|\b\d(?:\.\d)?\s*(?:\/\s*5|out\s+of\s+5)\s*stars?\b|[★⭐]/iu,
    reason:
      "Contient une note en étoiles, qui se lit comme une évaluation de clients.",
    severity: "block",
  },
  {
    // ACA C.3.b — "success story" est un témoignage sous un autre nom.
    pattern: /\b(?:success|client|patient)\s+stor(?:y|ies)\b/i,
    reason:
      "Présente des parcours clients comme preuve, ce qui fonctionne comme un témoignage.",
    severity: "block",
  },

  // ── Superlatifs auto-décernés ────────────────────────────────────────────
  {
    // ACA C.3.a / APA 5.01(b) — pas d'affirmation comparative invérifiable.
    // "#1" a besoin de sa propre alternative : \b ne s'accroche pas avant "#".
    // "practice" est volontairement absent de la liste des noms : "best
    // practices" est une expression légitime (cas testé).
    pattern:
      /(?:\b(?:best|top|leading|premier|foremost|most\s+trusted|top-?rated|number\s+one)|#\s*1)\s+(?:\w+\s+){0,2}(?:therapist|therapists|counselor|counselors|counsellor|psychologist|psychologists|clinician|clinicians|clinic|provider|providers|coach|therapy)\b/i,
    reason:
      "Superlatif auto-décerné. Un classement comparatif ne peut être étayé et reste interdit.",
    severity: "block",
  },
  {
    // APA 5.01(b) — laisse entendre une reconnaissance non étayable. Warn :
    // la distinction peut être réelle, mais elle doit être vérifiée à la main.
    pattern:
      /\b(?:award-?winning|nationally\s+recognized|world-?class|world-?renowned|renowned)\b/i,
    reason:
      "Revendique une reconnaissance possiblement non étayable. Préférer des credentials vérifiables.",
    severity: "warn",
  },

  // ── Diagnostic du lecteur ────────────────────────────────────────────────
  {
    // APA 5.01 / ACA C.3.a — la publicité ne diagnostique jamais son lecteur.
    pattern: new RegExp(
      `\\byou\\s+(?:have|clearly\\s+have|probably\\s+have|likely\\s+have|are\\s+suffering\\s+from|suffer\\s+from)\\s+(?:\\w+\\s+){0,2}\\b(?:${CONDITION})\\b`,
      "i"
    ),
    reason:
      "Pose un diagnostic au lecteur. Décrire une expérience vécue, jamais attribuer un diagnostic.",
    severity: "block",
  },

  // ── Urgence et rareté ────────────────────────────────────────────────────
  {
    // ACA C.3.a — la pression commerciale est inappropriée pour un soin clinique.
    pattern:
      /\bonly\s+\d+\s+(?:spots?|slots?|places?|openings?)\s+(?:left|remaining|available)\b|\blimited[-\s]time\s+offer\b|\bact\s+now\b|\bdon'?t\s+wait\b|\blast\s+chance\b|\bbook\s+(?:now\s+)?before\s+(?:prices|rates|spots)\b/i,
    reason:
      "Emploie une tactique d'urgence ou de rareté, inappropriée pour un service clinique.",
    severity: "block",
  },
];

/*
 * Mention PROHIBITIVE : le motif est cité pour être interdit, pas affirmé.
 *
 * Cas réel qui a motivé ce garde (reproduit deux fois contre l'API) : le
 * prompt multi-plateformes du kit dit au constructeur de site
 *   « No hype, no urgency, no testimonials, no outcome claims (no "proven",
 *     no "results", no "lasting relief", no star ratings) »
 * — c'est-à-dire le modèle appliquant le socle déontologique à la lettre. Le
 * bloquer revenait à punir la conformité, et faisait échouer toute la
 * génération après plusieurs minutes.
 *
 * Le garde est VOLONTAIREMENT ÉTROIT : le marqueur doit être immédiatement
 * accolé au motif, seuls des espaces, guillemets ou parenthèses pouvant
 * s'intercaler. Ni virgule ni mot intermédiaire — « no matter what, we
 * guarantee results » et « no one can promise to cure your anxiety, but »
 * restent donc bloqués (cas testés).
 */
const PROHIBITIVE_LEAD =
  /\b(?:no|not|never|without|avoid|avoids|avoiding|exclude|excludes|excluding|omit|omits|omitting)\b[\s"'\u201c\u201d\u2018\u2019(\[]*$/i;

/** Vrai si l'occurrence trouvée en `index` est introduite comme une interdiction. */
function isProhibitiveMention(text: string, index: number): boolean {
  return PROHIBITIVE_LEAD.test(text.slice(Math.max(0, index - 40), index));
}

/**
 * Première occurrence RÉELLEMENT fautive d'un motif, les mentions prohibitives
 * passées.
 *
 * On continue de balayer après une mention prohibitive : « no testimonials …
 * and our clients say » doit rester bloqué sur la seconde occurrence. Le
 * scanner est reconstruit à chaque appel — les motifs de `FORBIDDEN_PATTERNS`
 * restent sans drapeau `g`, donc sans état partagé.
 */
function findViolation(pattern: RegExp, text: string): RegExpExecArray | null {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const scanner = new RegExp(pattern.source, flags);

  let match: RegExpExecArray | null;
  while ((match = scanner.exec(text)) !== null) {
    if (!isProhibitiveMention(text, match.index)) return match;
    // Garde anti-boucle sur un motif capable de matcher le vide.
    if (match.index === scanner.lastIndex) scanner.lastIndex += 1;
  }
  return null;
}

export type EthicsViolation = {
  reason: string;
  severity: EthicsSeverity;
  /** Extrait fautif, cité tel quel dans les logs et le feedback de régénération. */
  excerpt: string;
};

export type EthicsCheckResult = {
  /** Faux dès qu'une violation `block` est présente ; les `warn` n'y touchent pas. */
  ok: boolean;
  violations: EthicsViolation[];
};

/**
 * Passe tous les patterns sur `text` et renvoie les violations trouvées.
 *
 * Un pattern ne remonte que sa première occurrence : le but est de nommer le
 * problème au modèle, pas d'en dresser l'inventaire exhaustif.
 */
export function checkEthics(text: string): EthicsCheckResult {
  const violations: EthicsViolation[] = [];

  if (!text) return { ok: true, violations };

  for (const { pattern, reason, severity } of FORBIDDEN_PATTERNS) {
    // Les mentions prohibitives (« no testimonials ») ne sont pas des
    // violations : c'est le socle appliqué, pas transgressé.
    const match = findViolation(pattern, text);
    if (match) {
      violations.push({ reason, severity, excerpt: match[0].trim() });
    }
  }

  return { ok: !hasBlockingViolation(violations), violations };
}

/** Vrai si au moins une violation interdit la persistance du contenu. */
export function hasBlockingViolation(violations: EthicsViolation[]): boolean {
  return violations.some((v) => v.severity === "block");
}
