import "server-only";

import {
  checkEthics,
  hasBlockingViolation,
  type EthicsViolation,
} from "@/lib/ethics/rules";

/**
 * Guarded generation. Every user-publishable string produced by the model is
 * re-checked in code; a blocking violation triggers a regeneration with
 * corrective feedback, and a generation that still fails after the retries
 * throws instead of returning something the caller might persist.
 *
 * Server-only: violations are logged here and must never reach the client.
 */

export class EthicsComplianceError extends Error {
  readonly violations: EthicsViolation[];
  readonly attempts: number;

  constructor(violations: EthicsViolation[], attempts: number) {
    super(
      `Generated copy still violated the advertising-ethics baseline after ${attempts} attempt(s).`
    );
    this.name = "EthicsComplianceError";
    this.violations = violations;
    this.attempts = attempts;
  }
}

/**
 * Turns violations into a short corrective instruction appended to the prompt
 * on retry. Quoting the offending excerpt back is what makes the retry land —
 * a generic "be more careful" does not.
 */
export function buildRegenerationFeedback(
  violations: EthicsViolation[]
): string {
  const blocking = violations.filter((v) => v.severity === "block");
  const relevant = blocking.length > 0 ? blocking : violations;

  if (relevant.length === 0) {
    return "";
  }

  const items = relevant
    .map((v) => `- "${v.excerpt}" — ${v.reason}`)
    .join("\n");

  return `YOUR PREVIOUS DRAFT WAS REJECTED FOR ADVERTISING-ETHICS VIOLATIONS.

The following passages broke the rules:
${items}

Rewrite the whole response. Use psychoeducation only: explain the concept and
what the work looks like, with no promise of results, no timeline, no
testimonial or client praise, and no superlative self-claim. Keep the same
structure and the same warm, grounded voice — change only what makes the copy
non-compliant.`;
}

type GuardOptions<T> = {
  /**
   * Calls the model. `feedback` is empty on the first attempt and carries the
   * corrective instruction on every retry — append it to the prompt.
   */
  callModel: (feedback: string) => Promise<T>;
  /**
   * Structural validation (shape, counts, hex colors…). Throws on failure.
   * Runs before the ethics pass so we never ethics-check a malformed result.
   */
  validate: (raw: T) => void;
  /**
   * Every string in `raw` that the practitioner could publish. Only these are
   * ethics-checked — internal ids and hex values are not user-facing copy.
   */
  publishableStrings: (raw: T) => string[];
  /** Retries after the first attempt. Default 2 (so 3 calls at most). */
  maxRetries?: number;
  /** Label used in server-side violation logs, e.g. "directions" or "kit". */
  label: string;
};

/**
 * Generate → structurally validate → ethics-check every publishable string →
 * regenerate with feedback on a blocking violation → throw after the retries.
 *
 * Nothing is returned unless it passed both validations, so callers can persist
 * the result without a second check.
 */
export async function generateWithEthicsGuard<T>({
  callModel,
  validate,
  publishableStrings,
  maxRetries = 2,
  label,
}: GuardOptions<T>): Promise<T> {
  let feedback = "";
  let lastViolations: EthicsViolation[] = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const raw = await callModel(feedback);

    // Structural problems are the caller's error type, not an ethics failure.
    validate(raw);

    const violations: EthicsViolation[] = [];
    for (const text of publishableStrings(raw)) {
      violations.push(...checkEthics(text).violations);
    }

    logViolations(label, attempt, violations);

    if (!hasBlockingViolation(violations)) {
      return raw;
    }

    lastViolations = violations;
    feedback = buildRegenerationFeedback(violations);
  }

  throw new EthicsComplianceError(lastViolations, maxRetries + 1);
}

/**
 * Server-side only. Violations are tuning data for the pattern set — they are
 * never surfaced to the client, which would teach users how to route around
 * the rules that protect their license.
 */
function logViolations(
  label: string,
  attempt: number,
  violations: EthicsViolation[]
): void {
  if (violations.length === 0) return;

  for (const v of violations) {
    console.warn(
      `[ethics] ${label} attempt=${attempt} severity=${v.severity} reason=${JSON.stringify(
        v.reason
      )} excerpt=${JSON.stringify(v.excerpt)}`
    );
  }
}
