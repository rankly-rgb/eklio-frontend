import { describe, expect, it } from "vitest";

import {
  DirectionsGenerationError,
  buildDirectionsPrompt,
  validateDirections,
} from "@/lib/ai/directions";
import type { BriefAnswers } from "@/lib/brief/steps";

/**
 * The structural gate is what stands between a malformed generation and the
 * database, so every rejection path is pinned here.
 */

function direction(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function payload(count: number) {
  return { directions: Array.from({ length: count }, () => direction()) };
}

describe("validateDirections", () => {
  it("accepts a well-formed set of three", () => {
    expect(() => validateDirections(payload(3))).not.toThrow();
  });

  it.each([0, 1, 2, 4, 5])("rejects %i directions", (count) => {
    expect(() => validateDirections(payload(count))).toThrow(
      DirectionsGenerationError
    );
  });

  it("rejects a non-object payload", () => {
    expect(() => validateDirections(null)).toThrow(DirectionsGenerationError);
    expect(() => validateDirections("three directions")).toThrow(
      DirectionsGenerationError
    );
  });

  it("rejects a payload whose directions is not an array", () => {
    expect(() => validateDirections({ directions: {} })).toThrow(
      /did not return a list/
    );
  });

  it("rejects a missing name", () => {
    const bad = { directions: [direction({ name: "  " }), direction(), direction()] };
    expect(() => validateDirections(bad)).toThrow(/has no name/);
  });

  it("rejects a missing description", () => {
    const bad = {
      directions: [direction(), direction({ description: "" }), direction()],
    };
    expect(() => validateDirections(bad)).toThrow(/has no description/);
  });

  it.each([
    ["not-a-color", "plain word"],
    ["#FFF", "shorthand hex"],
    ["#12345", "five digits"],
    ["#1234567", "seven digits"],
    ["rgb(0,0,0)", "rgb notation"],
  ])("rejects %s as a hex color (%s)", (value) => {
    const bad = {
      directions: [
        direction(),
        direction(),
        direction({
          palette: { ...direction().palette, accent: value },
        }),
      ],
    };
    expect(() => validateDirections(bad)).toThrow(/invalid accent color/);
  });

  it("accepts lowercase and uppercase hex alike", () => {
    const ok = {
      directions: [
        direction({ palette: { ...direction().palette, primary: "#aabbcc" } }),
        direction({ palette: { ...direction().palette, primary: "#AABBCC" } }),
        direction(),
      ],
    };
    expect(() => validateDirections(ok)).not.toThrow();
  });

  it("rejects a palette missing a named slot", () => {
    const { light_neutral: _dropped, ...partial } = direction().palette;
    const bad = {
      directions: [direction({ palette: partial }), direction(), direction()],
    };
    expect(() => validateDirections(bad)).toThrow(/invalid light_neutral color/);
  });

  it("rejects a missing typeface name", () => {
    const bad = {
      directions: [
        direction(),
        direction(),
        direction({ typography: { headings: "Fraunces", body: "" } }),
      ],
    };
    expect(() => validateDirections(bad)).toThrow(/missing a typeface name/);
  });

  it("names the offending position so the error is actionable", () => {
    const bad = { directions: [direction(), direction(), direction({ name: "" })] };
    expect(() => validateDirections(bad)).toThrow(/Direction 3/);
  });
});

describe("buildDirectionsPrompt", () => {
  const answers: BriefAnswers = {
    practice: {
      practiceName: "Still Water Counseling",
      licenseType: "lmft",
      specialties: ["couples", "trauma_emdr"],
      offering: "Couples intensives, one weekend a month.",
      stage: "premiumizing",
    },
    positioning: {
      clientGain: "More room to choose how they respond to each other.",
    },
    voice: {
      toneSliders: {
        reservedExpressive: 20,
        warmClinical: 70,
        classicContemporary: 50,
        minimalRich: 80,
      },
      feelings: ["steadiness", "warmth", "clarity"],
    },
    palette: { colorFamilies: ["earth_ochre"] },
    website: { pages: ["home", "about"], primaryAction: "Book a consultation" },
  };

  it("injects the ethics rules into the prompt", () => {
    const prompt = buildDirectionsPrompt(answers);
    expect(prompt).toContain("ADVERTISING ETHICS — NON-NEGOTIABLE");
    expect(prompt).toMatch(/testimonial/i);
  });

  it("asks for exactly three differentiated directions", () => {
    const prompt = buildDirectionsPrompt(answers);
    expect(prompt).toMatch(/Three directions/);
    expect(prompt).toMatch(/clearly different personality/i);
  });

  it("uses human labels rather than stored option values", () => {
    const prompt = buildDirectionsPrompt(answers);
    expect(prompt).toContain("LMFT (marriage & family)");
    expect(prompt).toContain("Trauma & EMDR");
    expect(prompt).not.toContain("trauma_emdr");
  });

  it("renders slider positions as readable leanings, not raw numbers alone", () => {
    const prompt = buildDirectionsPrompt(answers);
    expect(prompt).toContain("clearly reserved");
    expect(prompt).toContain("clearly clinical");
    expect(prompt).toContain("balanced between classic and contemporary");
  });

  it("carries the practice's own fields through", () => {
    const prompt = buildDirectionsPrompt(answers);
    expect(prompt).toContain("Still Water Counseling");
    expect(prompt).toContain("Book a consultation");
    expect(prompt).toContain("Earth & ochre");
  });
});
