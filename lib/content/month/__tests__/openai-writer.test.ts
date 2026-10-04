import { describe, expect, it, vi } from "vitest";
import { openAiWriter } from "@/lib/content/month/openai-writer";
import { ProviderUnavailable, spendMeter, type OpenAiTransport } from "@/lib/content/generate/openai";
import { OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { payloadSchema } from "@/lib/compose/archetypes/schema";
import type { DrawnTopic } from "@/lib/content/month/draw";
import type { WriteSink, WrittenPost } from "@/lib/content/month/orchestrate";

/*
 * ── LE RÉDACTEUR PRODUIT, SANS UN APPEL ─────────────────────────────────
 *
 * Le transport est une doublure qui rend ce qu'un `/v1/responses` rend. Ce qui
 * est éprouvé ici est ce que le rédacteur DÉCIDE ; ce que le fournisseur écrit
 * est éprouvé par de vrais appels, sur la planche du premier mois.
 */

const BRAND = {
  practiceName: "Still Water",
  voice: "plain, warm",
  offLimits: "",
  ethicsRules: [{ id: "a", short_label: "No promises", description: "Never promise an outcome." }],
};

function topic(id: string, archetype = "single_statement"): DrawnTopic {
  return { id, archetype_key: archetype, intent: "educate", title: `Rest is not a reward ${id}`, hook: "a hook" };
}

function answer(payload: unknown, over: Record<string, unknown> = {}) {
  return {
    status: "completed",
    output_text: JSON.stringify({
      payload,
      card_line: "Rest is not a reward",
      caption: "Rest can be learned slowly.",
      alt_text: "A card with one sentence.",
      rationale: "It names a common belief.",
      ...over,
    }),
    usage: { input_tokens: 3000, output_tokens: 200, input_tokens_details: { cached_tokens: 2800 } },
  };
}

function sink(): WriteSink & { posts: WrittenPost[]; refusals: string[]; spending: number[] } {
  const posts: WrittenPost[] = [];
  const refusals: string[] = [];
  const spending: number[] = [];
  return {
    posts, refusals, spending,
    post: vi.fn(async (p: WrittenPost) => { posts.push(p); }),
    refused: vi.fn(async (id: string, reason: string) => { refusals.push(`${id}:${reason}`); }),
    spent: vi.fn(async (d: number) => { spending.push(d); }),
  } as never;
}

function writer(transport: OpenAiTransport, capUsd = 5, over: Record<string, unknown> = {}) {
  return openAiWriter({
    transport,
    meter: spendMeter(capUsd),
    model: OPENAI_COPY_MODEL,
    brand: BRAND,
    checkin: "",
    intentLabels: new Map([["educate", "Educate"]]),
    themes: ["rest"],
    practiceName: "Still Water",
    practitionerLines: ["EMDR", "Oakland, CA"],
    concurrency: 1,
    ...over,
  });
}

describe("chaque appel est strict, et sur le schéma de SON archétype", () => {
  it("le corps porte strict: true et le payload de l'archétype", async () => {
    const transport = vi.fn(async () => answer({ statement: "Rest can be learned, slowly and on purpose." }));
    await writer(transport).write({ topics: [topic("t1")], wanted: 1, month: "2027-07-01", sink: sink() });
    const body = transport.mock.calls[0][0] as { model: string; text: { format: { strict: boolean; schema: { properties: { payload: unknown } } } } };
    expect(body.model).toBe(OPENAI_COPY_MODEL);
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.payload).toEqual(payloadSchema("single_statement"));
  });
});

describe("ce qui est payé, et ce qui ne l'est pas", () => {
  it("la carte de praticienne s'assemble depuis le brief, sans appel", async () => {
    const transport = vi.fn();
    const s = sink();
    const out = await writer(transport as never).write({
      topics: [topic("p1", "practitioner_card")], wanted: 1, month: "2027-07-01", sink: s,
    });
    expect(transport).not.toHaveBeenCalled();
    expect(out.posts[0].payload).toEqual({ lines: ["EMDR", "Oakland, CA"] });
    expect(out.costUsd).toBe(0);
  });

  it("un post conforme entre au journal, avec son coût", async () => {
    const transport = vi.fn(async () => answer({ statement: "Rest can be learned, slowly and on purpose." }));
    const s = sink();
    const out = await writer(transport).write({ topics: [topic("t1")], wanted: 1, month: "2027-07-01", sink: s });
    expect(s.posts).toHaveLength(1);
    expect(s.posts[0].eyebrow.length).toBeGreaterThan(0);
    expect(out.costUsd).toBeCloseTo((3000 * 2 + 200 * 12) / 1e6, 12);
    expect(s.spending.reduce((a, b) => a + b, 0)).toBeCloseTo(out.costUsd, 12);
  });

  it("un payload hors forme est refusé et journalisé comme refus, payé", async () => {
    const transport = vi.fn(async () => answer({ wrong: true }));
    const s = sink();
    const out = await writer(transport).write({ topics: [topic("t1")], wanted: 1, month: "2027-07-01", sink: s });
    expect(out.posts).toEqual([]);
    expect(s.refusals).toEqual(["t1:payload_shape"]);
    expect(out.costUsd).toBeGreaterThan(0);
  });

  /*
   * ⚠ UN DÉPASSEMENT DE BUDGET PART À LA RÉPARATION, PAR LE MÊME COMPTEUR. Le
   * payload parse ; il ne lui manque que quelques mots.
   */
  it("un dépassement de budget est réparé, et la réparation est comptée", async () => {
    const long = "This one sentence runs on well past the twenty four word limit that the database enforces on a single statement card so it comes back";
    const transport = vi.fn(async (body: Record<string, unknown>) =>
      body.text
        ? answer({ statement: long })
        : { status: "completed", output_text: "Rest can be learned slowly", usage: { input_tokens: 100, output_tokens: 10 } }
    );
    const s = sink();
    const w = writer(transport as never);
    const out = await w.write({ topics: [topic("t1")], wanted: 1, month: "2027-07-01", sink: s });
    expect(out.posts).toHaveLength(1);
    expect((out.posts[0].payload as { statement: string }).statement).toBe("Rest can be learned slowly");
    expect(w.ledger.repaired).toBe(1);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(out.posts[0].costUsd).toBeCloseTo(out.costUsd, 12);
  });
});

describe("un arrêt n'est pas un refus", () => {
  it("le plafond atteint arrête la rédaction, sans envoyer, et compte les jamais tentés", async () => {
    const transport = vi.fn(async () => answer({ statement: "Rest can be learned, slowly and on purpose." }));
    const s = sink();
    const out = await writer(transport, 0.04).write({
      topics: [topic("t1"), topic("t2"), topic("t3"), topic("t4")], wanted: 4, month: "2027-07-01", sink: s,
    });
    expect(out.stopped?.reason).toBe("spend_cap");
    expect(transport.mock.calls.length).toBeLessThan(4);
    expect(out.stopped!.untried + out.posts.length).toBe(4);
    expect(s.refusals, "un sujet jamais tenté est journalisé comme refusé").toEqual([]);
  });

  it("un solde épuisé arrête tout, et rien n'est compté comme refus", async () => {
    const transport = vi.fn(async () => { throw new ProviderUnavailable("no_credit", "insufficient_quota"); });
    const s = sink();
    const out = await writer(transport as never).write({
      topics: [topic("t1"), topic("t2")], wanted: 2, month: "2027-07-01", sink: s,
    });
    expect(out.stopped?.reason).toBe("no_credit");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(s.refusals).toEqual([]);
    expect(out.costUsd).toBe(0);
  });
});
