import { describe, expect, it, vi } from "vitest";
import { openAiWriteOne, onDemandWriterConfigured } from "@/lib/content/generate/write-one-openai";
import { spendMeter, type OpenAiTransport } from "@/lib/content/generate/openai";
import { OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { runOnDemandWrite } from "@/lib/content/generate/on-demand";

/*
 * « Write it » sur OpenAI, sans un appel : le transport rend ce qu'un
 * `/v1/responses` rend. Ce qui est éprouvé est ce que le rédacteur DÉCIDE.
 */
const BRAND = {
  practiceName: "Still Water",
  voice: "plain, warm",
  offLimits: "",
  ethicsRules: [{ id: "a", short_label: "No promises", description: "Never promise an outcome." }],
};
const TOPIC = { topicId: "free-idea", archetypeKey: "single_statement", title: "Rest can be learned", hook: "a hook", intent: "educate", checkin: "" };

function answer(payload: unknown) {
  return {
    status: "completed",
    output_text: JSON.stringify({
      payload,
      card_line: "Rest can be learned",
      caption: "Rest can be learned slowly.",
      alt_text: "A card with one sentence.",
      rationale: "It names a common belief.",
    }),
    usage: { input_tokens: 3000, output_tokens: 200, input_tokens_details: { cached_tokens: 0 } },
  };
}

const writer = (transport: OpenAiTransport) =>
  openAiWriteOne({ transport, meter: spendMeter(0.25), model: OPENAI_COPY_MODEL });

describe("un post, sur le fournisseur retenu", () => {
  it("un appel strict, validé, et son coût au tarif lu", async () => {
    const transport = vi.fn<OpenAiTransport>(async () => answer({ statement: "Rest can be learned, slowly and on purpose." }));
    const out = await runOnDemandWrite(writer(transport), { brand: BRAND, request: TOPIC });
    expect(out.ok, out.reason).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    const body = transport.mock.calls[0][0] as { text: { format: { strict: boolean } } };
    expect(body.text.format.strict).toBe(true);
    expect(out.costUsd).toBeCloseTo((3000 * 2 + 200 * 12) / 1e6, 12);
    expect(out.title).toBe("Rest can be learned, slowly and on purpose.");
  });

  it("une sortie hors forme est relancée UNE fois, et les deux appels sont comptés", async () => {
    const transport = vi.fn<OpenAiTransport>(async () => answer({ wrong: true }));
    const out = await runOnDemandWrite(writer(transport), { brand: BRAND, request: TOPIC });
    expect(out.ok).toBe(false);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(out.retried).toBe(true);
    expect(out.costUsd).toBeCloseTo(2 * (3000 * 2 + 200 * 12) / 1e6, 12);
  });

  it("un archétype inconnu est refusé avant tout appel", async () => {
    const transport = vi.fn<OpenAiTransport>();
    const out = await runOnDemandWrite(writer(transport), { brand: BRAND, request: { ...TOPIC, archetypeKey: "invented" } });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("unknown_archetype");
    expect(transport).not.toHaveBeenCalled();
  });

  it("la clé est lue dans l'environnement qu'on lui passe", () => {
    expect(onDemandWriterConfigured({})).toBe(false);
    expect(onDemandWriterConfigured({ OPENAI_API_KEY: "sk-test" })).toBe(true);
  });
});
