/*
 * ── LE SURTITRE ET LA CASSE DU TITRE ────────────────────────────────────
 *
 * Deux défauts du mois rendu le 2026-09-21b, tous deux visibles sur la
 * planche et invisibles dans les données.
 */

/**
 * Les mots qui ne font pas un surtitre.
 *
 * Le surtitre est une étiquette — « BURNOUT », « GROUNDING », « AFTER EMDR » —
 * et ces mots-là n'étiquettent rien.
 */
const FILLER = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "from",
  "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these", "those",
  "you", "your", "we", "our", "they", "their", "what", "which", "who", "how", "why",
  "when", "while", "if", "so", "as", "by", "into", "about", "not", "no",
]);

/** Quatre mots au plus, et vingt-deux caractères : ce que la bande mono tient. */
export const EYEBROW_MAX_WORDS = 4;
export const EYEBROW_MAX_CHARS = 22;

/**
 * Le surtitre d'une carte : une à quatre mots, variable d'une carte à l'autre.
 *
 * ⚠ LE THÈME DU MOIS N'EST PAS UN SURTITRE, ET IL ÉTAIT CE QU'ON Y METTAIT.
 *
 * `cardBands` prenait `item.theme` tel quel. Un thème dérivé est une PHRASE —
 * « returning to work when the body has not agreed to it » — et elle arrivait
 * en capitales sur la carte, la même sur les dix posts du même thème : la
 * bande mono en portait quatorze mots, dix fois, dans un mois qui en compte
 * trente. Le surtitre ne disait donc plus rien de la carte, et il disait dix
 * fois la même chose.
 *
 * L'ordre de préférence va du plus propre à cette carte au plus général : le
 * libellé d'angle du sujet, puis les mots porteurs de son titre, puis ceux du
 * thème, puis le nom du cabinet. Le résultat varie d'une carte à l'autre parce
 * que sa source varie avec elle.
 */
export function eyebrowFor(
  parts: { angleLabel?: string | null; title?: string | null; theme?: string | null },
  practiceName: string | null
): string {
  const fallback = practiceName?.trim() || "Eklio";
  for (const source of [parts.angleLabel, parts.title, parts.theme]) {
    const tag = tagFrom(source);
    if (tag) return tag;
  }
  return clampWords(fallback.toUpperCase());
}

/** Les mots porteurs d'une source, réduits à une étiquette, ou `null`. */
function tagFrom(source: string | null | undefined): string | null {
  const text = source?.trim();
  if (!text) return null;

  const words = text.split(/\s+/).map((w) => w.replace(/[^A-Za-z'&-]/g, "")).filter(Boolean);
  if (words.length === 0) return null;

  /*
   * ⚠ UNE SOURCE DÉJÀ COURTE EST PRISE TELLE QUELLE, MOTS OUTILS COMPRIS.
   * « AFTER EMDR » est l'exemple du cahier des charges, et « after » est un
   * mot outil : le filtrer en ferait « EMDR », qui dit autre chose. Le filtre
   * ne sert qu'à EXTRAIRE une étiquette d'une phrase, jamais à en raboter une.
   */
  if (words.length <= EYEBROW_MAX_WORDS) return clampWords(words.join(" ").toUpperCase());

  const carrying = words.filter((w) => !FILLER.has(w.toLowerCase()));
  if (carrying.length === 0) return null;
  return clampWords(carrying.slice(0, 3).join(" ").toUpperCase());
}

/** Au plus quatre mots, et au plus `EYEBROW_MAX_CHARS` caractères. */
function clampWords(tag: string): string {
  let words = tag.split(/\s+/).filter(Boolean).slice(0, EYEBROW_MAX_WORDS);
  while (words.length > 1 && words.join(" ").length > EYEBROW_MAX_CHARS) words = words.slice(0, -1);
  return words.join(" ").slice(0, EYEBROW_MAX_CHARS);
}

/*
 * ── LA CASSE DU TITRE ───────────────────────────────────────────────────
 *
 * ⚠ ET SURTOUT PAS UN `toUpperCase()` SUR LE PREMIER CARACTÈRE DE LA CHAÎNE.
 *
 * Les titres du mois arrivaient en minuscule — « rest is not a reward » — et
 * la correction naïve casse deux choses : elle majusculerait « eMDR » en
 * « EMDR » jamais, mais elle laisserait « emdr » tel quel, et sur un titre qui
 * COMMENCE par un nom propre déjà correct elle ne ferait rien de mal mais sur
 * « iPhone » elle produirait « IPhone ».
 *
 * La règle est donc : ne toucher qu'au premier mot, et seulement s'il est
 * entièrement en minuscules. Un mot qui porte déjà une majuscule quelque part
 * — nom propre, sigle, marque — est laissé exactement comme il est écrit.
 */
export function capitaliseTitle(title: string): string {
  const text = title.trim();
  if (!text) return text;

  const match = text.match(/^(\s*)(\S+)/);
  if (!match) return text;
  const [, lead, first] = match;

  // Déjà une capitale quelque part dans le mot : c'est un choix, pas un oubli.
  if (/[A-Z]/.test(first)) return text;

  const letter = first.search(/[a-z]/);
  if (letter === -1) return text;

  const fixed = first.slice(0, letter) + first[letter].toUpperCase() + first.slice(letter + 1);
  return lead + fixed + text.slice(match[0].length);
}
