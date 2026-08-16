import { describe, expect, it, vi } from "vitest";

import { checkEthics, ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import {
  buildRegenerationFeedback,
  EthicsComplianceError,
  generateWithEthicsGuard,
} from "@/lib/ethics/enforce";

/**
 * This file is the contract for the ethics layer.
 *
 * If a legitimate psychoeducation string is caught here, add it to the
 * COMPLIANT table as an explicit allow-case and narrow the pattern. Never
 * weaken a pattern without a test row that pins the new behavior.
 */

type ViolatingCase = {
  name: string;
  text: string;
  severity: "block" | "warn";
};

const VIOLATING: ViolatingCase[] = [
  // Outcome promises
  {
    name: "heals a named condition",
    text: "A proven approach that will heal your anxiety for good.",
    severity: "block",
  },
  {
    name: "cures a named condition",
    text: "We cure depression using a structured 8-step method.",
    severity: "block",
  },
  {
    name: "eliminates a named condition",
    text: "Therapy designed to eliminate panic attacks.",
    severity: "block",
  },
  {
    name: "resolves trauma",
    text: "EMDR intensives that resolve trauma at the root.",
    severity: "block",
  },
  {
    name: "timeframe promise",
    text: "Most people see real results in 12 weeks.",
    severity: "block",
  },
  {
    name: "relief within a timeframe",
    text: "Meaningful relief in as little as 6 sessions.",
    severity: "block",
  },
  {
    name: "guarantee",
    text: "I guarantee you will feel more like yourself.",
    severity: "block",
  },
  {
    name: "guaranteed adjective",
    text: "Guaranteed progress or your money back.",
    severity: "block",
  },
  {
    name: "clinically proven",
    text: "A clinically proven protocol for couples in crisis.",
    severity: "block",
  },
  {
    name: "proven to",
    text: "This method is proven to work for high achievers.",
    severity: "block",
  },
  {
    name: "success rate as percentage",
    text: "94% of my clients report feeling steadier.",
    severity: "block",
  },
  {
    name: "success rate as ratio",
    text: "9 out of 10 clients finish the program.",
    severity: "block",
  },
  {
    name: "lasting relief",
    text: "Deep, lasting relief from the patterns you keep repeating.",
    severity: "block",
  },
  {
    name: "permanent change",
    text: "Permanent change, not a temporary fix.",
    severity: "block",
  },
  {
    name: "free you from",
    text: "Let me free you from the weight you have been carrying.",
    severity: "block",
  },
  {
    name: "treatment that works",
    text: "Finally, a treatment that works.",
    severity: "block",
  },

  // Testimonials
  {
    name: "paraphrased client praise",
    text: "My clients say they finally feel heard.",
    severity: "block",
  },
  {
    name: "clients report",
    text: "My clients report sleeping better within a month.",
    severity: "block",
  },
  {
    name: "names the testimonial format",
    text: "Read testimonials from people I have worked with.",
    severity: "block",
  },
  {
    name: "client reviews",
    text: "See our client reviews before booking.",
    severity: "block",
  },
  {
    name: "star rating language",
    text: "Rated 5 out of 5 stars by the people I work with.",
    severity: "block",
  },
  {
    name: "star glyphs",
    text: "★★★★★ — a wonderful experience.",
    severity: "block",
  },
  {
    name: "success stories",
    text: "Browse success stories from past clients.",
    severity: "block",
  },

  // Superlatives and recognition
  {
    name: "best therapist",
    text: "The best therapist in Austin for couples work.",
    severity: "block",
  },
  {
    name: "number one practice",
    text: "The #1 practice for trauma-informed care.",
    severity: "block",
  },
  {
    name: "top-rated clinician",
    text: "A top-rated clinician serving the Bay Area.",
    severity: "block",
  },
  {
    name: "award-winning claim",
    text: "An award-winning practice you can trust.",
    severity: "warn",
  },

  // Diagnostic
  {
    name: "diagnoses the reader",
    text: "If you cannot sleep, you have anxiety and you need help now.",
    severity: "block",
  },

  // Urgency and scarcity
  {
    name: "scarcity",
    text: "Only 2 spots left for the fall cohort.",
    severity: "block",
  },
  {
    name: "urgency",
    text: "Act now — rates increase in January.",
    severity: "block",
  },
];

/**
 * Real psychoeducation copy in the voice the product aims for. Every one of
 * these must pass cleanly — a false positive here is a product defect.
 */
const COMPLIANT: { name: string; text: string }[] = [
  {
    name: "reframes anxiety without promising an outcome",
    text: "Together we look at what your anxiety has been protecting you from, and what it costs to keep it working that hard.",
  },
  {
    name: "describes the modality without claiming results",
    text: "I work primarily with EMDR, an evidence-based approach for processing memories that still feel present in the body.",
  },
  {
    name: "describes a first session",
    text: "A first session is mostly listening. You tell me what brought you here, and we decide together whether we are a good fit.",
  },
  {
    name: "states credentials exactly",
    text: "Licensed Professional Counselor (LPC #12345) in the State of Texas, with post-graduate training in Internal Family Systems.",
  },
  {
    name: "names who the practice serves without diagnosing",
    text: "I work with first-generation professionals who look successful from the outside and feel like an imposter on the inside.",
  },
  {
    name: "couples work described as process",
    text: "Couples intensives give you two uninterrupted days to slow down the argument you keep having and hear what is underneath it.",
  },
  {
    name: "fees page copy",
    text: "Sessions are $180 for 50 minutes. I hold a small number of reduced-fee spaces and I am happy to talk about what is workable.",
  },
  {
    name: "proof without testimonials",
    text: "Proof of my work lives in my training and my professional affiliations: EMDRIA-certified, member of the American Counseling Association.",
  },
  {
    name: "grief copy that avoids resolution language",
    text: "Grief does not move in stages on a schedule. We make room for it to be what it is, at the pace it actually moves.",
  },
  {
    name: "trauma copy in psychoeducational register",
    text: "Trauma is not only what happened. It is what your nervous system learned to do afterward, and that learning can be looked at.",
  },
  {
    name: "clear call to action without urgency",
    text: "If this sounds like the kind of work you are looking for, you can book a free 15-minute consultation.",
  },
  {
    name: "describes specialty focus plainly",
    text: "My practice focuses on anxiety, burnout, and identity questions for people in their late twenties and thirties.",
  },
  {
    name: "the word review used non-testimonially",
    text: "We review your goals together every few months to see whether the work is still pointed at the right thing.",
  },
  {
    name: "the word best used non-comparatively",
    text: "We will find the approach that works best for you, and change it when it stops fitting.",
  },
  {
    name: "mentions a condition alongside a neutral verb",
    text: "Many people come in carrying anxiety they have never named out loud.",
  },
];

describe("checkEthics — violating strings", () => {
  it.each(VIOLATING)("catches: $name", ({ text, severity }) => {
    const result = checkEthics(text);

    expect(
      result.violations.length,
      `expected a violation for: ${text}`
    ).toBeGreaterThan(0);

    expect(
      result.violations.some((v) => v.severity === severity),
      `expected a "${severity}" violation for: ${text}`
    ).toBe(true);

    // `block` violations must fail the check; `warn` must not.
    expect(result.ok).toBe(severity !== "block");
  });

  it("returns the offending excerpt so retries can quote it", () => {
    const result = checkEthics("I guarantee you will feel better.");
    expect(result.violations[0].excerpt.toLowerCase()).toContain("guarantee");
  });
});

describe("checkEthics — compliant psychoeducation", () => {
  it.each(COMPLIANT)("passes: $name", ({ text }) => {
    const result = checkEthics(text);
    expect(
      result.violations,
      `unexpected violation for compliant copy: ${text}`
    ).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("treats empty input as compliant", () => {
    expect(checkEthics("")).toEqual({ ok: true, violations: [] });
  });
});

describe("ETHICS_SYSTEM_RULES", () => {
  it("states the rules the patterns enforce, so prompt and code agree", () => {
    expect(ETHICS_SYSTEM_RULES).toMatch(/psychoeducation/i);
    expect(ETHICS_SYSTEM_RULES).toMatch(/testimonial/i);
    expect(ETHICS_SYSTEM_RULES).toMatch(/guarantee/i);
    expect(ETHICS_SYSTEM_RULES).toMatch(/license/i);
  });
});

describe("buildRegenerationFeedback", () => {
  it("quotes the offending excerpt and its reason", () => {
    const { violations } = checkEthics("I guarantee lasting relief.");
    const feedback = buildRegenerationFeedback(violations);

    expect(feedback).toMatch(/REJECTED/);
    expect(feedback.toLowerCase()).toContain("guarantee");
    expect(feedback).toMatch(/psychoeducation/i);
  });

  it("is empty when there is nothing to correct", () => {
    expect(buildRegenerationFeedback([])).toBe("");
  });

  it("reports only blocking violations when both kinds are present", () => {
    const feedback = buildRegenerationFeedback([
      { severity: "warn", reason: "warn reason", excerpt: "award-winning" },
      { severity: "block", reason: "block reason", excerpt: "guarantee" },
    ]);

    expect(feedback).toContain("guarantee");
    expect(feedback).not.toContain("award-winning");
  });
});

describe("generateWithEthicsGuard", () => {
  const publishableStrings = (raw: { copy: string }) => [raw.copy];
  const noopValidate = () => {};

  it("returns the first draft when it is compliant", async () => {
    const callModel = vi.fn(async () => ({
      copy: "A first session is mostly listening.",
    }));

    const result = await generateWithEthicsGuard({
      callModel,
      validate: noopValidate,
      publishableStrings,
      label: "test",
    });

    expect(result.copy).toBe("A first session is mostly listening.");
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith("");
  });

  it("regenerates with feedback after a blocking violation", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<{ copy: string }>>()
      .mockResolvedValueOnce({ copy: "I guarantee lasting relief." })
      .mockResolvedValueOnce({
        copy: "We look at what the anxiety is protecting.",
      });

    const result = await generateWithEthicsGuard({
      callModel,
      validate: noopValidate,
      publishableStrings,
      label: "test",
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[0][0]).toBe("");
    expect(callModel.mock.calls[1][0]).toMatch(/REJECTED/);
    expect(result.copy).toBe("We look at what the anxiety is protecting.");
  });

  it("throws EthicsComplianceError instead of returning blocked copy", async () => {
    const callModel = vi.fn(async () => ({
      copy: "I guarantee results in 12 weeks.",
    }));

    await expect(
      generateWithEthicsGuard({
        callModel,
        validate: noopValidate,
        publishableStrings,
        label: "test",
        maxRetries: 2,
      })
    ).rejects.toBeInstanceOf(EthicsComplianceError);

    // 1 initial attempt + 2 retries.
    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it("carries the violations on the thrown error for server-side logging", async () => {
    const callModel = vi.fn(async () => ({ copy: "Guaranteed results." }));

    const error = await generateWithEthicsGuard({
      callModel,
      validate: noopValidate,
      publishableStrings,
      label: "test",
      maxRetries: 0,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EthicsComplianceError);
    const complianceError = error as EthicsComplianceError;
    expect(complianceError.attempts).toBe(1);
    expect(complianceError.violations.length).toBeGreaterThan(0);
  });

  it("does not retry on a warn-only violation", async () => {
    const callModel = vi.fn(async () => ({
      copy: "An award-winning practice.",
    }));

    const result = await generateWithEthicsGuard({
      callModel,
      validate: noopValidate,
      publishableStrings,
      label: "test",
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.copy).toBe("An award-winning practice.");
  });

  it("surfaces structural failures as the caller's error, not an ethics error", async () => {
    const callModel = vi.fn(async () => ({ copy: "fine" }));
    const validate = () => {
      throw new Error("expected exactly 3 directions");
    };

    await expect(
      generateWithEthicsGuard({
        callModel,
        validate,
        publishableStrings,
        label: "test",
      })
    ).rejects.toThrow(/exactly 3 directions/);

    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("checks every publishable string, not just the first", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<{ a: string; b: string }>>()
      .mockResolvedValueOnce({
        a: "A first session is mostly listening.",
        b: "Guaranteed relief in 6 weeks.",
      })
      .mockResolvedValueOnce({
        a: "A first session is mostly listening.",
        b: "We go at the pace the work actually moves.",
      });

    const result = await generateWithEthicsGuard({
      callModel,
      validate: noopValidate,
      publishableStrings: (raw) => [raw.a, raw.b],
      label: "test",
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.b).toBe("We go at the pace the work actually moves.");
  });
});
