import { describe, expect, it, vi } from "vitest";

import {
  MonthlyPresenceError,
  POSTS_PER_MONTH,
  STORIES_PER_MONTH,
  buildMonthlyPresencePrompt,
  presencePublishableStrings,
  validateMonthlyPresence,
  type MonthlyPresenceContent,
} from "@/lib/ai/monthly-presence";
import {
  EthicsComplianceError,
  generateWithEthicsGuard,
} from "@/lib/ethics/enforce";
import type { BriefAnswers } from "@/lib/brief/steps";

/**
 * Recurring content is the highest-volume publishable surface in the product —
 * one subscriber generates more publishable strings here each month than their
 * whole brand kit contained. These tests hold that surface to the same bar.
 */

const DIRECTION = {
  name: "Quiet Ground",
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
    licenseType: "lpc",
    specialties: ["anxiety"],
  },
  voice: { feelings: ["steadiness", "warmth", "clarity"] },
};

function post(week: number, caption: string) {
  return {
    week,
    theme: "What anxiety is doing",
    caption,
    visual_direction: "Light neutral background, headline in Fraunces at 48px.",
    call_to_action: "My consultation link is in my bio if this sounds useful.",
  };
}

function content(
  overrides: Partial<MonthlyPresenceContent> = {}
): MonthlyPresenceContent {
  return {
    editorial_calendar: [1, 2, 3, 4].map((week) => ({
      week,
      focus: `Week ${week} theme`,
      rationale: "It follows from what the practice said about its clients.",
    })),
    posts: Array.from({ length: POSTS_PER_MONTH }, (_, i) =>
      post((i % 4) + 1, "Anxiety is a nervous system doing its job too well.")
    ),
    stories: Array.from({ length: STORIES_PER_MONTH }, () => ({
      theme: "What a first session is like",
      frames: [
        "Mostly, I listen.",
        "You tell me what brought you here.",
        "We decide together whether we are a fit.",
      ],
    })),
    ...overrides,
  };
}

describe("validateMonthlyPresence", () => {
  it("accepts a complete month", () => {
    expect(() => validateMonthlyPresence(content())).not.toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => validateMonthlyPresence(null)).toThrow(MonthlyPresenceError);
  });

  it.each([0, 3, 5])("rejects %i editorial calendar entries", (count) => {
    expect(() =>
      validateMonthlyPresence(
        content({
          editorial_calendar: Array.from({ length: count }, (_, i) => ({
            week: i + 1,
            focus: "x",
            rationale: "y",
          })),
        })
      )
    ).toThrow(/editorial calendar entries/);
  });

  it.each([0, 11, 13])("rejects %i posts", (count) => {
    expect(() =>
      validateMonthlyPresence(
        content({
          posts: Array.from({ length: count }, () => post(1, "A caption.")),
        })
      )
    ).toThrow(new RegExp(`Expected ${POSTS_PER_MONTH} posts`));
  });

  it.each([0, 3, 5])("rejects %i stories", (count) => {
    expect(() =>
      validateMonthlyPresence(
        content({
          stories: Array.from({ length: count }, () => ({
            theme: "x",
            frames: ["a", "b", "c"],
          })),
        })
      )
    ).toThrow(new RegExp(`Expected ${STORIES_PER_MONTH} stories`));
  });

  it("rejects an empty caption and names the post", () => {
    const posts = content().posts;
    posts[6] = post(3, "   ");
    expect(() => validateMonthlyPresence(content({ posts }))).toThrow(
      /caption for post 7/
    );
  });

  it("rejects a story with fewer than three frames", () => {
    const stories = content().stories;
    stories[2] = { theme: "Too thin", frames: ["only one"] };
    expect(() => validateMonthlyPresence(content({ stories }))).toThrow(
      /Story 3 needs at least 3 frames/
    );
  });
});

describe("presencePublishableStrings", () => {
  it("covers every caption, closing line, theme and story frame", () => {
    const strings = presencePublishableStrings(content());

    // 4 calendar focuses + 12 posts x 3 fields + 4 stories x (1 theme + 3 frames)
    expect(strings).toHaveLength(4 + POSTS_PER_MONTH * 3 + STORIES_PER_MONTH * 4);
    expect(strings).toContain("Mostly, I listen.");
    expect(strings).toContain(
      "My consultation link is in my bio if this sounds useful."
    );
  });

  it("leaves the practitioner-only rationale out of the published set", () => {
    // Rationales explain the plan to the clinician; they are never posted.
    expect(presencePublishableStrings(content())).not.toContain(
      "It follows from what the practice said about its clients."
    );
  });
});

describe("the recurring-content ethics surface", () => {
  const guardArgs = {
    label: "monthly-presence-test",
    validate: validateMonthlyPresence,
    publishableStrings: presencePublishableStrings,
  };

  it("catches an outcome promise in a single caption out of twelve", async () => {
    const bad = content();
    bad.posts[8] = post(3, "Six weeks of this work and your anxiety is gone.");

    const callModel = vi
      .fn<(feedback: string) => Promise<MonthlyPresenceContent>>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(content());

    await generateWithEthicsGuard<MonthlyPresenceContent>({
      ...guardArgs,
      callModel,
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0]).toMatch(/REJECTED/);
  });

  it("catches a scarcity closing line", async () => {
    const bad = content();
    bad.posts[0] = {
      ...post(1, "Anxiety is a nervous system doing its job too well."),
      call_to_action: "Only 2 spots left for the fall — book now.",
    };

    const callModel = vi
      .fn<(feedback: string) => Promise<MonthlyPresenceContent>>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(content());

    await generateWithEthicsGuard<MonthlyPresenceContent>({
      ...guardArgs,
      callModel,
    });

    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("catches a testimonial hidden in a story frame", async () => {
    const bad = content();
    bad.stories[1] = {
      theme: "What people say",
      frames: [
        "My clients say they finally feel heard.",
        "That is the work.",
        "Reach out when you are ready.",
      ],
    };

    const callModel = vi
      .fn<(feedback: string) => Promise<MonthlyPresenceContent>>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(content());

    await generateWithEthicsGuard<MonthlyPresenceContent>({
      ...guardArgs,
      callModel,
    });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0].toLowerCase()).toContain("clients say");
  });

  it("never persists a month that keeps promising", async () => {
    const bad = content();
    bad.posts[3] = post(2, "I guarantee you will sleep better.");
    const callModel = vi.fn(async () => bad);

    await expect(
      generateWithEthicsGuard<MonthlyPresenceContent>({ ...guardArgs, callModel })
    ).rejects.toBeInstanceOf(EthicsComplianceError);
  });
});

describe("buildMonthlyPresencePrompt", () => {
  const args = { answers: ANSWERS, direction: DIRECTION, monthLabel: "March 2026" };

  it("injects the ethics rules", () => {
    expect(buildMonthlyPresencePrompt(args)).toContain(
      "ADVERTISING ETHICS — NON-NEGOTIABLE"
    );
  });

  it("warns that volume is where compliance slips", () => {
    expect(buildMonthlyPresencePrompt(args)).toMatch(
      /volume is where compliance\s+slips/
    );
  });

  it("asks for 12 posts and 4 stories", () => {
    const prompt = buildMonthlyPresencePrompt(args);
    expect(prompt).toContain("12 posts");
    expect(prompt).toContain("4 stories");
  });

  it("carries the brand's palette and typefaces so content matches the kit", () => {
    const prompt = buildMonthlyPresencePrompt(args);
    expect(prompt).toContain("#2B4162");
    expect(prompt).toContain("Fraunces");
    expect(prompt).toContain("Quiet Ground");
  });

  it("names the month being written", () => {
    expect(buildMonthlyPresencePrompt(args)).toContain("MARCH 2026");
  });
});
