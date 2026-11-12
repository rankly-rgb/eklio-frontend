import { FAQ_RANGE, META_RANGE, TITLE_MAX, WORD_RANGE, type SeoKind } from "@/lib/seo/kinds";
import type { Brand, Practitioner, Source } from "@/lib/seo/context";
import type { Finding } from "@/lib/seo/finding";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE BRIEF DE RÉDACTION — TOUT CE QUE LE MODÈLE SAIT, ET RIEN D'AUTRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Une pièce = un brief structuré. Il porte la cible, l'identité de marque, la
 * ville et l'État, le titre et la licence de la praticienne, la liste FERMÉE des
 * sources qu'il peut citer, et les règles — les mêmes que `checks.ts` vérifie
 * après. Une règle écrite ici et pas vérifiée là-bas serait une intention ; une
 * règle vérifiée là-bas et pas écrite ici ferait payer une réécriture évitable.
 *
 * ⚠ LA SIGNATURE N'EST PAS DEMANDÉE AU MODÈLE. Le nom, le titre et la mention de
 * licence sont posés par le code (export et JSON-LD). Le brief les donne pour
 * que le texte sache qui parle, et interdit de les recopier.
 */

export type SeoWriterBrief = {
  kind: SeoKind;
  primaryQuery: string;
  /** « EMDR therapy », ou null pour une cible de population seule. */
  modalityTerm: string | null;
  /** « new parents », ou null. */
  populationTerm: string | null;
  /** Pour une page locale seulement ; un article ne nomme pas de lieu. */
  city: string | null;
  state: string | null;
  practitioner: Practitioner;
  brand: Brand;
  sources: Source[];
  /** Les règles déontologiques actives (`ethics_rules`), en une ligne chacune. */
  ethicsRules: string[];
  /** Les phrases bannies actives (`banned_phrases`). */
  bannedPhrases: string[];
};

export type FailureReport = {
  findings: Finding[];
  /** Ce que le premier passage a rendu, pour une réécriture CIBLÉE. */
  previous: unknown;
};

const KIND_BRIEF: Record<SeoKind, string> = {
  local_page:
    "A local service page for the practitioner's own website. It explains the approach plainly to someone in that city who is deciding whether to reach out, and ends with a calm invitation to get in touch.",
  article:
    "A psychoeducation article for the practitioner's own website. It answers what people actually ask about the topic, accurately and plainly, for a general reader.",
};

export function writerSystemPrompt(brief: SeoWriterBrief): string {
  const range = WORD_RANGE[brief.kind];
  const sources =
    brief.sources.length > 0
      ? brief.sources.map((s) => `- ${s.label}: ${s.url}`).join("\n")
      : "- (none: do not include any link)";
  return [
    "You write website copy for a licensed psychotherapist in private practice in the United States.",
    "Write in American English. Return only the JSON object the schema describes.",
    "",
    `WHAT THIS IS: ${KIND_BRIEF[brief.kind]}`,
    "",
    "STRUCTURE",
    `- The body (intro + sections, FAQ excluded) is ${range.min} to ${range.max} words. Aim for the middle of that range.`,
    "- 4 to 7 sections. Each section heading is a question or a plain topic a reader would search for. No '#' characters in headings.",
    "- ANSWER FIRST: the first sentence under every section heading directly answers that heading in one plain sentence. Then explain.",
    "- Paragraphs are plain prose. The only formatting allowed inside them is a Markdown link [anchor](url) or **bold**. Use bullets only where a list is genuinely clearer.",
    `- FAQ: ${FAQ_RANGE.min} to ${FAQ_RANGE.max} questions real people ask about this topic, each answered in 2 to 4 sentences, answer first. Do not repeat a section heading as a question.`,
    `- title: at most ${TITLE_MAX} characters, and it contains the exact phrase "${brief.primaryQuery}".`,
    `- h1: contains the exact phrase "${brief.primaryQuery}". It is the only H1; never put one in the body.`,
    `- intro: one paragraph whose first sentence contains the exact phrase "${brief.primaryQuery}".`,
    `- meta_description: ${META_RANGE.min} to ${META_RANGE.max} characters (count them), one or two sentences, no quotation marks.`,
    "",
    "WHAT YOU MAY SAY",
    "- Psychoeducation only: what the approach is, how it generally works, what a session usually looks like, who it is commonly used with, what to ask a therapist. Describe the work, never its results.",
    "- Never promise or imply an outcome (no 'you will feel', no 'relief', no 'lasting change', no timelines, no success rates).",
    "- Never use the words cure, fix, heal or guarantee about a person or a condition. Never diagnose the reader ('you have…', 'you are suffering from…').",
    "- No testimonials, no client stories, no quotes from clients or colleagues, no ratings, no 'clients often say'.",
    "- No superlatives about the practitioner (best, leading, top, renowned, expert) and no urgency or scarcity.",
    "- Do not mention research findings or statistics unless you state them as general, widely accepted facts with no numbers.",
    "",
    "FACTS: use ONLY these. Never invent anything about the practice.",
    `- Practitioner: ${brief.practitioner.name}${brief.practitioner.credential ? `, ${brief.practitioner.credential}` : ""}.`,
    `- Practice name: ${brief.brand.practiceName}.`,
    brief.kind === "local_page" && brief.city && brief.state
      ? `- Location: ${brief.city}, ${brief.state}. Name only this city and state. No neighborhoods, streets, landmarks, nearby towns, commute times or "near me" phrasing.`
      : "- Location: do not name any city, state, neighborhood or region.",
    "- Do NOT state fees, prices, insurance, sliding scale, office hours, availability, waitlists, telehealth or in-person options, years of experience, trainings or certifications: none of them are in the facts.",
    brief.modalityTerm ? `- Approach: ${brief.modalityTerm}.` : null,
    brief.populationTerm ? `- People this is for: ${brief.populationTerm}.` : null,
    brief.brand.positioning ? `- Her positioning, in her words: ${brief.brand.positioning}` : null,
    brief.brand.usp ? `- What makes her practice specific, in her words: ${brief.brand.usp}` : null,
    "- Do NOT write a byline, the practitioner's licence, a licence number or a signature: Eklio adds them.",
    "",
    "VOICE",
    brief.brand.soundsLike.length > 0 ? `- Sounds like: ${brief.brand.soundsLike.join(" / ")}` : "- Sounds like: plain, warm, unhurried.",
    brief.brand.neverWrite.length > 0 ? `- Never writes: ${brief.brand.neverWrite.join(" / ")}` : null,
    "- You may use 'I' sparingly to describe how the practitioner works. Never to describe what clients feel or achieve.",
    "",
    "LINKS",
    "- You may link to at most 2 of these sources, with the exact URL as written. Any other URL makes the piece fail. Linking is optional.",
    sources,
    "",
    "ADVERTISING RULES THAT APPLY TO A LICENSED CLINICIAN",
    ...brief.ethicsRules.map((r) => `- ${r}`),
    "",
    "PHRASES THAT MUST NOT APPEAR (every therapist site says them)",
    brief.bannedPhrases.length > 0 ? brief.bannedPhrases.map((p) => `"${p}"`).join(", ") : "(none)",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function writerUserPrompt(brief: SeoWriterBrief, failure?: FailureReport): string {
  const head = `Write the ${brief.kind === "local_page" ? "local service page" : "article"} for: "${brief.primaryQuery}".`;
  if (!failure) return head;
  return [
    head,
    "",
    "Your previous version failed these checks. Fix exactly these problems and keep everything else as it was:",
    ...failure.findings.map((f) => `- [${f.check}] ${f.detail}`),
    "",
    "Previous version:",
    JSON.stringify(failure.previous),
  ].join("\n");
}
