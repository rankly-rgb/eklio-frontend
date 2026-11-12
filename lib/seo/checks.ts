import { FAQ_RANGE, META_RANGE, TITLE_MAX, WORD_RANGE, type SeoKind } from "@/lib/seo/kinds";
import { firstParagraphOf, sectionsOf, wordCount } from "@/lib/seo/output";
import type { Finding } from "@/lib/seo/finding";

export type { Finding } from "@/lib/seo/finding";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES CONTRÔLES DÉTERMINISTES D'UNE PIÈCE — PURS, SANS BASE, SANS MODÈLE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * L'ordre du pipeline (`pipeline.ts`) est :
 *   1. le schéma de sortie (Zod, `output.ts`) ;
 *   2. `banned_phrases` puis l'Ethics Guard — en BASE, par RPC, parce que c'est
 *      la base qui refusera l'écriture (trigger `seo_pieces_ethics_gate`) ;
 *   3. les gates adaptées au texte long (`gates.ts`) ;
 *   4. les contrôles SEO et les règles du brief — ICI.
 *
 * Chaque constat dit QUOI corriger : il est renvoyé tel quel au rédacteur pour
 * la réécriture ciblée.
 */

export type PieceText = {
  kind: SeoKind;
  primaryQuery: string;
  /** La ville et l'État du BRIEF — les seuls lieux qu'une pièce peut nommer. */
  city: string | null;
  state: string | null;
  title: string;
  meta: string;
  h1: string;
  slug: string;
  bodyMd: string;
  faq: Array<{ question: string; answer: string }>;
};

/* ── Normalisations ───────────────────────────────────────────────────── */

/** Pour comparer des phrases : minuscules, ponctuation retirée, espaces simples. */
export function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function containsPhrase(text: string, phrase: string): boolean {
  const p = plain(phrase);
  return p.length > 0 && ` ${plain(text)} `.includes(` ${p} `);
}

/** Les mots vides retirés d'un slug. */
export const SLUG_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "by", "with", "from",
  "what", "how", "why", "when", "is", "are", "does", "do", "can", "your", "you", "my", "it",
]);

/** Le slug d'une requête : kebab-case, sans mot vide, 80 caractères au plus. */
export function slugFor(query: string): string {
  const words = plain(query).split(" ").filter((w) => w && !SLUG_STOPWORDS.has(w));
  let slug = "";
  for (const w of words) {
    const next = slug ? `${slug}-${w}` : w;
    if (next.length > 80) break;
    slug = next;
  }
  return slug;
}

/** Tout le texte qu'elle publiera : ce que les gardes doivent lire. */
export function allText(p: Pick<PieceText, "title" | "meta" | "h1" | "bodyMd" | "faq">): string {
  return [p.title, p.meta, p.h1, p.bodyMd, ...p.faq.flatMap((f) => [f.question, f.answer])].join("\n\n");
}

/* ── 4a. Les contrôles SEO ────────────────────────────────────────────── */

export function seoFindings(p: PieceText): Finding[] {
  const out: Finding[] = [];
  if (p.title.length > TITLE_MAX) {
    out.push({ check: "seo.title_length", detail: `the title is ${p.title.length} characters; it must be at most ${TITLE_MAX}.` });
  }
  if (p.meta.length < META_RANGE.min || p.meta.length > META_RANGE.max) {
    out.push({
      check: "seo.meta_length",
      detail: `the meta description is ${p.meta.length} characters; it must be ${META_RANGE.min} to ${META_RANGE.max}.`,
    });
  }
  if (p.h1.trim() === "" || /^#\s/m.test(p.bodyMd)) {
    out.push({ check: "seo.single_h1", detail: "the page must have exactly one H1 (the h1 field) and none in the body." });
  }
  for (const [field, value] of [
    ["title", p.title],
    ["h1", p.h1],
    ["first paragraph", firstParagraphOf(p.bodyMd)],
  ] as const) {
    if (!containsPhrase(value, p.primaryQuery)) {
      out.push({ check: "seo.query_missing", detail: `the ${field} must contain the exact phrase "${p.primaryQuery}".` });
    }
  }
  const words = p.slug.split("-");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || p.slug.length > 80 || words.some((w) => SLUG_STOPWORDS.has(w))) {
    out.push({ check: "seo.slug", detail: `the slug "${p.slug}" must be kebab-case without stop words.` });
  }
  return out;
}

/* ── 4b. La structure demandée par le brief ───────────────────────────── */

const QUESTION_WORDS = new Set([
  "what", "how", "why", "when", "who", "where", "which", "does", "do", "is", "are", "can", "should", "will",
  "the", "and", "for", "you", "your", "with", "about", "this", "that", "from", "into", "like", "look", "work",
  "works", "mean", "need", "know", "happen", "happens", "expect",
]);

function contentRoots(text: string): Set<string> {
  return new Set(
    plain(text)
      .split(" ")
      .filter((w) => w.length > 2 && !QUESTION_WORDS.has(w))
      .map((w) => w.slice(0, 5))
  );
}

/** La première phrase d'un paragraphe. */
export function firstSentence(paragraph: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(paragraph.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim());
  return (m ? m[1] : paragraph).trim();
}

/**
 * « Réponse d'abord » — vérifiable sans modèle, au plus près : la première
 * phrase sous un H2 est une AFFIRMATION (pas une question), courte (4 à 45
 * mots), et elle reprend au moins une racine de contenu du titre. Une phrase
 * d'ambiance (« Many people wonder… ») ou une transition (« Let's look at… »)
 * ne reprend pas le sujet du titre et échoue.
 */
export function answersHeading(heading: string, sentence: string): boolean {
  const s = sentence.trim();
  if (s.endsWith("?")) return false;
  const n = s.split(/\s+/).filter(Boolean).length;
  if (n < 4 || n > 45) return false;
  const h = contentRoots(heading);
  if (h.size === 0) return true;
  const roots = contentRoots(s);
  for (const r of h) if (roots.has(r)) return true;
  return false;
}

export function structureFindings(p: PieceText): Finding[] {
  const out: Finding[] = [];
  const range = WORD_RANGE[p.kind];
  const words = wordCount(p.bodyMd);
  if (words < range.min || words > range.max) {
    out.push({ check: "structure.word_count", detail: `the body is ${words} words; it must be ${range.min} to ${range.max}.` });
  }
  if (p.faq.length < FAQ_RANGE.min || p.faq.length > FAQ_RANGE.max) {
    out.push({ check: "structure.faq_count", detail: `the FAQ has ${p.faq.length} questions; it must have ${FAQ_RANGE.min} to ${FAQ_RANGE.max}.` });
  }
  const sections = sectionsOf(p.bodyMd);
  if (sections.length < 3) {
    out.push({ check: "structure.sections", detail: `the body has ${sections.length} H2 sections; it needs at least 3.` });
  }
  for (const s of sections) {
    const first = firstSentence(s.firstParagraph);
    if (!answersHeading(s.heading, first)) {
      out.push({
        check: "structure.answer_first",
        detail: `under "${s.heading}", the first sentence must directly answer the heading in one plain statement (it reads: "${first.slice(0, 140)}").`,
      });
    }
  }
  for (const f of p.faq) {
    const first = firstSentence(f.answer);
    if (!answersHeading(f.question, first)) {
      out.push({
        check: "structure.faq_answer_first",
        detail: `the answer to "${f.question}" must open with a direct answer (it reads: "${first.slice(0, 140)}").`,
      });
    }
  }
  return out;
}

/* ── 4c. Les liens : seulement la liste fermée ────────────────────────── */

function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/[).,;:!?'"]+$/, "");
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function urlsIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\]\(\s*([^)\s]+)\s*\)/g)) found.add(m[1]);
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s)<>\]"']+/g)) found.add(m[0]);
  for (const m of text.matchAll(/\bwww\.[a-z0-9-]+\.[a-z]{2,}[^\s)<>\]"']*/gi)) found.add(`https://${m[0]}`);
  return [...found];
}

/**
 * ⚠ UNE URL HORS LISTE FAIT ÉCHOUER LA PIÈCE. La liste est `insight_sources`,
 * la veille curée — jamais une recherche web. La comparaison est EXACTE (à la
 * barre finale près) : un lien profond « plausible » sous un domaine autorisé
 * est une URL inventée, qui finit en 404 sur son site.
 */
export function linkFindings(text: string, allowed: readonly string[]): Finding[] {
  const ok = new Set(allowed.map(normalizeUrl));
  return urlsIn(text)
    .filter((u) => !ok.has(normalizeUrl(u)))
    .map((u) => ({ check: "links.not_allowed", detail: `remove the link ${u}: only the listed source URLs may be linked, exactly as written.` }));
}

/* ── 4d. Rien sur le lieu ni le cabinet qui ne vienne du brief ────────── */

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/**
 * Des lieux qu'un modèle cite volontiers autour d'une ville californienne — et
 * les plus grandes villes du pays. Pas un répertoire : un filet. Ce qu'il ne
 * prend pas, la relecture de la praticienne le prend (elle connaît sa ville).
 */
const KNOWN_PLACES = [
  "Bay Area", "East Bay", "South Bay", "North Bay", "Peninsula", "Silicon Valley", "Wine Country", "Inland Empire",
  "Los Angeles", "San Francisco", "San Diego", "San Jose", "Oakland", "Berkeley", "Sacramento", "Fresno",
  "Long Beach", "Santa Monica", "Pasadena", "Palo Alto", "Walnut Creek", "Alameda", "Emeryville", "Fremont",
  "Hayward", "Richmond", "San Mateo", "Santa Cruz", "Santa Barbara", "Irvine", "Anaheim", "Riverside", "Marin",
  "Mill Valley", "San Rafael", "Napa", "Sonoma", "Lake Merritt", "Rockridge", "Temescal", "Piedmont",
  "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "Dallas", "Austin", "Seattle", "Denver",
  "Boston", "Portland", "Atlanta", "Miami", "Brooklyn", "Manhattan",
];

export function placeFindings(text: string, brief: { city: string | null; state: string | null }): Finding[] {
  const out: Finding[] = [];
  const city = plain(brief.city ?? "");
  const stateCode = (brief.state ?? "").toUpperCase();
  const stateName = plain(US_STATES[stateCode] ?? "");
  const flagged = new Set<string>();

  for (const place of KNOWN_PLACES) {
    const p = plain(place);
    if (p === city) continue;
    if (containsPhrase(text, place)) flagged.add(place);
  }
  for (const [code, name] of Object.entries(US_STATES)) {
    if (code === stateCode || plain(name) === stateName) continue;
    // « Washington » et « Georgia » sont aussi des noms : seul le nom d'État en
    // toutes lettres après une virgule, ou le code « , WA », compte.
    if (new RegExp(`,\\s*(${name}|${code})\\b`).test(text)) flagged.add(name);
  }
  if (flagged.size > 0) {
    out.push({
      check: "facts.place_invented",
      detail: `name only ${brief.city && brief.state ? `${brief.city}, ${brief.state}` : "no place"}; remove: ${[...flagged].join(", ")}.`,
    });
  }
  if (/\b(neighbou?rhoods?|districts?|downtown|uptown|minutes (away )?from|walking distance|parking|BART|freeway|near (the )?[A-Z][a-z]+)\b/.test(text)) {
    out.push({ check: "facts.place_invented", detail: "remove neighborhoods, landmarks, transit and distances: they are not in the practice facts." });
  }
  if (/\b\d{1,5}\s+([A-Z][a-z]+\s){1,3}(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Way|Drive|Dr|Lane|Ln|Suite)\b|\b\d{5}(-\d{4})?\b/.test(text)) {
    out.push({ check: "facts.address_invented", detail: "remove the street address or ZIP code: it is not in the practice facts." });
  }
  return out;
}

const INVENTED_PRACTICE_FACTS: Array<[RegExp, string]> = [
  [/\$\s?\d|\b\d+\s?dollars\b|\bsliding[- ]scale\b|\b(session|hourly) (fee|rate)s?\b|\bfree (consultation|consult|session|call)\b/i, "fees and prices"],
  [/\b(insurance|insurers?|in-network|out-of-network|superbills?|aetna|cigna|blue (cross|shield)|kaiser|united ?healthcare|medi-?cal|medicare|medicaid|anthem|optum|magellan|tricare)\b/i, "insurance"],
  [/\b(telehealth|teletherapy|video sessions?|online sessions?|virtual sessions?|in-person sessions?|office hours|evening (sessions|appointments)|weekend (sessions|appointments)|waitlist|accepting new clients)\b/i, "format, hours or availability"],
  [/\b\d+\+?\s+years? (of )?(experience|in practice|practicing)\b|\b(certified|trained) in\b/i, "experience or certifications"],
];

export function practiceFactFindings(text: string): Finding[] {
  return INVENTED_PRACTICE_FACTS.filter(([re]) => re.test(text)).map(([, what]) => ({
    check: "facts.practice_invented",
    detail: `remove anything about ${what}: it is not in the practice facts.`,
  }));
}

/* ── 4e. Psychoéducation seulement ────────────────────────────────────── */

const CLINICAL: Array<[RegExp, string]> = [
  [/\bcur(e|es|ed|ing)\b/i, `never use "cure"`],
  [/\b(diagnose[sd]?|diagnosing)\b|\byour diagnosis\b/i, "do not diagnose or talk about diagnosing the reader"],
  [/\byou(['’]ll| will) (feel|be|get|stop|no longer|finally|notice|experience|find)\b/i, "do not promise what the reader will feel or achieve"],
  [/\b(success rates?|proven to|highly effective|most effective|works for everyone)\b/i, "do not claim effectiveness"],
];

export function clinicalFindings(text: string): Finding[] {
  return CLINICAL.filter(([re]) => re.test(text)).map(([, what]) => ({ check: "clinical.claim", detail: what + "." }));
}

/* ── 4f. La licence est posée par le code, jamais dans le texte ───────── */

export function licenceFindings(text: string): Finding[] {
  return /\b(LMFT|LCSW|LPCC|LPC|LEP|LMHC|PSY|licen[cs]e)\s*(#|no\.?|number)?\s*:?\s*\d{3,}/i.test(text)
    ? [{ check: "licence.in_body", detail: "remove the licence number from the text: Eklio adds the byline and licence." }]
    : [];
}

/** Les contrôles 4a à 4f, dans l'ordre. */
export function deterministicFindings(p: PieceText, allowedUrls: readonly string[]): Finding[] {
  const text = allText(p);
  return [
    ...seoFindings(p),
    ...structureFindings(p),
    ...linkFindings(text, allowedUrls),
    ...placeFindings(text, p),
    ...practiceFactFindings(text),
    ...clinicalFindings(text),
    ...licenceFindings(text),
  ];
}
