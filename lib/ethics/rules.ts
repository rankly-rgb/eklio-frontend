/**
 * Strict advertising-ethics baseline for licensed mental-health clinicians.
 *
 * One common baseline, deliberately the most restrictive reading, so it holds
 * across ACA, APA and every state board without maintaining 50 rule sets.
 * Every user-publishable string produced by Eklio passes through `checkEthics`
 * before it is ever persisted or shown.
 *
 * This module is pure (no I/O, no env) so it can run in tests, on the server
 * inside generation, and in validation helpers alike.
 */

/**
 * Injected verbatim into every generation prompt. Written as plain imperatives
 * because the model follows instructions literally — the code-side patterns in
 * FORBIDDEN_PATTERNS are the enforcement, this is the steering.
 */
export const ETHICS_SYSTEM_RULES = `ADVERTISING ETHICS — NON-NEGOTIABLE

You are writing marketing copy for a licensed mental-health clinician in the
United States. Their advertising is governed by their professional association
(ACA, APA) and their state licensing board. Copy that violates these rules can
cost them their license. Every line you write must satisfy all of the following.

1. Psychoeducation only. Explain what a concept is, what the work looks like,
   what a first session feels like. Never promise what it will produce.

2. No outcome claims, guarantees, or success-rate statements. Do not write
   "heal your anxiety in 12 weeks", "proven results", "lasting relief",
   "we will get you to a better place", or any variation that promises a
   result, a timeline, or a rate of success.
   Required style instead: reframe toward understanding and process, e.g.
   "understand what your anxiety is protecting you from",
   "a space to look at what keeps repeating".

3. No client testimonials, reviews, star ratings, or paraphrased client praise —
   ever, in any tier, in any section. Soliciting and publishing testimonials
   from current or former clients is prohibited for this audience. Never invent
   one, never invent a placeholder for one, never suggest collecting them.
   Use credentials, training, publications and professional affiliations as
   proof instead.

4. State credentials exactly as given: license type, license number, and state
   of licensure. Never borrow authority from an unrelated degree, never imply
   a credential the clinician did not provide, never inflate a training into a
   certification.

5. Never diagnose the reader and never claim to treat a named condition with a
   promised result. Describing who the practice serves is fine
   ("people navigating anxiety"); promising to cure them is not.

6. No urgency or scarcity sales tactics ("only 2 spots left", "book before
   rates go up") and no superlative self-claims ("best therapist",
   "#1 in the city", "top-rated").

Write warm, grounded, plain American English. Never hype, never startup-speak.
When you are unsure whether a sentence promises an outcome, rewrite it as a
description of the work instead.`;

export type EthicsSeverity = "block" | "warn";

export type ForbiddenPattern = {
  pattern: RegExp;
  reason: string;
  severity: EthicsSeverity;
};

/**
 * Conditions this audience most often writes about. Used to build the
 * outcome-promise patterns, so "cure your anxiety" is caught while a sentence
 * like "cure times vary by clinic" (not about a condition) is not.
 */
const CONDITION =
  "anxiety|depression|trauma|ptsd|panic|ocd|grief|addiction|burnout|stress|insomnia|adhd|phobias?|shame|codependency";

/** Verbs that turn a condition mention into a promise of resolution. */
const RESOLUTION_VERB =
  "heal|cure|cures|curing|fix|fixes|fixing|eliminate|eliminates|eliminating|erase|erases|end|ends|ending|resolve|resolves|resolving|overcome|overcomes|overcoming|banish|remove|removes";

/**
 * Every pattern is case-insensitive and word-boundaried. Each carries the
 * ethics basis it enforces so the next engineer can tell a legal requirement
 * from a style preference before weakening it.
 *
 * `block` = never persist, regenerate or fail.
 * `warn`  = logged for tuning, does not stop the generation.
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  // --- Outcome promises -----------------------------------------------------
  {
    // ACA C.3.a / APA 5.01(b) — no claims about the outcome of services.
    pattern: new RegExp(
      `\\b(?:${RESOLUTION_VERB})\\b(?:\\s+\\w+){0,3}?\\s+\\b(?:${CONDITION})\\b`,
      "i"
    ),
    reason:
      "Promises to resolve a named condition. Describe the work instead of its result.",
    severity: "block",
  },
  {
    // ACA C.3.a — timeframe promises are outcome claims with a deadline.
    pattern:
      /\b(?:results?|relief|change|progress|improvement|better)\b[^.!?]{0,40}?\bin\s+(?:as\s+little\s+as\s+)?\d+\s*(?:days?|weeks?|months?|sessions?)\b/i,
    reason:
      "Promises a result within a timeframe. Remove the timeline and the promise.",
    severity: "block",
  },
  {
    // ACA C.3.a — "guarantee" is an outcome claim in every form.
    pattern: /\bguarantee(?:d|s|ing)?\b/i,
    reason:
      "Guarantees an outcome. No therapeutic result may be guaranteed in advertising.",
    severity: "block",
  },
  {
    // APA 5.01(b)(3) — no claims about the scientific basis of one's services.
    pattern:
      /\b(?:clinically\s+proven|scientifically\s+proven|proven\s+(?:to|results?|method|approach|system|track\s+record)|evidence\s+that\s+proves)\b/i,
    reason:
      "Claims proof of effectiveness. Say the modality is evidence-based, never that results are proven.",
    severity: "block",
  },
  {
    // ACA C.3.a — success-rate statements are outcome claims.
    pattern:
      /\b(?:\d{1,3}\s*%|\d+\s+out\s+of\s+\d+)\s*(?:of\s+)?(?:my\s+|our\s+)?(?:clients?|patients?|people)\b/i,
    reason:
      "States a success rate for clients. Success-rate statements are prohibited.",
    severity: "block",
  },
  {
    // ACA C.3.a — "lasting/permanent" change is a durability promise.
    pattern:
      /\b(?:lasting|permanent|life-?changing|transformative)\s+(?:relief|results?|change|healing|recovery|transformation)\b/i,
    reason:
      "Promises lasting or transformative results. Describe the direction of the work, not its permanence.",
    severity: "block",
  },
  {
    // ACA C.3.a — "free you from / rid you of" is a promise in disguise.
    pattern:
      new RegExp(
        `\\b(?:free\\s+you\\s+from|rid\\s+you\\s+of|take\\s+away\\s+your|make\\s+your\\s+\\w+\\s+go\\s+away)\\b`,
        "i"
      ),
    reason:
      "Promises removal of the client's difficulty. Reframe as understanding the difficulty.",
    severity: "block",
  },

  // --- Testimonials ---------------------------------------------------------
  {
    // ACA C.3.b / APA 5.05 — solicited testimonials from clients are prohibited.
    pattern:
      /\b(?:my|our|her|his|their)\s+(?:clients?|patients?)\s+(?:say|says|said|report|reports|reported|tell\s+me|rave|love)\b/i,
    reason:
      "Paraphrases client praise. Client testimonials may not be solicited or published.",
    severity: "block",
  },
  {
    // ACA C.3.b — naming the format is as prohibited as quoting one.
    pattern: /\btestimonials?\b/i,
    reason:
      "References testimonials. This audience may not publish client testimonials at all.",
    severity: "block",
  },
  {
    // ACA C.3.b — review/rating language implies published client feedback.
    pattern:
      /\b(?:client\s+reviews?|patient\s+reviews?|reviewed\s+by\s+(?:my|our|former|past)\s+clients?|star\s+rating|\d(?:\.\d)?\s*(?:\/\s*5|out\s+of\s+5)\s*stars?|five[-\s]star)\b/i,
    reason:
      "Uses client review or star-rating language, which functions as a testimonial.",
    severity: "block",
  },
  {
    // ACA C.3.b — a star glyph in body copy is a rating in practice.
    pattern: /[★☆]/u,
    reason: "Contains star-rating characters, which read as client ratings.",
    severity: "block",
  },
  {
    // ACA C.3.b — "success story" is a testimonial by another name.
    pattern: /\b(?:success\s+stor(?:y|ies)|client\s+stor(?:y|ies))\b/i,
    reason:
      "Presents client outcomes as stories, which functions as a testimonial.",
    severity: "block",
  },

  // --- Superlative self-claims ---------------------------------------------
  {
    // ACA C.3.a / APA 5.01(b) — no false or deceptive comparative claims.
    // `#1` needs its own alternative: `\b` never matches before `#`.
    pattern:
      /(?:\b(?:best|top|leading|number\s+one|top-?rated|most\s+trusted|premier|foremost)|#\s*1)\s+(?:therapist|counselor|psychologist|clinician|practice|provider|clinic)\b/i,
    reason:
      "Superlative self-claim. Comparative rankings cannot be substantiated and are prohibited.",
    severity: "block",
  },
  {
    // APA 5.02 — implying endorsement the practitioner does not hold.
    pattern:
      /\b(?:award-?winning|nationally\s+recognized|world-?class|renowned)\b/i,
    reason:
      "Claims recognition that may not be substantiated. State verifiable credentials instead.",
    severity: "warn",
  },

  // --- Diagnostic promises --------------------------------------------------
  {
    // APA 5.01 — advertising may not diagnose the reader.
    pattern:
      new RegExp(
        `\\byou\\s+(?:have|are\\s+suffering\\s+from|clearly\\s+have|probably\\s+have)\\s+(?:\\w+\\s+){0,2}\\b(?:${CONDITION})\\b`,
        "i"
      ),
    reason:
      "Diagnoses the reader. Marketing copy may describe experiences, never assign a diagnosis.",
    severity: "block",
  },
  {
    // ACA C.3.a — "treatment that works" is an outcome claim about a condition.
    // Allow-case (tested): "the approach that works best for you" is
    // personalization, not an efficacy claim — hence the lookahead.
    pattern:
      new RegExp(
        `\\b(?:treatment|therapy|approach)\\s+that\\s+(?:actually\\s+)?(?:works|will\\s+work)\\b(?!\\s+(?:best\\s+)?for\\s+you)`,
        "i"
      ),
    reason:
      "Claims the treatment works. Describe the modality without promising it succeeds.",
    severity: "block",
  },

  // --- Urgency and scarcity -------------------------------------------------
  {
    // ACA C.3.a — pressure tactics are inappropriate for clinical services.
    pattern:
      /\b(?:only\s+\d+\s+(?:spots?|slots?|places?)\s+(?:left|remaining|available)|limited\s+time\s+offer|act\s+now|don'?t\s+wait|book\s+before\s+(?:prices|rates)\s+go\s+up|last\s+chance)\b/i,
    reason:
      "Uses urgency or scarcity pressure, which is inappropriate for clinical services.",
    severity: "block",
  },
];

export type EthicsViolation = {
  reason: string;
  severity: EthicsSeverity;
  /** The offending substring, so prompts and logs can quote it back. */
  excerpt: string;
};

export type EthicsCheckResult = {
  /** True when no `block`-severity violation was found. */
  ok: boolean;
  violations: EthicsViolation[];
};

/**
 * Runs every forbidden pattern over `text`.
 *
 * `ok` is false only when a `block` violation is present — `warn` violations
 * are returned for logging and tuning but do not stop a generation.
 */
export function checkEthics(text: string): EthicsCheckResult {
  const violations: EthicsViolation[] = [];

  if (!text) {
    return { ok: true, violations };
  }

  for (const { pattern, reason, severity } of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({ reason, severity, excerpt: match[0].trim() });
    }
  }

  return {
    ok: !violations.some((v) => v.severity === "block"),
    violations,
  };
}

/** Convenience for callers that only care whether output can be persisted. */
export function hasBlockingViolation(violations: EthicsViolation[]): boolean {
  return violations.some((v) => v.severity === "block");
}
