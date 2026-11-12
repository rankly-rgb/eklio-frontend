import { jaccardSimilarity, tokenize } from "@/lib/generation/usp-specificity";
import { containsPhrase } from "@/lib/seo/checks";
import type { Finding } from "@/lib/seo/finding";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES GATES USP, ADAPTÉES AU TEXTE LONG
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le pipeline USP (`lib/generation/usp-options.ts:259`, `runGates`) a cinq gates
 * pour des énoncés de 200 caractères. Le diagnostic (§4) a mesuré ce qui tient
 * sur 1 000 mots :
 *
 *   phrases bannies   tient tel quel → appelé tel quel (RPC, `pipeline.ts`) ;
 *   spécificité       « une racine commune suffit » : tout texte long passe →
 *                     ICI, la pièce doit porter les faits de SA grille (modalité,
 *                     population, ville) ET au moins deux racines de SON
 *                     positionnement ou de son USP ;
 *   distance          Jaccard sur des racines, seuil 0,55 pour 200 caractères :
 *                     dilué sur 1 000 mots → ICI, Jaccard sur des SHINGLES de
 *                     5 mots (des suites de mots, pas des mots), contre ses
 *                     pièces précédentes ;
 *   collision         `usp_check_distinct` est lié à `usp_fingerprints` → ICI,
 *                     la même mesure contre les pièces des AUTRES abonnées de la
 *                     même ville et de la même modalité : deux sites qui portent
 *                     le même texte se nuisent l'un l'autre chez Google ;
 *   register          non appliquée : elle refuse la moindre mention d'une
 *                     modalité, ce qu'une page sur l'EMDR doit précisément faire.
 *
 * Le tokenizer et la mesure de Jaccard sont ceux du pipeline USP, réutilisés
 * sans modification.
 */

/** Racines vides propres au texte long, en plus de la longueur ≤ 2 que `tokenize` écarte déjà. */
const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "with", "that", "this", "are", "can", "from", "about", "what", "how",
  "who", "why", "when", "they", "their", "them", "have", "has", "not", "but", "may", "will", "into", "more",
  "some", "one", "often", "also", "each", "other", "than", "then", "there", "these", "those", "which",
  "might", "could", "should", "would", "does", "did",
]);

const SHINGLE = 5;

/** Les suites de cinq racines d'un texte. */
export function shingles(text: string): Set<string> {
  const roots = tokenize(text, STOPWORDS);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= roots.length; i += 1) out.add(roots.slice(i, i + SHINGLE).join(" "));
  return out;
}

/** Contre ses propres pièces : au-delà, deux pages de son site se répètent. */
export const OWN_DISTANCE_MAX = 0.2;
/** Contre les pièces d'autres abonnées de la même ville et modalité. */
export const PEER_COLLISION_MAX = 0.15;

export type ComparedPiece = { id: string; text: string };

export function similarityTo(text: string, others: readonly ComparedPiece[]): Array<{ id: string; score: number }> {
  const mine = shingles(text);
  return others.map((o) => ({ id: o.id, score: jaccardSimilarity(mine, shingles(o.text)) }));
}

export function distanceFindings(text: string, own: readonly ComparedPiece[]): Finding[] {
  return similarityTo(text, own)
    .filter((s) => s.score > OWN_DISTANCE_MAX)
    .map((s) => ({
      check: "gate.own_distance",
      detail: `this piece repeats one of her earlier pages (similarity ${s.score.toFixed(2)} > ${OWN_DISTANCE_MAX}); rewrite it in different words with a different structure.`,
    }));
}

/**
 * ⚠ LE DÉTAIL NE DIT RIEN DE L'AUTRE ABONNÉE. Il est renvoyé au modèle et
 * conservé dans le rapport de la pièce : ni son nom, ni son texte, ni l'identifiant
 * de sa pièce n'y figurent.
 */
export function collisionFindings(text: string, peers: readonly ComparedPiece[]): Finding[] {
  const worst = similarityTo(text, peers).reduce((max, s) => Math.max(max, s.score), 0);
  return worst > PEER_COLLISION_MAX
    ? [{
        check: "gate.peer_collision",
        detail: `this piece is too close to a page already written for another practice in the same city (similarity ${worst.toFixed(2)} > ${PEER_COLLISION_MAX}); rewrite it in her own words and angle.`,
      }]
    : [];
}

export type SpecificFacts = {
  modalityTerm: string | null;
  populationTerm: string | null;
  city: string | null;
  /** Son positionnement et son USP, en ses mots. */
  brandText: string;
};

/** Au moins deux racines de son positionnement, quand il en a assez pour que ce soit juste. */
const BRAND_OVERLAP_MIN = 2;
const BRAND_ROOTS_FLOOR = 4;

export function specificityFindings(text: string, facts: SpecificFacts): Finding[] {
  const out: Finding[] = [];
  for (const [what, value] of [
    ["approach", facts.modalityTerm],
    ["population", facts.populationTerm],
    ["city", facts.city],
  ] as const) {
    if (value && !containsPhrase(text, value)) {
      out.push({ check: "gate.specificity", detail: `the piece must name the ${what} "${value}" in plain words.` });
    }
  }
  const brand = new Set(tokenize(facts.brandText, STOPWORDS));
  if (brand.size >= BRAND_ROOTS_FLOOR) {
    const roots = new Set(tokenize(text, STOPWORDS));
    const shared = [...brand].filter((r) => roots.has(r));
    if (shared.length < BRAND_OVERLAP_MIN) {
      out.push({
        check: "gate.specificity",
        detail: `the piece reads generic: weave in what is specific to her practice, in her words: "${facts.brandText.slice(0, 300)}".`,
      });
    }
  }
  return out;
}

/*
 * ── LA MÊME QUESTION SUR DEUX PAGES DE SON SITE ─────────────────────────
 *
 * Mesuré au premier mois réel (2026-11-12) : la distance par shingles entre ses
 * trois pièces valait 0,000 à 0,005, et pourtant « Do I have to share every
 * detail…? » revenait dans la FAQ de la page locale, dans celle d'un article et
 * dans un H2 de l'autre. Deux pages qui répondent à la même question se font
 * concurrence pour elle — la cannibalisation, au niveau où les moteurs de
 * réponse la lisent. Les mots diffèrent ; les racines de la question, non.
 */
export const QUESTION_OVERLAP_MAX = 0.5;

/**
 * ⚠ LES MOTS DE SA GRILLE NE COMPTENT PAS. « EMDR therapy » est dans presque
 * toutes ses questions : le compter faisait de « Why might new parents consider
 * EMDR therapy? » une répétition de « Who may consider EMDR therapy? »
 * (troisième passage réel). `ignore` reçoit le terme de la MODALITÉ seulement : la
 * population, elle, est précisément ce qui distingue « pour les jeunes parents »
 * d'une question générale.
 */
export function questionOverlapFindings(
  questions: readonly string[],
  answeredElsewhere: readonly string[],
  ignore: readonly string[] = []
): Finding[] {
  const out: Finding[] = [];
  const skip = new Set(STOPWORDS);
  for (const term of ignore) for (const w of term.toLowerCase().match(/[a-z']+/g) ?? []) skip.add(w);
  for (const q of questions) {
    const mine = new Set(tokenize(q, skip));
    if (mine.size === 0) continue;
    for (const other of answeredElsewhere) {
      if (jaccardSimilarity(mine, new Set(tokenize(other, skip))) >= QUESTION_OVERLAP_MAX) {
        out.push({
          check: "gate.question_repeated",
          detail: `"${q}" is already answered on another of her pages ("${other}"); ask a different question.`,
        });
        break;
      }
    }
  }
  return out;
}
