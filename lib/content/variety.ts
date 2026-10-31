/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA VARIÉTÉ DE TOURNURE — CE QUE LA DÉDUPLICATION DES TITRES NE VOIT PAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ MESURÉ SUR LE PREMIER MOIS RÉEL (novembre 2026, kit 45de0dac, 24 posts).
 * Aucun titre n'y est en double, et pourtant la même formule y revient sans
 * cesse : « An unwanted change… », « An unchosen change… », « An unwanted
 * crossroads… » ; « EMDR is not designed to erase… », « EMDR is not limited
 * to… », « EMDR does not require… » ; « CBT does not ask someone to feel
 * grateful… » et « CBT does not ask people to think positively… », qui disent
 * la même chose. `checkDuplicateTitles` compare des titres entiers ; il ne voit
 * pas qu'une construction est réemployée.
 *
 * Deux règles, sur le mois ASSEMBLÉ (pas sur un post seul — une tournure n'est
 * répétée qu'à plusieurs) :
 *
 *   1. `variety.opening`  — une même construction d'ouverture ne dépasse pas
 *      `OPENING_MAX_SHARE` des posts.
 *   2. `variety.negation` — deux posts ne portent pas la même négation sur le
 *      même sujet (« CBT does not ask… » deux fois).
 *
 * ── CE QU'EST UNE « CONSTRUCTION D'OUVERTURE » ──────────────────────────
 *
 * Les premiers mots de la ligne d'image et de la première phrase de la légende,
 * REPLIÉS : les articles se confondent (a / an / the), les adjectifs de
 * l'« inchoisi » aussi (unwanted / unchosen / unexpected…), et une subordonnée
 * se lit par son seul subordonnant (« When the past… », « When a plan… » sont
 * une seule construction). Une négation dans les cinq premiers mots fait en plus
 * sa propre famille, « <sujet> + négation » — c'est ce qui range ensemble
 * « EMDR is not designed… » et « EMDR does not require… ».
 *
 * ⚠ UN POST COMPTE UNE FOIS PAR FAMILLE, même si sa ligne d'image et sa légende
 * s'ouvrent pareil (c'est souvent le cas : la légende reprend la ligne). Compter
 * les deux ferait d'un post seul une répétition.
 *
 * ⚠ C'EST UN CONSTAT QUI ÉCHANGE, PAS UN SEUIL QU'ON RELÂCHE. Le détail nomme le
 * post de trop par sa ligne de carte ; la sélection le retire et prend un
 * remplaçant au banc (`select.ts`).
 */

import type { Finding, PostUnderCheck } from "@/lib/content/month-checks";

/** La part maximale des posts qui peut partager une construction d'ouverture. */
export const OPENING_MAX_SHARE = 0.15;

/** Combien de posts au plus peuvent partager une ouverture, pour un mois de `n`. */
export function openingCap(n: number): number {
  return Math.max(2, Math.floor(n * OPENING_MAX_SHARE));
}

const ARTICLES = new Set(["a", "an", "the"]);
/*
 * ⚠ UNE NÉGATION DANS UNE RELATIVE N'EST PAS « SUR LE SUJET » DU POST.
 * « a future that never got to happen », « a change they never wanted » : le mot
 * devant la négation est un relatif ou un pronom repris, pas ce dont le post
 * parle. « you » reste un sujet : « You do not have to… » deux fois est bien la
 * même négation adressée à la même personne.
 */
const NOT_A_SUBJECT = new Set(["that", "which", "who", "whom", "it", "they", "this", "these", "those", "there", "what", "he", "she", "we", "i"]);
const UNCHOSEN = new Set(["unwanted", "unchosen", "unexpected", "unplanned", "unwelcome", "unasked", "uninvited"]);
const SUBORDINATORS = new Set(["when", "if", "while", "as", "after", "before", "because", "although", "once", "until"]);
const AUXILIARIES = new Set([
  "is", "are", "was", "were", "be", "does", "do", "did", "can", "could", "will", "would", "should", "may", "might", "must", "has", "have",
]);
/* Les mots qui ne font pas la négation : « not only », « not just »… gardent le mot suivant. */
const NEGATION_FILLER = new Set(["only", "just", "always", "necessarily", "really", "simply", "a", "an", "the", "to"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 0);
}

/** La première phrase d'un texte. */
export function firstSentence(text: string | undefined | null): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  return (m ? m[0] : t.split("\n")[0]).trim();
}

function isNegation(word: string): boolean {
  return word === "not" || word === "never" || word.endsWith("n't");
}

/**
 * Les familles d'ouverture d'une phrase : sa tête repliée, et — si une négation
 * tombe dans les cinq premiers mots — « <sujet> NEG ».
 */
export function openingFamilies(sentence: string): string[] {
  const w = words(sentence);
  if (w.length === 0) return [];
  const out: string[] = [];

  const first = ARTICLES.has(w[0]) ? "a" : w[0];
  if (SUBORDINATORS.has(first)) {
    out.push(`lead:${first}`);
  } else if (w.length > 1) {
    const second = UNCHOSEN.has(w[1]) ? "unwanted" : w[1];
    out.push(`lead:${first} ${second}`);
  }

  const neg = w.slice(0, 6).findIndex(isNegation);
  if (neg > 0) {
    const subject = subjectBefore(w, neg);
    if (subject) out.push(`neg:${subject}`);
  }
  return out;
}

/** Le mot-sujet devant l'auxiliaire nié (« EMDR is not » → emdr ; « You do not » → you). */
function subjectBefore(w: string[], neg: number): string | null {
  /* « doesn't » porte l'auxiliaire en lui ; « does not », non. */
  let at = w[neg].endsWith("n't") ? neg - 1 : neg - 1;
  if (!w[neg].endsWith("n't") && AUXILIARIES.has(w[at] ?? "")) at -= 1;
  const subject = w[at];
  if (!subject || ARTICLES.has(subject) || AUXILIARIES.has(subject) || NOT_A_SUBJECT.has(subject)) return null;
  return UNCHOSEN.has(subject) ? "unwanted" : subject;
}

/**
 * Les négations d'un texte, en clés « <sujet> NOT <mot nié> ».
 *
 * « CBT does not ask someone to feel grateful » → `cbt not ask`.
 * « EMDR is not only about revisiting… » → `emdr not about`.
 */
export function negationsIn(text: string): string[] {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 1; i < w.length; i += 1) {
    if (!isNegation(w[i])) continue;
    const subject = subjectBefore(w, i);
    if (!subject) continue;
    let j = i + 1;
    while (j < w.length && NEGATION_FILLER.has(w[j])) j += 1;
    const negated = w[j];
    if (!negated) continue;
    out.add(`${subject} not ${negated}`);
  }
  return [...out];
}

/** Ce qui ouvre un post : sa ligne d'image, puis la première phrase de sa légende. */
function openingsOf(post: PostUnderCheck): string[] {
  return [post.hook, firstSentence(post.caption)].filter((t): t is string => !!t && t.trim().length > 0);
}

/**
 * Ce que la règle de négation lit : ce qui OUVRE le post et se lit dans le flux —
 * la ligne d'image, la ligne de carte, la phrase de carte, la première phrase de
 * la légende.
 *
 * ⚠ PAS LE CORPS DE LA LÉGENDE. Mesuré sur le mois de référence 2027-01
 * (`month-corin.json`) : « The work is not always about a crisis » et « This work
 * isn't about doing less », en deuxième et troisième paragraphe, disent deux
 * choses différentes et tomberaient sous la même clé. Les répétitions de novembre
 * (« CBT does not ask… », « You do not have to… ») sont toutes en ouverture.
 */
function negationSurfaces(post: PostUnderCheck): string[] {
  const statement =
    post.payload && typeof post.payload === "object" && "statement" in (post.payload as Record<string, unknown>)
      ? String((post.payload as Record<string, unknown>).statement ?? "")
      : "";
  return [post.hook ?? "", post.cardLine ?? "", statement, firstSentence(post.caption)].filter(
    (t) => t.trim().length > 0
  );
}

export type VarietyReport = {
  /** Famille → index des posts qui l'ouvrent, trié par taille décroissante. */
  openings: Array<{ family: string; posts: number[] }>;
  /** Clé de négation → index des posts qui la portent (deux et plus). */
  negations: Array<{ key: string; posts: number[] }>;
  cap: number;
};

/** La mesure, sans verdict : ce que le rapport et le contrôle lisent. */
export function measureVariety(posts: PostUnderCheck[]): VarietyReport {
  const openings = new Map<string, Set<number>>();
  const negations = new Map<string, Set<number>>();
  posts.forEach((post, i) => {
    for (const family of new Set(openingsOf(post).flatMap((s) => openingFamilies(firstSentence(s))))) {
      if (!openings.has(family)) openings.set(family, new Set());
      openings.get(family)!.add(i);
    }
    for (const key of new Set(negationSurfaces(post).flatMap(negationsIn))) {
      if (!negations.has(key)) negations.set(key, new Set());
      negations.get(key)!.add(i);
    }
  });
  const sorted = <T extends string>(m: Map<string, Set<number>>, name: T) =>
    [...m.entries()]
      .map(([k, s]) => ({ [name]: k, posts: [...s].sort((a, b) => a - b) }) as { posts: number[] } & Record<T, string>)
      .sort((a, b) => b.posts.length - a.posts.length || a[name].localeCompare(b[name]));
  return {
    openings: sorted(openings, "family"),
    negations: sorted(negations, "key").filter((n) => n.posts.length >= 2),
    cap: openingCap(posts.length),
  };
}

/** « lead:a unwanted » → « a unwanted… » ; « neg:emdr » → « emdr + négation ». */
function familyLabel(family: string): string {
  return family.startsWith("neg:") ? `${family.slice(4)} + négation` : `${family.slice(5)}…`;
}

/**
 * Les constats de variété du mois assemblé.
 *
 * ⚠ LE POST NOMMÉ EST LE DERNIER DE LA FAMILLE, par sa ligne de carte : c'est
 * lui que la sélection retire (`finding.detail.includes(p.cardLine)`), et le
 * dernier est celui qui a été ajouté au banc le plus tard.
 */
export function checkVariety(posts: PostUnderCheck[]): Finding[] {
  const report = measureVariety(posts);
  const out: Finding[] = [];
  for (const { family, posts: idx } of report.openings) {
    if (idx.length <= report.cap) continue;
    const last = posts[idx[idx.length - 1]];
    out.push({
      check: "variety.opening",
      detail: `${idx.length} posts sur ${posts.length} s'ouvrent sur la même construction (${familyLabel(family)}), au plus ${report.cap} : « ${last.cardLine} »`,
    });
  }
  for (const { key, posts: idx } of report.negations) {
    const last = posts[idx[idx.length - 1]];
    out.push({
      check: "variety.negation",
      detail: `${idx.length} posts portent la même négation (« ${key} ») : « ${last.cardLine} »`,
    });
  }
  return out;
}
