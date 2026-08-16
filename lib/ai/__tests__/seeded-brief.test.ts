import { describe, expect, it, vi } from "vitest";

import { buildBriefContext } from "@/lib/ai/brief-context";
import {
  buildDirectionsPrompt,
  validateDirections,
  type DirectionsPayload,
} from "@/lib/ai/directions";
import {
  buildKitPrompt,
  kitPublishableStrings,
  validateKit,
  type KitContent,
} from "@/lib/ai/kit";
import { checkEthics } from "@/lib/ethics/rules";
import {
  EthicsComplianceError,
  generateWithEthicsGuard,
} from "@/lib/ethics/enforce";
import { isBriefComplete, type BriefAnswers } from "@/lib/brief/steps";

/**
 * End-to-end check over a seeded therapist brief.
 *
 * The model itself is stubbed — this pins the parts we control: that a complete
 * brief flows through prompt assembly, that a compliant generation survives,
 * and that a deliberately provocative brief cannot produce something that gets
 * persisted.
 */

/** A complete, realistic brief. Every required field is answered. */
const SEEDED_BRIEF: BriefAnswers = {
  practice: {
    practiceName: "Northline Therapy",
    licenseType: "lpc",
    specialties: ["anxiety", "identity_lgbtq"],
    offering: "Individual therapy, weekly, in person and by video.",
    stage: "premiumizing",
  },
  positioning: {
    problem:
      "People who hold everything together in public and come apart at home.",
    clientGain: "More room to notice what they are doing before they do it.",
    alternatives: "Scrolling a directory for weeks and never sending a message.",
    differentiator: "I spent twelve years in restaurant kitchens before I retrained.",
  },
  ideal_client: {
    idealClient: "First-generation professionals carrying success guilt.",
    decisionContext: "long_considered",
    hesitations: ["cost", "will_they_get_me"],
  },
  voice: {
    toneSliders: {
      reservedExpressive: 30,
      warmClinical: 25,
      classicContemporary: 60,
      minimalRich: 40,
    },
    feelings: ["steadiness", "warmth", "clarity"],
    avoid: "No lotus flowers, no talk of journeys.",
  },
  palette: {
    colorFamilies: ["earth_ochre", "warm_neutrals"],
    contrast: "balanced",
    colorsToAvoid: "Hospital teal.",
    admiredWorlds: "Aesop stores, my grandmother's reading room.",
  },
  typography: { typeStyle: ["editorial_serif"], characterLevel: "confident" },
  website: {
    siteGoal: "book_consultations",
    primaryAction: "Book a consultation",
    pages: ["home", "about", "approach", "fees"],
    proof: ["credentials", "training"],
    constraints: "Has to run on Squarespace.",
  },
};

/**
 * The same practice, but the practitioner wrote a promise into their own brief.
 * This is the realistic failure mode: the user, not the model, introduces it.
 */
const PROVOCATIVE_BRIEF: BriefAnswers = {
  ...SEEDED_BRIEF,
  positioning: {
    ...SEEDED_BRIEF.positioning,
    clientGain: "Guaranteed anxiety relief in 8 weeks.",
  },
};

describe("the seeded brief", () => {
  it("is complete, so it can reach generation at all", () => {
    expect(isBriefComplete(SEEDED_BRIEF)).toBe(true);
  });

  it("renders into prompt context with no untranslated option values", () => {
    const { text } = buildBriefContext(SEEDED_BRIEF);
    expect(text).toContain("LPC (counselor)");
    expect(text).toContain("Identity / LGBTQ+");
    expect(text).not.toMatch(/identity_lgbtq|book_consultations|earth_ochre/);
  });

  it("carries the ethics rules into both prompts", () => {
    const directionsPrompt = buildDirectionsPrompt(SEEDED_BRIEF);
    const kitPrompt = buildKitPrompt({
      answers: SEEDED_BRIEF,
      direction: DIRECTION,
      scope: { pages: ["home", "about", "approach", "fees"], includeSocialTemplates: true },
    });

    for (const prompt of [directionsPrompt, kitPrompt]) {
      expect(prompt).toContain("ADVERTISING ETHICS — NON-NEGOTIABLE");
      expect(prompt).toMatch(/no client testimonials/i);
    }
  });
});

describe("a provocative brief", () => {
  it("is itself caught by the ethics patterns", () => {
    const result = checkEthics(
      String(PROVOCATIVE_BRIEF.positioning?.clientGain)
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.severity === "block")).toBe(true);
  });

  it("still produces a prompt that forbids what the brief asked for", () => {
    // The brief's own words reach the model, so the rules have to outrank them.
    const prompt = buildDirectionsPrompt(PROVOCATIVE_BRIEF);
    expect(prompt).toContain("Guaranteed anxiety relief in 8 weeks");
    expect(prompt).toMatch(/No outcome claims, guarantees, or success-rate/i);
  });

  it("never persists directions when the model echoes the promise", async () => {
    const echoing: DirectionsPayload = {
      directions: [1, 2, 3].map((n) => ({
        name: `Direction ${n}`,
        description: "Guaranteed anxiety relief in 8 weeks, in a calmer register.",
        palette: {
          primary: "#2B4162",
          secondary: "#6E8B6A",
          accent: "#C08A4A",
          light_neutral: "#F1EBDF",
          dark_neutral: "#131313",
        },
        typography: { headings: "Fraunces", body: "Inter" },
      })),
    };

    const callModel = vi.fn(async () => echoing);

    await expect(
      generateWithEthicsGuard<DirectionsPayload>({
        label: "seeded-directions",
        callModel,
        validate: validateDirections,
        publishableStrings: (p) => p.directions.map((d) => d.description),
      })
    ).rejects.toBeInstanceOf(EthicsComplianceError);

    // Three attempts made, nothing returned to the caller to save.
    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it("recovers when the model corrects itself on retry", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<KitContent>>()
      .mockResolvedValueOnce(
        KIT({
          website_copy: [
            pageOf("home", "Guaranteed anxiety relief in 8 weeks."),
            pageOf("about", "I retrained after twelve years in kitchens."),
            pageOf("approach", "We start with what is happening now."),
            pageOf("fees", "Sessions are $180 for 50 minutes."),
          ],
        })
      )
      .mockResolvedValueOnce(KIT());

    const result = await generateWithEthicsGuard<KitContent>({
      label: "seeded-kit",
      callModel,
      validate: (raw) => validateKit(raw, PAGES),
      publishableStrings: kitPublishableStrings,
    });

    expect(callModel).toHaveBeenCalledTimes(2);

    // The returned kit is clean on every publishable string, not just the one
    // that failed the first time.
    for (const text of kitPublishableStrings(result)) {
      expect(checkEthics(text).ok, `violating string survived: ${text}`).toBe(true);
    }
  });
});

describe("a compliant generation survives untouched", () => {
  it("returns the first draft and keeps credentials phrasing intact", async () => {
    const callModel = vi.fn(async () => KIT());

    const result = await generateWithEthicsGuard<KitContent>({
      label: "seeded-kit-clean",
      callModel,
      validate: (raw) => validateKit(raw, PAGES),
      publishableStrings: kitPublishableStrings,
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(
      result.website_copy.find((p) => p.page === "about")?.sections[0].body
    ).toContain("LPC #");
  });

  it("contains no testimonial anywhere in the deliverable", () => {
    for (const text of kitPublishableStrings(KIT())) {
      const { violations } = checkEthics(text);
      expect(violations.filter((v) => v.reason.includes("testimonial"))).toEqual(
        []
      );
    }
  });
});

// --- fixtures --------------------------------------------------------------

const PAGES = ["home", "about", "approach", "fees"];

const DIRECTION = {
  name: "Northline",
  description: "A warm, unfussy register for people used to holding it together.",
  palette: {
    primary: "#2B4162",
    secondary: "#6E8B6A",
    accent: "#C08A4A",
    light_neutral: "#F1EBDF",
    dark_neutral: "#131313",
  },
  typography: { headings: "Fraunces", body: "Inter" },
};

function pageOf(name: string, body: string) {
  return { page: name, sections: [{ heading: "A heading", body }] };
}

function KIT(overrides: Partial<KitContent> = {}): KitContent {
  return {
    positioning_statement:
      "Therapy for people who hold it together in public and come apart at home.",
    brand_story:
      "I spent twelve years in restaurant kitchens before I retrained.\n\nThe work here is slower than that, on purpose.",
    voice_and_tone: {
      adjectives: ["steady", "warm", "plain"],
      do_examples: ["A first session is mostly listening."],
      dont_examples: ["Begin your healing journey today."],
    },
    website_copy: [
      pageOf("home", "A place to slow down and look at what keeps repeating."),
      pageOf(
        "about",
        "Licensed Professional Counselor, LPC #48210, in the State of Oregon."
      ),
      pageOf("approach", "We start with what is happening now."),
      pageOf("fees", "Sessions are $180 for 50 minutes."),
    ],
    social_templates: [],
    export_prompt: "Build a four-page site using #2B4162 as the primary color.",
    ...overrides,
  };
}
