import {
  checkEthics,
  hasBlockingViolation,
  type EthicsRuleId,
  type EthicsSeverity,
} from "@/lib/ethics/rules";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * ── CHECK — WHAT IT IS, AND WHAT IT REFUSES TO BE ───────────────────────
 *
 * She pastes something she wrote — a directory profile, a post, an email —
 * and Eklio says which of the six advertising rules it trips and where.
 *
 * ⚠ NO SCORE, NO PERCENTAGE, NO "COMPLIANT". Three refusals, all deliberate:
 *
 *   - A SCORE would be a number Eklio cannot compute. There is no scale on
 *     which "83% ethical" means anything, and she would optimize it.
 *   - "COMPLIANT" is a legal conclusion, and this is six regular expressions.
 *     Passing them means these patterns did not fire, which is a much smaller
 *     claim, and the only honest one.
 *   - A PASS BADGE would invite her to stop reading. What comes back is a
 *     list of findings, or an empty list, and the wording says exactly that.
 *
 * ⚠ HER TEXT IS NEVER STORED. Nothing in this module or its routes writes the
 * pasted text anywhere: not to a table, not to a log line, not into an
 * analytics property. What may be recorded is which RULE IDS fired — six
 * fixed strings — and nothing else.
 *
 * ── THE POINT OF v2: THE MODEL'S OUTPUT IS RE-SCANNED ───────────────────
 *
 * The rewrite goes back through the SAME deterministic scanner that found the
 * problem. A model asked to remove a guarantee will often produce a softer
 * guarantee, and a rewrite returned unchecked is worse than no rewrite at all:
 * she trusts it more, precisely because Eklio handed it to her.
 *
 * So `after` is always computed from the text actually returned, one retry is
 * allowed with the remaining problems named, and when the rewrite STILL trips
 * a rule that is reported rather than hidden. `resolved` is false, the
 * findings are listed, and nothing pretends otherwise.
 *
 * ⚠ THAT REWRITE LIVES IN `lib/check/rewrite.ts`, NOT HERE, and the split is
 * load-bearing. This module must stay free of any import that reaches the
 * model client: the scan route and the page both import it, and a transitive
 * path from a free deterministic scan to `@anthropic-ai/sdk` is what
 * `app/__tests__/max-duration.test.ts` correctly flags as a generation
 * surface. It caught exactly that here.
 */

export type CheckFinding = {
  ruleId: EthicsRuleId;
  severity: EthicsSeverity;
  /** The offending words, quoted from her own text so she can find them. */
  excerpt: string;
  /** The rule as the practitioner reads it, from `ethics_rules` in the database. */
  label: string;
  description: string;
  exampleForbidden: string;
};

export type CheckReview = {
  findings: CheckFinding[];
  /** True when nothing that blocks publication fired. Never called "compliant". */
  clear: boolean;
};

/** The longest text Check will look at. Longer than any profile or post. */
export const CHECK_MAX_CHARS = 6000;
export const CHECK_MIN_CHARS = 20;

function describe(rules: EthicsRule[], ruleId: EthicsRuleId, fallback: string) {
  const rule = rules.find((entry) => entry.id === ruleId);
  return {
    // The database's own words first, so correcting a rule there corrects what
    // she reads here without a deploy. The pattern's phrasing is the fallback,
    // so a rule missing from the table never renders a silent finding.
    label: rule?.short_label ?? ruleId,
    description: rule?.description ?? fallback,
    exampleForbidden: rule?.example_forbidden ?? "",
  };
}

/**
 * The scan. Deterministic, free, and the only thing that decides whether text
 * trips a rule — before a rewrite and after one.
 */
export function reviewText(text: string, rules: EthicsRule[]): CheckReview {
  const { violations } = checkEthics(text);
  return {
    findings: violations.map((violation) => ({
      ruleId: violation.ruleId,
      severity: violation.severity,
      excerpt: violation.excerpt,
      ...describe(rules, violation.ruleId, violation.reason),
    })),
    clear: !hasBlockingViolation(violations),
  };
}
