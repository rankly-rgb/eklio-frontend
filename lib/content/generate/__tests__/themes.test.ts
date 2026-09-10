import { describe, expect, it } from "vitest";
import {
  checkThemes,
  deriveThemes,
  parseThemeLines,
  suppliedThemes,
  themesPrompt,
  ThemeDerivationError,
  THEME_MAX_CHARS,
} from "../themes";
import { stubContentModel, STUB_BAD_THEMES } from "../stub-model";
import { CONTENT_ARCHETYPES, CONTENT_REGISTERS, type ContentCheckin } from "@/lib/data/content";

/*
 * ── THE THEMES ARE DERIVED, AND THAT IS THE PRODUCT ─────────────────────
 *
 * In production a therapist never types three themes. If she has to, the
 * sixty-second promise is gone and the monthly check-in exists for nothing.
 * These tests are about the derivation being the DEFAULT, about what it
 * refuses, and about a hand-supplied set never being mistakable for a derived
 * one.
 */

function checkin(overrides: Partial<ContentCheckin> = {}): ContentCheckin {
  return {
    brand_kit_id: "kit-1",
    month: "2026-10-01",
    sessions_theme: "Burnout, mostly. A lot of people going back to work.",
    taking_clients: "waitlist",
    happening: null,
    ...overrides,
  };
}

describe("what a theme may be", () => {
  it("accepts three different subjects", () => {
    expect(
      checkThemes(["Going back to a routine", "Rest that is not a reward", "Asking for help"])
    ).toBeNull();
  });

  it("refuses anything but exactly three", () => {
    expect(checkThemes(["one", "two"])?.reason).toMatch(/exactly three/);
    expect(checkThemes(["one", "two", "three", "four"])?.reason).toMatch(/exactly three/);
  });

  it("refuses two that are the same, however they are cased", () => {
    expect(checkThemes(["Rest", "asking for help", "rest"])?.reason).toMatch(/the same/);
  });

  it("⚠ refuses a post SHAPE returned as a subject", () => {
    // The mistake a real model actually makes: asked for "themes" right after
    // being handed the register vocabulary, it hands the vocabulary back. The
    // failure is invisible downstream — a month whose three themes are three
    // layouts reads as three photographs of nothing.
    for (const reserved of [...CONTENT_REGISTERS, ...CONTENT_ARCHETYPES]) {
      const rejection = checkThemes([reserved, "rest", "asking for help"]);
      expect(rejection?.reason, `"${reserved}" was accepted as a theme`).toMatch(
        /post shape, not a subject/
      );
    }
    // And with the underscores spelled out, which is how a model writes it.
    expect(checkThemes(["reflective question", "rest", "help"])?.reason).toMatch(
      /post shape/
    );
  });

  it("refuses one too long for the column", () => {
    const long = "a".repeat(THEME_MAX_CHARS + 1);
    expect(checkThemes([long, "rest", "help"])?.reason).toMatch(/must fit in 80/);
  });

  it("⚠ scans them, because a theme steers twelve captions and three photographs", () => {
    // Not published text, which is exactly why it is easy to forget. A theme
    // that promises an outcome produces twelve posts the guard then has to
    // catch one at a time, and some of them it will not.
    const rejection = checkThemes(["Heal your anxiety for good", "rest", "asking for help"]);
    expect(rejection?.reason).toMatch(/advertising-ethics rule/);
  });
});

describe("parsing what a model returns", () => {
  it("survives numbering, bullets, quotes and trailing punctuation", () => {
    expect(
      parseThemeLines(
        '1. Going back to a routine\n- "Rest that is not a reward"\n• Asking for help.\n'
      )
    ).toEqual(["Going back to a routine", "Rest that is not a reward", "Asking for help"]);
  });
});

describe("deriving from her own sentence", () => {
  it("uses the check-in, and keeps the sentence verbatim beside the themes", async () => {
    const answer = checkin();
    const derived = await deriveThemes(stubContentModel(), {
      month: "2026-10",
      checkin: answer,
      briefContext: "A fixture practice.",
      offLimits: null,
    });

    expect(derived.source).toBe("derived_check_in");
    // ⚠ VERBATIM. Reviewing a month means asking whether these three follow
    //   from what she actually said; a paraphrase cannot answer that.
    expect(derived.sourceText).toBe(answer.sessions_theme);
    expect(derived.themes).toHaveLength(3);
    expect(checkThemes([...derived.themes])).toBeNull();
  });

  it("⚠ still produces a month when she did not answer", async () => {
    // The check-in card promises this on her calendar: "leave it blank and we
    // write from your brief". This is the code that keeps it.
    for (const empty of [null, checkin({ sessions_theme: null }), checkin({ sessions_theme: "   " })]) {
      const derived = await deriveThemes(stubContentModel(), {
        month: "2026-10",
        checkin: empty,
        briefContext: "A fixture practice.",
        offLimits: null,
      });
      expect(derived.source).toBe("derived_brief");
      expect(derived.sourceText).toBeNull();
      expect(derived.themes).toHaveLength(3);
    }
  });

  it("rejects a bad set, says why, and takes the retry", async () => {
    const calls: string[] = [];
    const model = stubContentModel({ badThemesFirst: true, calls });

    const derived = await deriveThemes(model, {
      month: "2026-10",
      checkin: checkin(),
      briefContext: "A fixture practice.",
      offLimits: null,
    });

    // Two calls: the shapes, then the subjects.
    expect(calls.filter((call) => call.startsWith("themes"))).toHaveLength(2);
    expect(derived.themes.some((theme) => STUB_BAD_THEMES.includes(theme))).toBe(false);
  });

  it("⚠ fails the month rather than inventing three", async () => {
    // Three invented themes would be published under her name, in her voice,
    // about people she treats — and would be indistinguishable from derived
    // ones in the row. A failed month is recoverable; a plausible wrong one is
    // not.
    const stubborn = { ...stubContentModel(), async writeThemes() { return STUB_BAD_THEMES; } };
    await expect(
      deriveThemes(stubborn, {
        month: "2026-10",
        checkin: checkin(),
        briefContext: "A fixture practice.",
        offLimits: null,
      })
    ).rejects.toBeInstanceOf(ThemeDerivationError);
  });
});

describe("the override", () => {
  it("is validated exactly as hard as a derived set", () => {
    expect(() => suppliedThemes(["statement", "rest", "help"])).toThrow(ThemeDerivationError);
    expect(() => suppliedThemes(["one", "two"])).toThrow(ThemeDerivationError);
  });

  it("⚠ is stamped `supplied` and carries no source sentence", () => {
    // The whole reason the column exists: a hand-typed run must never be
    // readable, later, as evidence that the derivation works.
    const supplied = suppliedThemes(["Rest", "Going back", "Asking for help"]);
    expect(supplied.source).toBe("supplied");
    expect(supplied.sourceText).toBeNull();
  });
});

describe("the prompt", () => {
  it("quotes her sentence and forbids the shapes by name", () => {
    const prompt = themesPrompt({
      month: "2026-10",
      sessionsTheme: "Burnout, mostly.",
      briefContext: "A fixture practice.",
      offLimits: "No politics.",
      retryBecause: undefined,
    });

    expect(prompt).toContain("October 2026");
    expect(prompt).toContain('"Burnout, mostly."');
    expect(prompt).toContain("No politics.");
    expect(prompt).toMatch(/NOT a kind of post/);
  });

  it("does not pretend to know her caseload when she did not answer", () => {
    const prompt = themesPrompt({
      month: "2026-10",
      sessionsTheme: null,
      briefContext: "A fixture practice.",
      offLimits: null,
    });
    expect(prompt).toMatch(/DID NOT ANSWER/);
    // ⚠ A theme invented about her clients would be a claim about clients
    //   nobody made — the exact thing every register's safety rule forbids.
    expect(prompt).toMatch(/Do not invent anything about her caseload/);
  });
});
