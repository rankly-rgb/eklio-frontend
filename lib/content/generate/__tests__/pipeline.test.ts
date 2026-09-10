import { describe, expect, it } from "vitest";
import type { EthicsRule } from "@/lib/catalog/types";
import { CONTENT_REGISTERS, type ContentRegister } from "@/lib/data/content";
import { ARCHETYPE_FLOOR, checkOnImageFit, countWords, ON_IMAGE_MAX_WORDS } from "../capacity";
import {
  chooseArchetype,
  DEFAULT_ARCHETYPE,
  planMonth,
  POSTS_PER_MONTH,
  scheduleDates,
  themesNeedingGround,
  NoAcceptedRegistersError,
  ThemeCountError,
} from "../plan";
import {
  generateMonth,
  AllowanceExhaustedError,
  GenerationImpossibleError,
  type AllowancePort,
  type GenerateMonthInput,
} from "../pipeline";
import {
  stubContentModel,
  STUB_LABEL,
  STUB_REWRITTEN_LINE,
  STUB_UNETHICAL_LINE,
} from "../stub-model";
import { buildGroundPrompt } from "../ground";

/*
 * ── THE WHOLE PIPELINE, ON A STUB ───────────────────────────────────────
 *
 * Everything except the words themselves is testable now, and this is that
 * test: register choice, archetype rotation, floor enforcement, scanner
 * rejection and regeneration, alt text, the reservation and its release.
 *
 * ⚠ EVERY POST HERE IS A FIXTURE. The model is `stubContentModel`, whose
 * label is `stub:no-model-key`, and the assertions include that the label
 * reaches every post — because the one thing a stub must never do is produce
 * something indistinguishable from a real month.
 */

const THEMES = ["returning to routine", "rest", "asking for help"] as const;

const SAFETY_RULES = Object.fromEntries(
  CONTENT_REGISTERS.map((register) => [register, `Safety rule for ${register}.`])
) as Record<ContentRegister, string>;

const RULES: EthicsRule[] = [
  {
    id: "proven",
    short_label: "No promised outcomes",
    description: "Never claim what the work produces.",
    example_forbidden: "Heal your anxiety for good.",
  } as EthicsRule,
];

function ledger() {
  const events: { op: "reserve" | "settle" | "release"; cents: number }[] = [];
  const port: AllowancePort = {
    async reserve(cents) {
      events.push({ op: "reserve", cents });
      return { ok: true };
    },
    async settle(cents, succeeded) {
      events.push({ op: succeeded ? "settle" : "release", cents });
    },
  };
  return { events, port };
}

function input(overrides: Partial<GenerateMonthInput> = {}): GenerateMonthInput {
  const { port } = ledger();
  return {
    month: "2026-10",
    themes: THEMES,
    cadence: 3,
    acceptedRegisters: CONTENT_REGISTERS,
    safetyRules: SAFETY_RULES,
    takingClients: "waitlist",
    context: "A fixture brief for a fixture practice.",
    rules: RULES,
    model: stubContentModel(),
    allowance: port,
    groundCostCents: 5,
    groundPrompt: (theme) =>
      buildGroundPrompt({
        theme,
        subject: "a made bed and a folded linen throw",
        paletteLine: "The palette appears in the objects.",
        mood: "unhurried",
      }),
    drawGround: async ({ theme }) => ({
      storagePath: `fixtures/${theme.replace(/\s+/g, "-")}.webp`,
      fingerprint: `fixture-${theme.replace(/\s+/g, "-")}`,
      description: `A quiet interior standing for ${theme}.`,
      costCents: 5,
    }),
    compose: async ({ post, groundPath }) => ({
      description: groundPath
        ? `A quiet interior standing for ${post.theme}.`
        : `A plain paper ground with no photograph.`,
    }),
    now: new Date("2026-09-20T00:00:00Z"),
    ...overrides,
  };
}

/* ── 1. The decisions, which are pure ──────────────────────────────────── */

describe("the plan", () => {
  it("writes four weeks' worth, never a fifth Tuesday", () => {
    // October 2026 has five Tuesdays. Cadence 1 must still be four posts:
    // a calendar accident must not spend a fifth image's worth of allowance.
    const tuesdays = scheduleDates("2026-10", [2], 99);
    expect(tuesdays.length).toBeGreaterThanOrEqual(4);

    for (const cadence of [1, 2, 3] as const) {
      expect(planMonth({ month: "2026-10", cadence, acceptedRegisters: CONTENT_REGISTERS, themes: THEMES }))
        .toHaveLength(POSTS_PER_MONTH[cadence]);
    }
  });

  it("never repeats a layout twice in a row", () => {
    for (const cadence of [1, 2, 3] as const) {
      const posts = planMonth({
        month: "2026-10",
        cadence,
        acceptedRegisters: CONTENT_REGISTERS,
        themes: THEMES,
      });
      expect(posts.length).toBeGreaterThan(1); // anti-vacuous
      for (let i = 1; i < posts.length; i += 1) {
        expect(posts[i].archetype).not.toBe(posts[i - 1].archetype);
      }
    }
  });

  it("defaults reflective_question to the question layout, unless that repeats", () => {
    // The ruling, stated directly.
    expect(DEFAULT_ARCHETYPE.reflective_question).toBe("question");
    expect(chooseArchetype("reflective_question", null)).toBe("question");
    expect(chooseArchetype("reflective_question", "statement")).toBe("question");

    // And the no-repeat rule wins over it.
    expect(chooseArchetype("reflective_question", "question")).not.toBe("question");
  });

  it("gives every accepted register a turn, and never one she did not accept", () => {
    const accepted: ContentRegister[] = ["named_feeling", "permission"];
    const posts = planMonth({
      month: "2026-10",
      cadence: 3,
      acceptedRegisters: accepted,
      themes: THEMES,
    });
    expect(posts).toHaveLength(12);
    expect(new Set(posts.map((p) => p.register))).toEqual(new Set(accepted));
  });

  it("refuses an empty vocabulary and refuses any theme count but three", () => {
    expect(() =>
      planMonth({ month: "2026-10", cadence: 1, acceptedRegisters: [], themes: THEMES })
    ).toThrow(NoAcceptedRegistersError);

    expect(() =>
      planMonth({
        month: "2026-10",
        cadence: 1,
        acceptedRegisters: CONTENT_REGISTERS,
        themes: ["one", "two"],
      })
    ).toThrow(ThemeCountError);
  });

  it("asks for a ground only for a theme that carries a photographic post", () => {
    const posts = planMonth({
      month: "2026-10",
      cadence: 3,
      // Both default to `notes`; the no-repeat rule pushes every other one off
      // it, so this month is a mix and every theme ends up photographic.
      acceptedRegisters: ["how_the_work_works", "practical_note"],
      themes: THEMES,
    });
    expect(themesNeedingGround(posts).length).toBeGreaterThan(0);

    // A month with no photographic post at all asks for no photograph.
    const typographic = posts.map((post) => ({ ...post, photographic: false }));
    expect(themesNeedingGround(typographic)).toEqual([]);
  });
});

/* ── 2. The floor ──────────────────────────────────────────────────────── */

describe("the floor", () => {
  it("is the smallest capacity across the six typefaces, per archetype", () => {
    expect(ARCHETYPE_FLOOR).toEqual({
      statement: 144,
      question: 168,
      signature: 195,
      story: 431,
      notes: 472,
    });
  });

  it("refuses a line that overruns the box, or the word bounds", () => {
    const short = "Too few words here.";
    expect(checkOnImageFit(short, "statement")?.reason).toBe("too_few_words");

    const long = "word ".repeat(ON_IMAGE_MAX_WORDS + 1).trim();
    expect(checkOnImageFit(long, "notes")?.reason).toBe("too_many_words");

    // 150 characters fits `notes` (472) and does not fit `statement` (144).
    const line = "a".repeat(140) + " and then some more words here now";
    expect(countWords(line)).toBeGreaterThanOrEqual(6);
    expect(checkOnImageFit(line, "notes")).toBeNull();
    expect(checkOnImageFit(line, "statement")?.reason).toBe("over_floor");
  });
});

/* ── 3. The month, end to end ──────────────────────────────────────────── */

describe("generateMonth", () => {
  it("produces a full month whose every text fits its own layout", async () => {
    const month = await generateMonth(input());

    expect(month.posts).toHaveLength(12);
    for (const post of month.posts) {
      expect(checkOnImageFit(post.onImageText, post.archetype)).toBeNull();
      expect(post.caption.length).toBeGreaterThan(0);
      expect(post.caption.length).toBeLessThanOrEqual(2200);

      // ⚠ TWO TEXTS, NEVER ONE SLICED. The caption must not open with the line.
      expect(post.caption.startsWith(post.onImageText)).toBe(false);

      // Alt text carries every word a sighted reader got.
      expect(post.altText).toContain(post.onImageText);
    }
  });

  it("labels every post as a stub, so a fixture cannot pass for a real month", async () => {
    const month = await generateMonth(input());
    expect(month.generatedBy).toBe(STUB_LABEL);
    expect(month.posts.length).toBeGreaterThan(0);
    expect(month.posts.every((post) => post.generatedBy === STUB_LABEL)).toBe(true);
  });

  it("runs the six steps in the ruled order, per post", async () => {
    const calls: string[] = [];
    await generateMonth(input({ model: stubContentModel({ calls }), cadence: 1 }));

    const kinds = calls.map((call) => call.split(":")[0]);
    // Every line is written before its caption; every alt text comes after
    // both, because it describes a composed image that does not exist yet.
    expect(kinds.filter((k) => k === "line").length).toBe(4);
    expect(kinds.filter((k) => k === "alt").length).toBe(4);
    expect(kinds.indexOf("line")).toBeLessThan(kinds.indexOf("caption"));
    expect(kinds.lastIndexOf("caption")).toBeLessThan(kinds.indexOf("alt"));
  });

  it("refits a line that comes back too long, and says why", async () => {
    const model = stubContentModel({ overrunOnTheme: ["rest"] });
    const month = await generateMonth(input({ model }));

    const refits = month.retries.filter((note) => note.field === "on_image_text");
    expect(refits.length).toBeGreaterThan(0);
    expect(refits[0].because).toMatch(/words/);

    // And the month still comes out whole and inside its bounds.
    for (const post of month.posts) {
      expect(checkOnImageFit(post.onImageText, post.archetype)).toBeNull();
    }
  });

  it("catches a line the scanner refuses, rewrites it, and stores the rewrite", async () => {
    const model = stubContentModel({ misbehaveOnTheme: ["rest"] });
    const month = await generateMonth(input({ model }));

    // The offending sentence never reaches a post…
    for (const post of month.posts) {
      expect(post.onImageText).not.toContain("heal your anxiety");
    }
    // …and the rewrite is what is actually stored, not a silent drop.
    expect(month.posts.some((post) => post.onImageText === STUB_REWRITTEN_LINE)).toBe(true);

    // The catch is recorded, so the badge can say what was rescued.
    expect(month.ethicsCheck.flagged.some((entry) => entry.rule_id === "proven")).toBe(true);
    expect(month.ethicsCheck.passed).toBe(true);
  });

  it("fails the month rather than publishing copy the guard cannot clear", async () => {
    const stubborn = stubContentModel();
    // A model that returns the same blocked sentence however often it is asked.
    const model = {
      ...stubborn,
      writeOnImageLine: async () => STUB_UNETHICAL_LINE,
      rewrite: async () => STUB_UNETHICAL_LINE,
    };

    await expect(generateMonth(input({ model }))).rejects.toBeInstanceOf(
      GenerationImpossibleError
    );
  });

  it("reserves before each ground and settles after, once per photographic theme", async () => {
    const { events, port } = ledger();
    const month = await generateMonth(input({ allowance: port }));

    const themes = month.grounds.map((ground) => ground.theme);
    expect(themes.length).toBeGreaterThan(0);
    expect(new Set(themes).size).toBe(themes.length); // one ground per theme, not per post

    expect(events).toEqual(
      themes.flatMap(() => [
        { op: "reserve", cents: 5 },
        { op: "settle", cents: 5 },
      ])
    );
  });

  it("releases the reservation when the draw fails, and never keeps the money", async () => {
    const { events, port } = ledger();
    await expect(
      generateMonth(
        input({
          allowance: port,
          drawGround: async () => {
            throw new Error("the image service refused");
          },
        })
      )
    ).rejects.toThrow("the image service refused");

    expect(events).toEqual([
      { op: "reserve", cents: 5 },
      { op: "release", cents: 5 },
    ]);
  });

  it("spends nothing at all when the copy fails the guard", async () => {
    const { events, port } = ledger();
    const model = {
      ...stubContentModel(),
      writeOnImageLine: async () => STUB_UNETHICAL_LINE,
      rewrite: async () => STUB_UNETHICAL_LINE,
    };

    await expect(generateMonth(input({ allowance: port, model }))).rejects.toBeInstanceOf(
      GenerationImpossibleError
    );
    // ⚠ The whole reason the grounds are drawn after every text is clean.
    expect(events).toEqual([]);
  });

  it("stops the month when the allowance refuses, rather than drawing anyway", async () => {
    const port: AllowancePort = {
      async reserve() {
        return { ok: false, reason: "budget_exhausted" };
      },
      async settle() {
        throw new Error("settle must not be called on a refused reservation");
      },
    };

    await expect(generateMonth(input({ allowance: port }))).rejects.toBeInstanceOf(
      AllowanceExhaustedError
    );
  });
});

/* ── 4. The ground prompt ──────────────────────────────────────────────── */

describe("the ground prompt", () => {
  it("never asks for a face, a person or hands", () => {
    const prompt = buildGroundPrompt({
      theme: "rest",
      subject: "a made bed and a folded linen throw",
      paletteLine: "The palette appears in the objects.",
      mood: "unhurried",
    });

    for (const forbidden of ["no people", "no faces", "no hands"]) {
      expect(prompt).toContain(forbidden);
    }
    // Imported from the kit's own master, not restated here: if that sentence
    // ever loses one of the three, this test is what says so.
    expect(prompt).toContain("Editorial interiors photograph");
    expect(prompt).toContain("rest");
  });
});
