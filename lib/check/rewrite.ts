import { callRewrite } from "@/lib/generation/model";
import { rulesBlock } from "@/lib/ethics/guard";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { reviewText, type CheckFinding } from "@/lib/check/review";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * ── THE REWRITE, AND THE RE-SCAN THAT MAKES IT SAFE ─────────────────────
 *
 * Split from `lib/check/review.ts` on purpose: this file reaches the model,
 * that one must not. The scan is free, deterministic and imported by a page;
 * dragging the Anthropic client into that import graph turns a regex pass into
 * a generation surface.
 *
 * A model asked to remove a guarantee will often produce a SOFTER guarantee.
 * A rewrite returned unchecked is therefore worse than no rewrite at all: she
 * trusts it more, precisely because Eklio handed it to her. So the model's own
 * output goes back through the same scanner that found the problem, always.
 */

/** At most one rewrite retry: two model calls, never a loop. */
export const MAX_REWRITE_ATTEMPTS = 2;

const REWRITE_SYSTEM = `You rewrite a short piece of copy written by a licensed therapist in the United States, so that it stops breaking a specific advertising rule.

Rules, without exception:
- Change as little as possible. Remove or reword ONLY what breaks the rule named.
- Never introduce a fact, name, credential, number, modality or claim that is not already in the text.
- Never replace a forbidden claim with a softer version of the same claim. "Will help you heal" is the same promise as "heals" and is equally forbidden.
- Keep her voice. If she writes plainly, stay plain; do not make it sound like marketing.
- American English. No exclamation marks, no hype words, no emoji.
- Reply with the rewritten text only — no quotes, no explanation, no preamble, no list of what you changed.`;

function instructionFor(text: string, findings: CheckFinding[]): string {
  return [
    "Rewrite the text below so it no longer breaks these rules:",
    "",
    ...findings.map(
      (finding) =>
        `- ${finding.label}: ${finding.description}` +
        (finding.exampleForbidden ? ` Never: "${finding.exampleForbidden}"` : "") +
        `\n  The words that broke it: "${finding.excerpt}"`
    ),
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/** Injected so every test spends nothing. Production passes the real model call. */
export type CheckRewriter = (system: string, instruction: string) => Promise<string>;

export type RewriteOutcome = {
  /** The best text produced. Falls back to her original if the model returned nothing. */
  text: string;
  /** What her own text tripped, before anything was rewritten. */
  before: CheckFinding[];
  /** What the RETURNED text trips. Always measured, never assumed. */
  after: CheckFinding[];
  /** How many model calls were actually made. */
  attempts: number;
  /** True when the returned text trips nothing that blocks. Never "compliant". */
  resolved: boolean;
  /** True when the model gave back nothing usable and her text is unchanged. */
  unchanged: boolean;
};

/**
 * Rewrite, then re-scan. The re-scan is not optional and not conditional.
 *
 * Returns honestly when it fails: `resolved: false` with `after` listing what
 * the model's own output still trips. The caller shows both and lets her
 * decide — hiding a failed rewrite would be the one outcome worse than not
 * offering the rewrite at all.
 */
export async function rewriteAndRescan(
  text: string,
  rules: EthicsRule[],
  rewrite: CheckRewriter = callRewrite,
  maxAttempts: number = MAX_REWRITE_ATTEMPTS
): Promise<RewriteOutcome> {
  const before = reviewText(text, rules).findings;
  const blocking = before.filter((finding) => finding.severity === "block");

  if (blocking.length === 0) {
    // Nothing to fix. This never reaches the model, so it never costs a credit.
    return { text, before, after: before, attempts: 0, resolved: true, unchanged: true };
  }

  const system = [REWRITE_SYSTEM, "", ETHICS_SYSTEM_RULES, "", rulesBlock(rules)]
    .join("\n")
    .trim();

  let current = text;
  let findings = before;
  let attempts = 0;
  let everChanged = false;

  while (attempts < maxAttempts) {
    attempts += 1;

    const problems = findings.filter((finding) => finding.severity === "block");
    const produced = (await rewrite(system, instructionFor(current, problems))).trim();

    // An empty answer is not a rewrite. Keep what she wrote rather than
    // handing her a blank box that looks like her words were deleted.
    if (produced.length === 0) break;

    everChanged = true;
    current = produced;
    findings = reviewText(current, rules).findings;

    if (!findings.some((finding) => finding.severity === "block")) break;
  }

  const after = reviewText(current, rules).findings;
  return {
    text: current,
    before,
    after,
    attempts,
    resolved: !after.some((finding) => finding.severity === "block"),
    unchanged: !everChanged,
  };
}
