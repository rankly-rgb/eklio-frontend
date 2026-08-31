/*
 * Gate 2 (spécificité) et gate 3 (distance inter-candidats) — §2.5.
 *
 * « Tokenize … stopwords removed, stems compared. » Ni `usp_stopwords` ni le
 * calcul de similarité de `usp_check_distinct` ne sont lisibles côté client
 * (contrat §9.8/§9.11, `service_role` uniquement) : cette liste et cette
 * mesure sont donc PROPRES au frontend, pas une copie de ce que fait la
 * base. C'est délibérément plus grossier qu'un vrai stemmer — suffisant pour
 * ce que ce gate doit refuser : une déclaration qui n'ancre RIEN dans le
 * brief.
 */

const STOPWORDS = new Set([
  "a", "about", "after", "again", "all", "also", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "between", "both",
  "but", "by", "can", "could", "did", "do", "does", "doing", "down", "during",
  "each", "few", "for", "from", "further", "had", "has", "have", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
  "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
  "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
  "over", "own", "same", "she", "should", "so", "some", "such", "than",
  "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "will", "with", "you", "your", "yours",
  "yourself", "yourselves",
]);

/** Racine grossière : suffixes anglais les plus fréquents, dans cet ordre. */
function stem(word: string): string {
  for (const suffix of ["ing", "edly", "ed", "ies", "es", "s"]) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/** Minuscule, sans ponctuation, sans mot vide, réduit à des racines. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? [])
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map(stem);
}

export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Jaccard sur les racines — la même mesure sert la gate 2 et la gate 3. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Un candidat doit partager au moins UNE racine avec ce qu'elle a réellement
 * écrit — « generic directory language is a failure », pas négociable (§2.5).
 */
export function passesSpecificity(
  statement: string,
  contentTokens: Set<string>
): boolean {
  const statementTokens = tokenSet(statement);
  for (const token of statementTokens) {
    if (contentTokens.has(token)) return true;
  }
  return false;
}

export function specificityOverlap(
  statement: string,
  contentTokens: Set<string>
): number {
  return jaccardSimilarity(tokenSet(statement), contentTokens);
}

/*
 * Seuil INTRA-LOT, propre au frontend — distinct de
 * `app_settings.usp_similarity_threshold`, qui gouverne `usp_check_distinct`
 * (gate 4, comparaison entre practices) et que ce module ne peut de toute
 * façon pas lire. Comparer six phrases entre elles est un problème plus
 * facile qu'une base entière de statements confirmés ; un seuil plus haut
 * ici est donc un choix, pas un oubli.
 */
export const INTRA_BATCH_SIMILARITY_THRESHOLD = 0.5;
