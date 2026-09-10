import { describe, expect, it } from "vitest";
import { CeilingReachedError, withCallCeiling } from "../ceiling";
import { stubContentModel, STUB_LABEL } from "../stub-model";
import { generateMonth, type GenerateMonthInput } from "../pipeline";
import { CONTENT_REGISTERS, type ContentRegister } from "@/lib/data/content";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * ── PROVING THE STOP HAPPENS BEFORE THE CALL ────────────────────────────
 *
 * A ceiling read after the fact is a receipt, not a ceiling. The test that
 * matters is the last one: at the boundary, the underlying model is never
 * reached at all.
 */

const THEMES = ["one", "two", "three"] as const;
const SAFETY = Object.fromEntries(
  CONTENT_REGISTERS.map((r) => [r, `rule for ${r}`])
) as Record<ContentRegister, string>;
const RULES: EthicsRule[] = [];

function input(over: Partial<GenerateMonthInput> = {}): GenerateMonthInput {
  return {
    month: "2026-10",
    themes: THEMES,
    cadence: 3,
    acceptedRegisters: CONTENT_REGISTERS,
    safetyRules: SAFETY,
    takingClients: "no",
    context: "fixture",
    rules: RULES,
    model: stubContentModel(),
    allowance: { async reserve() { return { ok: true }; }, async settle() {} },
    groundCostCents: 5,
    groundPrompt: (theme) => `ground for ${theme}`,
    drawGround: async ({ theme }) => ({
      storagePath: `fixtures/${theme}.webp`,
      fingerprint: `fp-${theme}`,
      description: `a fixture ground for ${theme}`,
      costCents: 5,
    }),
    compose: async ({ post }) => ({ description: `a fixture ground for ${post.theme}` }),
    ...over,
  };
}

describe("the call ceiling", () => {
  it("keeps the model's label, which is what tells a stub from a real month", () => {
    const { model } = withCallCeiling(stubContentModel(), 10);
    expect(model.label).toBe(STUB_LABEL);
  });

  it("counts every call and reports what is left", async () => {
    const { model, ledger } = withCallCeiling(stubContentModel(), 100);
    await generateMonth(input({ model }));

    // 12 lines + 12 captions + 12 alt texts, at minimum, on a clean run.
    expect(ledger.calls.length).toBeGreaterThanOrEqual(36);
    expect(ledger.remaining()).toBe(100 - ledger.calls.length);
    expect(ledger.calls.filter((c) => c.startsWith("alt_text")).length).toBe(12);
  });

  it("stops the whole month rather than overrunning", async () => {
    const { model } = withCallCeiling(stubContentModel(), 5);
    await expect(generateMonth(input({ model }))).rejects.toBeInstanceOf(CeilingReachedError);
  });

  it("refuses by REJECTING, not by throwing past the promise", async () => {
    // A method typed async but throwing synchronously escapes `.catch()`.
    const { model } = withCallCeiling(stubContentModel(), 0);
    const call = model.writeCaption({} as never);
    expect(call).toBeInstanceOf(Promise);
    await expect(call).rejects.toBeInstanceOf(CeilingReachedError);
  });

  it("⚠ never reaches the model on the call that would cross the line", async () => {
    let reached = 0;
    const counting = {
      ...stubContentModel(),
      async writeOnImageLine() {
        reached += 1;
        return "Some weeks the hardest part is getting there at all.";
      },
    };

    const { model } = withCallCeiling(counting, 2);
    await expect(model.writeOnImageLine({} as never)).resolves.toBeTruthy();
    await expect(model.writeOnImageLine({} as never)).resolves.toBeTruthy();
    await expect(model.writeOnImageLine({} as never)).rejects.toBeInstanceOf(CeilingReachedError);

    // Two, not three. The third never got as far as the vendor.
    expect(reached).toBe(2);
  });

  it("spends nothing on photographs when the ceiling stops the copy", async () => {
    const events: string[] = [];
    const { model } = withCallCeiling(stubContentModel(), 3);

    await expect(
      generateMonth(
        input({
          model,
          allowance: {
            async reserve() {
              events.push("reserve");
              return { ok: true };
            },
            async settle() {
              events.push("settle");
            },
          },
        })
      )
    ).rejects.toBeInstanceOf(CeilingReachedError);

    // The grounds are drawn only after every text is clean; a ceiling hit
    // during the copy therefore costs nothing at all.
    expect(events).toEqual([]);
  });
});
