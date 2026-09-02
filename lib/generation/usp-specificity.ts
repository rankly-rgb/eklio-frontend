/*
 * Gate 2 (spécificité) et gate 3 (distance inter-candidats) — §2.5.
 *
 * CORRECTION : `usp_stopwords` et `app_settings.usp_similarity_threshold`
 * sont désormais lus DIRECTEMENT depuis la base (`lib/generation/usp-guardrails.ts`,
 * clé service-role) plutôt que dupliqués ici. Deux définitions de « mot
 * vide », ou un seuil qui dérive de celui de la base, sont exactement la
 * divergence déjà corrigée pour `banned_phrases` — pas quelque chose à
 * réintroduire pour ce gate-ci. Ni `stopwords` ni `threshold` n'ont donc de
 * valeur par défaut codée ici : ce module ne fait QUE la mesure, la base
 * reste l'unique source des deux réglages.
 *
 * Le stemmer reste, lui, une approximation PROPRE au frontend — la base n'en
 * a pas (`usp_stopwords` est une liste de mots, pas de racines) : « stems
 * compared » (§2.5) n'a de toute façon pas d'équivalent à lire côté base.
 */

/** Racine grossière : suffixes anglais les plus fréquents, dans cet ordre. */
function stem(word: string): string {
  for (const suffix of ["ing", "edly", "ed", "ies", "es", "s"]) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/** Minuscule, sans ponctuation, sans mot vide (liste de la BASE), réduit à des racines. */
export function tokenize(text: string, stopwords: Set<string>): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? [])
    .filter((word) => word.length > 2 && !stopwords.has(word))
    .map(stem);
}

export function tokenSet(text: string, stopwords: Set<string>): Set<string> {
  return new Set(tokenize(text, stopwords));
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
  contentTokens: Set<string>,
  stopwords: Set<string>
): boolean {
  const statementTokens = tokenSet(statement, stopwords);
  for (const token of statementTokens) {
    if (contentTokens.has(token)) return true;
  }
  return false;
}

export function specificityOverlap(
  statement: string,
  contentTokens: Set<string>,
  stopwords: Set<string>
): number {
  return jaccardSimilarity(tokenSet(statement, stopwords), contentTokens);
}
