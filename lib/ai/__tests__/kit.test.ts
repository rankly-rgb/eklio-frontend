import { describe, expect, it, vi } from "vitest";

import {
  KitGenerationError,
  buildKitPrompt,
  kitPublishableStrings,
  validateKit,
  type KitContent,
} from "@/lib/ai/kit";
import {
  EthicsComplianceError,
  generateWithEthicsGuard,
} from "@/lib/ethics/enforce";
import type { BriefAnswers } from "@/lib/brief/steps";

/**
 * The About and Approach pages are where outcome promises are most likely to
 * survive into a deliverable, so that path is exercised end to end here rather
 * than assumed from the pattern tests.
 */

const DIRECTION = {
  name: "Quiet Ground",
  description: "A steady, unhurried register for people who need room to think.",
  palette: {
    primary: "#2B4162",
    secondary: "#6E8B6A",
    accent: "#C08A4A",
    light_neutral: "#F1EBDF",
    dark_neutral: "#131313",
  },
  typography: { headings: "Fraunces", body: "Inter" },
};

const ANSWERS: BriefAnswers = {
  practice: {
    practiceName: "Still Water Counseling",
    licenseType: "lcsw",
    specialties: ["anxiety", "trauma_emdr"],
    offering: "Individual therapy, weekly.",
    stage: "launching",
  },
  positioning: {
    problem: "People who function at work and fall apart at home.",
    clientGain: "More room to choose how they respond.",
  },
  website: {
    pages: ["home", "about", "approach"],
    primaryAction: "Book a consultation",
    proof: ["credentials", "training"],
  },
};

function page(name: string, body: string) {
  return { page: name, sections: [{ heading: "A heading", body }] };
}

function kit(overrides: Partial<KitContent> = {}): KitContent {
  return {
    positioning_statement:
      "Therapy for people who look fine at work and come apart at home.",
    brand_story:
      "I trained as a social worker after fifteen years in a job that looked good on paper.\n\nThe work here is slow on purpose.",
    voice_and_tone: {
      adjectives: ["steady", "plain", "warm"],
      do_examples: ["A first session is mostly listening."],
      dont_examples: ["Let's unlock your potential."],
    },
    website_copy: [
      page("home", "A place to slow down and look at what keeps repeating."),
      page("about", "I trained in clinical social work and I still take notes by hand."),
      page("approach", "We start with what is happening now, and work outward from there."),
    ],
    social_templates: [
      {
        name: "Psychoeducation card",
        purpose: "Explain one concept in plain language.",
        layout: "Full-bleed light neutral, headline in Fraunces at 42px.",
        example_caption: "Anxiety is not a character flaw. It is a nervous system doing its job too well.",
      },
    ],
    export_prompt: "Build a four-page site using #2B4162 as the primary color.",
    ...overrides,
  };
}

const PAGES = ["home", "about", "approach"];

describe("validateKit", () => {
  it("accepts a complete kit", () => {
    expect(() => validateKit(kit(), PAGES)).not.toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => validateKit(null, PAGES)).toThrow(KitGenerationError);
  });

  it.each([
    ["positioning_statement", "positioning statement"],
    ["brand_story", "brand story"],
    ["export_prompt", "export prompt"],
  ])("rejects a missing %s", (field, phrase) => {
    expect(() =>
      validateKit(kit({ [field]: "  " } as Partial<KitContent>), PAGES)
    ).toThrow(new RegExp(phrase));
  });

  it("rejects a voice guide without exactly three adjectives", () => {
    expect(() =>
      validateKit(
        kit({
          voice_and_tone: {
            adjectives: ["steady", "plain"],
            do_examples: ["ok"],
            dont_examples: ["no"],
          },
        }),
        PAGES
      )
    ).toThrow(/voice adjectives/);
  });

  it("rejects a kit that drops a requested page", () => {
    expect(() =>
      validateKit(
        kit({ website_copy: [page("home", "x"), page("about", "y")] }),
        PAGES
      )
    ).toThrow(/missing copy for the approach page/);
  });

  it("rejects a kit that invents a page nobody asked for", () => {
    expect(() =>
      validateKit(
        kit({
          website_copy: [
            page("home", "x"),
            page("about", "y"),
            page("approach", "z"),
            page("blog", "uninvited"),
          ],
        }),
        PAGES
      )
    ).toThrow(/invented a page/);
  });

  it("rejects a page with no sections", () => {
    expect(() =>
      validateKit(
        kit({
          website_copy: [
            page("home", "x"),
            page("about", "y"),
            { page: "approach", sections: [] },
          ],
        }),
        PAGES
      )
    ).toThrow(/approach page has no sections/);
  });

  it("rejects an empty section body", () => {
    expect(() =>
      validateKit(
        kit({
          website_copy: [
            page("home", "x"),
            page("about", "   "),
            page("approach", "z"),
          ],
        }),
        PAGES
      )
    ).toThrow(/about section body/);
  });

  it("rejects a social template missing its layout spec", () => {
    expect(() =>
      validateKit(
        kit({
          social_templates: [
            {
              name: "Card",
              purpose: "Explain a concept.",
              layout: "",
              example_caption: "A caption.",
            },
          ],
        }),
        PAGES
      )
    ).toThrow(/social template layout/);
  });

  it("accepts an empty social_templates array (Starter scope)", () => {
    expect(() => validateKit(kit({ social_templates: [] }), PAGES)).not.toThrow();
  });
});

describe("kitPublishableStrings", () => {
  it("includes every page's headings and bodies, not a sample", () => {
    const strings = kitPublishableStrings(kit());

    expect(strings).toContain(
      "I trained in clinical social work and I still take notes by hand."
    );
    expect(strings).toContain(
      "We start with what is happening now, and work outward from there."
    );
  });

  it("includes the voice guide's don't-examples", () => {
    // These are published alongside the copy, so a bad "bad example" is still
    // on the practitioner's site.
    expect(kitPublishableStrings(kit())).toContain("Let's unlock your potential.");
  });

  it("includes social captions and the export prompt", () => {
    const strings = kitPublishableStrings(kit());
    expect(strings.some((s) => s.startsWith("Anxiety is not a character flaw"))).toBe(
      true
    );
    expect(strings).toContain(
      "Build a four-page site using #2B4162 as the primary color."
    );
  });
});

describe("the About / Approach outcome-promise path", () => {
  const guardArgs = {
    label: "brand-kit-test",
    validate: (raw: KitContent) => validateKit(raw, PAGES),
    publishableStrings: kitPublishableStrings,
  };

  it("catches an outcome promise buried in the About page and regenerates", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<KitContent>>()
      .mockResolvedValueOnce(
        kit({
          website_copy: [
            page("home", "A place to slow down."),
            page(
              "about",
              "After fifteen years in practice, I have learned how to heal anxiety for good."
            ),
            page("approach", "We start with what is happening now."),
          ],
        })
      )
      .mockResolvedValueOnce(kit());

    const result = await generateWithEthicsGuard<KitContent>({
      ...guardArgs,
      callModel,
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0]).toMatch(/REJECTED/);
    expect(callModel.mock.calls[1][0].toLowerCase()).toContain("heal");
    expect(
      result.website_copy.find((p) => p.page === "about")?.sections[0].body
    ).not.toMatch(/heal anxiety/i);
  });

  it("catches a timeframe promise on the Approach page", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<KitContent>>()
      .mockResolvedValueOnce(
        kit({
          website_copy: [
            page("home", "A place to slow down."),
            page("about", "I take notes by hand."),
            page(
              "approach",
              "Most people see real results in 12 weeks of weekly sessions."
            ),
          ],
        })
      )
      .mockResolvedValueOnce(kit());

    const result = await generateWithEthicsGuard<KitContent>({
      ...guardArgs,
      callModel,
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.website_copy).toHaveLength(3);
  });

  it("never returns a kit whose About page keeps promising, even after retries", async () => {
    const promising = kit({
      website_copy: [
        page("home", "A place to slow down."),
        page("about", "I guarantee you will feel like yourself again."),
        page("approach", "We start with what is happening now."),
      ],
    });
    const callModel = vi.fn(async () => promising);

    await expect(
      generateWithEthicsGuard<KitContent>({ ...guardArgs, callModel })
    ).rejects.toBeInstanceOf(EthicsComplianceError);

    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it("catches a testimonial smuggled into a social caption", async () => {
    const callModel = vi
      .fn<(feedback: string) => Promise<KitContent>>()
      .mockResolvedValueOnce(
        kit({
          social_templates: [
            {
              name: "Praise card",
              purpose: "Share what people say.",
              layout: "Centered quote on the accent color.",
              example_caption: "My clients say they finally feel heard.",
            },
          ],
        })
      )
      .mockResolvedValueOnce(kit());

    await generateWithEthicsGuard<KitContent>({ ...guardArgs, callModel });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0].toLowerCase()).toContain("clients say");
  });
});

describe("buildKitPrompt", () => {
  const scope = { pages: PAGES, includeSocialTemplates: true };

  it("injects the ethics rules", () => {
    const prompt = buildKitPrompt({ answers: ANSWERS, direction: DIRECTION, scope });
    expect(prompt).toContain("ADVERTISING ETHICS — NON-NEGOTIABLE");
  });

  it("warns specifically about the About and Approach pages", () => {
    const prompt = buildKitPrompt({ answers: ANSWERS, direction: DIRECTION, scope });
    expect(prompt).toMatch(/About and Approach pages are where outcome promises/);
  });

  it("names all four target platforms in one prompt", () => {
    const prompt = buildKitPrompt({ answers: ANSWERS, direction: DIRECTION, scope });
    for (const platform of ["Squarespace", "Lovable", "Framer", "Webflow"]) {
      expect(prompt).toContain(platform);
    }
  });

  it("passes the chosen direction's exact hex values and typefaces through", () => {
    const prompt = buildKitPrompt({ answers: ANSWERS, direction: DIRECTION, scope });
    expect(prompt).toContain("#2B4162");
    expect(prompt).toContain("Fraunces");
    expect(prompt).toContain("Inter");
  });

  it("restricts copy to the scoped pages and forbids inventing others", () => {
    const prompt = buildKitPrompt({
      answers: ANSWERS,
      direction: DIRECTION,
      scope: { pages: ["home", "about"], includeSocialTemplates: true },
    });
    expect(prompt).toContain("home, about");
  });

  it("suppresses social templates when the scope excludes them", () => {
    const prompt = buildKitPrompt({
      answers: ANSWERS,
      direction: DIRECTION,
      scope: { pages: PAGES, includeSocialTemplates: false },
    });
    expect(prompt).toMatch(/empty array for social_templates/);
  });

  it("tells the model to use only the proof the practitioner actually has", () => {
    const prompt = buildKitPrompt({ answers: ANSWERS, direction: DIRECTION, scope });
    expect(prompt).toContain("Credentials, Training & certifications");
    expect(prompt).toMatch(/Never write a testimonial/);
  });
});
