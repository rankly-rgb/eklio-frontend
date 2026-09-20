import { describe, expect, it } from "vitest";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { BUDGET, BudgetExceededError, budgetErrors, words } from "@/lib/compose/budget";
import { render } from "@/lib/compose/engine";
import { CARD, LENGTHS, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";

/*
 * ── THE WORD BUDGET SUITE ───────────────────────────────────────────────
 *
 * ⚠ REJECTED BEFORE RENDER, NOT TRUNCATED DURING IT. A card that quietly cut a
 * therapist's sentence to make it fit would publish something she did not say,
 * under her name, on her feed. The pipeline's answer to a rejection is to
 * regenerate the copy; there is no answer that involves editing it here.
 */

describe("every fixture is inside its budget", () => {
  for (const archetype of ARCHETYPE_KEYS) {
    for (const length of LENGTHS) {
      it(`${archetype} · ${length}`, () => {
        expect(budgetErrors(archetype, payloadFor(archetype, length))).toEqual([]);
      });
    }
  }
});

describe("one word over, and it is refused", () => {
  /*
   * ⚠ ONE WORD, NOT "TOO MANY". A bound that only rejects the obviously
   * oversized is a bound nobody can rely on: the generator is told three words
   * and writes four, and four is exactly what has to fail.
   */
  const CASES: Array<[string, unknown, string]> = [
    ["quadrant_model", { axis_x: "A b", axis_y: "C d", items: Array.from({ length: 4 }, () => ({ label: "one two three four", gloss: "a b" })) }, "items[0].label"],
    ["cycle", { nodes: Array.from({ length: 3 }, () => ({ label: "A b", gloss: "one two three four five six seven" })) }, "nodes[0].gloss"],
    ["single_statement", { statement: "One two" }, "statement"],
    ["practitioner_card", { lines: ["one two three four five six seven eight nine", "b c"] }, "lines[0]"],
  ];

  for (const [archetype, payload, path] of CASES) {
    it(`${archetype}: ${path}`, () => {
      const errors = budgetErrors(archetype, payload);
      expect(errors.map((e) => e.path)).toContain(path);
    });
  }

  it("render throws BudgetExceededError, and names every offending path", () => {
    const payload = {
      axis_x: "A b",
      axis_y: "C d",
      items: Array.from({ length: 4 }, () => ({ label: "one two three four", gloss: "a b" })),
    };
    try {
      render({ ...CARD, archetype: "quadrant_model", palette: PALETTES[0], payload });
      throw new Error("render did not throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetExceededError);
      // ⚠ EVERY path, not the first. A generator handed one error at a time
      // makes one fix at a time, and each round trip costs a paid call.
      expect((e as BudgetExceededError).errors).toHaveLength(4);
    }
  });

  it("a carousel reports the card its error is on", () => {
    const errors = budgetErrors("carousel", {
      cards: [
        { archetype_key: "single_statement", payload: { statement: "One two three four five" } },
        { archetype_key: "single_statement", payload: { statement: "Too short" } },
        { archetype_key: "single_statement", payload: { statement: "One two three four five" } },
      ],
    });
    expect(errors.map((e) => e.path)).toEqual(["cards[1].statement"]);
  });

  it("an unknown archetype is an error, never an empty pass", () => {
    expect(budgetErrors("not_an_archetype", { statement: "a b c" })).toHaveLength(1);
  });
});

describe("the bounds match the ones the database enforces", () => {
  /*
   * The SQL side is `content_topic_payload_valid`
   * (backend 20260920150000). These numbers exist twice and must agree: if
   * they drift, the renderer accepts what the database refuses, and a month
   * generates fine and then fails to save.
   */
  it("label 1–3 words, gloss at most 6", () => {
    expect(BUDGET.label).toEqual({ min: 1, max: 3 });
    expect(BUDGET.gloss).toEqual({ min: 1, max: 6 });
  });
  it("a statement is 3–24 words", () => {
    expect(BUDGET.statement).toEqual({ min: 3, max: 24 });
  });
  it("a practitioner line is at most 8 words", () => {
    expect(BUDGET.practitionerLine.max).toBe(8);
  });
});

describe("words()", () => {
  it("folds runs of whitespace and ignores the edges", () => {
    expect(words("  three   little words ")).toBe(3);
    expect(words("")).toBe(0);
    expect(words("   ")).toBe(0);
  });
});
