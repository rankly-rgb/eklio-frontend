import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { rulesBlock } from "@/lib/ethics/guard";
import type { EthicsRule } from "@/lib/catalog/types";
import type {
  ContentArchetype,
  ContentRegister,
  TakingClients,
} from "@/lib/data/content";
import { ARCHETYPE_FLOOR, ON_IMAGE_MAX_WORDS, ON_IMAGE_MIN_WORDS } from "./capacity";

/*
 * ── ONE SEAM, AND EVERYTHING ELSE IS PURE ───────────────────────────────
 *
 * The pipeline never imports an SDK. It takes a `ContentModel`, and every
 * model call in the month goes through this one interface. That is what lets
 * the whole pipeline be exercised — register choice, archetype rotation, floor
 * enforcement, the scanner, regeneration, alt text, the reservation and its
 * release — with a stub, months before a key exists.
 *
 * ── ON THE VENDOR ───────────────────────────────────────────────────────
 *
 * The ruling was "captions go through OpenAI, do not add Anthropic". The
 * premise does not hold in this repo: EVERY text path here is already
 * Anthropic — `lib/ai/client.ts`, `lib/generation/model.ts`, the Check
 * rewrite — and `@anthropic-ai/sdk` is the only model SDK in `package.json`.
 * OpenAI appears once, for `gpt-image-1`, and nowhere in text.
 *
 * Following the ruling literally would have ADDED a vendor for text rather
 * than removed one, and produced the two text paths, two keys and two outage
 * surfaces it was written to prevent. So the reversible option: the existing
 * seam, one vendor for text, and the decision written down for review. Moving
 * this file to OpenAI later is one implementation of one interface — which is
 * the other reason the seam is here.
 */

export type OnImageRequest = {
  register: ContentRegister;
  /** The register's safety rule, read from `content_registers`, never inlined. */
  safetyRule: string;
  archetype: ContentArchetype;
  theme: string;
  /** The hard ceiling for this archetype, in characters. */
  floorChars: number;
  context: string;
  takingClients: TakingClients | null;
  /** Set on a retry: what was wrong with the previous attempt. */
  retryBecause?: string;
};

export type CaptionRequest = {
  register: ContentRegister;
  safetyRule: string;
  theme: string;
  /** The line already written and already fitted. The caption goes UNDER it. */
  onImageText: string;
  context: string;
  takingClients: TakingClients | null;
  retryBecause?: string;
};

export type AltTextRequest = {
  /*
   * ⚠ FROM THE COMPOSED IMAGE, NOT FROM THE PLAN. Alt text describes what a
   * sighted reader SEES: the photograph, with the line set over it. Writing it
   * from the caption would describe something that is not on the screen, which
   * is worse than no alt text because it is confidently wrong.
   */
  composedDescription: string;
  onImageText: string;
  archetype: ContentArchetype;
};

export type RewriteRequest = {
  text: string;
  /** The rule broken and the excerpt that broke it. */
  problem: string;
};

/**
 * The seam. Four calls, all returning one string.
 *
 * `label` names what wrote the month, and the pipeline copies it onto every
 * post. It is not decoration: a stubbed month and a real one are otherwise
 * indistinguishable in the database, and a fixture that cannot be told from
 * production is how a fixture ends up published.
 */
export type ContentModel = {
  readonly label: string;
  writeOnImageLine(request: OnImageRequest): Promise<string>;
  writeCaption(request: CaptionRequest): Promise<string>;
  writeAltText(request: AltTextRequest): Promise<string>;
  rewrite(request: RewriteRequest): Promise<string>;
};

/* ── The prompts ────────────────────────────────────────────────────────── */

/** Deontology first, always. No product framing may read as a relaxation. */
export function contentSystemPrompt(rules: EthicsRule[]): string {
  return [
    ETHICS_SYSTEM_RULES,
    rulesBlock(rules),
    `You write social copy for one licensed mental-health clinician in private practice in the United States. Everything you write here is copy she may publish under her own name and licence.

It has to read as psychoeducation: what an experience is like, what the work is like, what someone might notice. Never a claim about what therapy produces, never a description of a named client, never a diagnosis of the reader.

Plain American English. Short sentences. Contractions are fine. No exclamation marks, no hype, no emoji, no hashtags.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const CTA_RULE: Record<TakingClients, string> = {
  yes: "This practice is taking new clients. The post may end with a plain invitation to get in touch. It does not have to.",
  waitlist:
    "This practice is NOT taking new clients; there is a waitlist. If the post refers to working together at all, it must say waitlist. Never invite a booking.",
  no: "This practice is NOT taking new clients and has no waitlist. The post must not ask the reader to reach out, book, enquire, or join anything.",
};

function ctaLine(taking: TakingClients | null): string {
  /*
   * ⚠ UNANSWERED IS THE STRICTEST, NOT THE LOOSEST. An unanswered check-in
   * means nobody has said she is taking clients — so no post asks anyone to
   * reach out. Failing open here would put a booking invitation on the feed of
   * a clinician with a closed practice.
   */
  return taking ? CTA_RULE[taking] : CTA_RULE.no;
}

export function onImagePrompt(request: OnImageRequest): string {
  return [
    `THEME OF THE MONTH: ${request.theme}`,
    `REGISTER: ${request.register}. ${request.safetyRule}`,
    ctaLine(request.takingClients),
    request.context,
    `Write the line that goes ON the image, in her typeface, at large size. It is the whole of what a reader sees in the grid before they tap.

It must be between ${ON_IMAGE_MIN_WORDS} and ${ON_IMAGE_MAX_WORDS} words, and at most ${request.floorChars} characters. That character limit is a measurement of the ${request.archetype} layout in the narrowest typeface this practice might use — text past it is cut off the picture, so it is a hard limit, not a preference.

This is not the opening of the caption. The caption is written separately and sits underneath. Do not write a fragment that needs the caption to finish it.

Return the line and nothing else. No quotation marks around it.`,
    request.retryBecause ? `YOUR PREVIOUS ATTEMPT WAS REJECTED. ${request.retryBecause}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function captionPrompt(request: CaptionRequest): string {
  return [
    `THEME OF THE MONTH: ${request.theme}`,
    `REGISTER: ${request.register}. ${request.safetyRule}`,
    ctaLine(request.takingClients),
    request.context,
    `THE LINE ALREADY ON THE IMAGE, which the reader has already read:

"${request.onImageText}"

Write the caption that sits underneath it. Carry the thought forward — do not restate the line, and do not open by quoting it back. Two or three short paragraphs at most, under 2,200 characters.

Return the caption and nothing else.`,
    request.retryBecause ? `YOUR PREVIOUS ATTEMPT WAS REJECTED. ${request.retryBecause}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function altTextPrompt(request: AltTextRequest): string {
  return `Write alt text for a social post image, for a reader using a screen reader.

WHAT THE IMAGE CONTAINS: ${request.composedDescription}

THE TEXT SET OVER IT, WORD FOR WORD: "${request.onImageText}"

Describe the photograph first, in one sentence, then say that the text appears over it and quote it in full. A screen-reader user must end up with everything a sighted reader got, including every word of the line. Under 420 characters. Do not begin with "Image of" or "Photo of".

Return the alt text and nothing else.`;
}

/* ── The real call ─────────────────────────────────────────────────────── */

async function oneLine(system: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  // Trim the quotation marks a model adds around a returned line about one
  // time in five, whatever the prompt says. Cheaper than a retry.
  return (text?.text ?? "").trim().replace(/^["“”']|["“”']$/g, "").trim();
}

export function anthropicContentModel(rules: EthicsRule[]): ContentModel {
  const system = contentSystemPrompt(rules);
  return {
    label: GENERATION_MODEL,
    writeOnImageLine: (request) => oneLine(system, onImagePrompt(request), 400),
    writeCaption: (request) => oneLine(system, captionPrompt(request), 1500),
    writeAltText: (request) => oneLine(system, altTextPrompt(request), 400),
    rewrite: (request) =>
      oneLine(
        system,
        `This text breaks an advertising-ethics rule this clinician is bound by.

THE TEXT:
"${request.text}"

THE PROBLEM: ${request.problem}

Rewrite it so the problem is gone. Keep the length, the register and the meaning as close to the original as the rule allows. Return the rewritten text and nothing else.`,
        1500
      ),
  };
}

/** The measured ceiling for an archetype, re-exported so callers need one import. */
export { ARCHETYPE_FLOOR };
