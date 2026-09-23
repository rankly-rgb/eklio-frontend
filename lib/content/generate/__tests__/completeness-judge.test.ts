import { describe, expect, it } from "vitest";
import { judgeCompleteness } from "@/lib/content/generate/completeness-judge";

/*
 * ── ⚠ UN JUGE EN PANNE NE REFUSE PAS UN MOIS ───────────────────────────
 *
 * Le juge est un appel de CONTRÔLE, pas de production. S'il tombe, le mois
 * doit continuer d'être jugé par ce que le lexique sait — pas s'effondrer.
 * « L'absence de verdict n'est pas un verdict » est la règle, et elle est
 * testée ici parce que c'est le seul endroit où elle peut se perdre.
 */
const clientThat = (behaviour: () => unknown) => ({
  messages: { create: async () => behaviour() } as never,
});

describe("le juge de complétude", () => {
  it("lit les verdicts qu'il reçoit", async () => {
    const { verdicts, usage } = await judgeCompleteness(
      clientThat(() => ({
        content: [{ type: "text", text: '{"The thing that works costs": false, "Back at work": true}' }],
        usage: { input_tokens: 120, output_tokens: 18 },
      })),
      ["The thing that works costs", "Back at work"]
    );
    expect(verdicts).toEqual({ "The thing that works costs": false, "Back at work": true });
    expect(usage).toEqual({ input: 120, output: 18 });
  });

  it("supporte un JSON entouré d'un fence", async () => {
    const { verdicts } = await judgeCompleteness(
      clientThat(() => ({
        content: [{ type: "text", text: '```json\n{"a b": false}\n```' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })),
      ["a b"]
    );
    expect(verdicts).toEqual({ "a b": false });
  });

  it("ne lève pas et ne refuse rien quand l'appel échoue", async () => {
    const { verdicts, usage } = await judgeCompleteness(
      clientThat(() => { throw new Error("529 overloaded"); }),
      ["The thing that works costs"]
    );
    expect(verdicts).toEqual({});
    expect(usage).toEqual({ input: 0, output: 0 });
  });

  it("ne lève pas sur une réponse illisible", async () => {
    const { verdicts } = await judgeCompleteness(
      clientThat(() => ({
        content: [{ type: "text", text: "Sure! Here are my thoughts:" }],
        usage: { input_tokens: 5, output_tokens: 5 },
      })),
      ["x y"]
    );
    expect(verdicts).toEqual({});
  });

  /* ⚠ Une valeur non booléenne n'est pas un verdict : elle est ignorée. */
  it("ignore ce qui n'est pas un booléen", async () => {
    const { verdicts } = await judgeCompleteness(
      clientThat(() => ({
        content: [{ type: "text", text: '{"a b": "maybe", "c d": false}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })),
      ["a b", "c d"]
    );
    expect(verdicts).toEqual({ "c d": false });
  });

  it("aucune ligne indécise : aucun appel", async () => {
    let called = 0;
    const { usage } = await judgeCompleteness(
      { messages: { create: async () => { called += 1; return {}; } } as never },
      []
    );
    expect(called).toBe(0);
    expect(usage).toEqual({ input: 0, output: 0 });
  });
});
