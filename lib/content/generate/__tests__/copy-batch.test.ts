import { describe, expect, it } from "vitest";
import {
  batchCostUsd,
  buildBatchRequests,
  cachedPrefix,
  collectCopy,
  HAIKU_PRICE,
  massCopyModel,
  validateCopy,
  variablePart,
  type BrandContext,
  type TopicRequest,
} from "@/lib/content/generate/copy-batch";

/*
 * ── CE QUE CE FICHIER GARDE, ET POURQUOI C'EST DE L'ARGENT ──────────────
 *
 * Le caching est un préfixe. Un invalidateur silencieux ne casse rien : il
 * rend la bonne réponse au plein tarif, pour toujours, et le seul symptôme est
 * un `cache_read_input_tokens` à zéro que personne ne regarde.
 *
 * Les deux invalidateurs plausibles ici sont nommés et épinglés : une date
 * dans le préfixe, et six règles déontologiques rendues dans un ordre que la
 * base ne promet pas.
 */

const BRAND: BrandContext = {
  practiceName: "A Practice Name",
  voice: "plain, unhurried, never clinical",
  offLimits: "nothing about medication",
  ethicsRules: [
    { id: "outcome", short_label: "No promised outcome", description: "Never guarantee a result." },
    { id: "diagnosis", short_label: "No diagnosis", description: "Never diagnose in public copy." },
    { id: "comparison", short_label: "No comparison", description: "Never compare to another practitioner." },
  ],
};

const TOPIC: TopicRequest = {
  topicId: "11111111-1111-4111-8111-111111111111",
  archetypeKey: "cycle",
  title: "The rumination loop",
  hook: "It is not thinking it through",
  intent: "normalise",
  checkin: "burnout, taking new clients",
};

describe("the cached prefix", () => {
  it("carries cache_control, which is the whole point", () => {
    const [block] = cachedPrefix(BRAND, "cycle");
    expect(block.cache_control).toEqual({ type: "ephemeral" });
  });

  it("is byte-identical across calls", () => {
    expect(cachedPrefix(BRAND, "cycle")).toEqual(cachedPrefix(BRAND, "cycle"));
  });

  /*
   * ⚠ L'INVALIDATEUR N°1. Une date, une heure, un identifiant de requête —
   * n'importe quoi qui bouge — et le préfixe est réécrit au plein tarif à
   * chaque carte.
   */
  it("contains no date, no time and no identifier", () => {
    const text = cachedPrefix(BRAND, "cycle")[0].text;
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/\d{2}:\d{2}/);
    expect(text).not.toMatch(TOPIC.topicId);
  });

  /*
   * ⚠ L'INVALIDATEUR N°2, et le plus discret. `select ... from ethics_rules`
   * sans `order by` ne promet aucun ordre. Six règles rendues dans un ordre
   * différent un run sur deux ne cachent jamais rien.
   */
  it("renders the ethics rules in a stable order whatever order they arrive in", () => {
    const shuffled: BrandContext = {
      ...BRAND,
      ethicsRules: [...BRAND.ethicsRules].reverse(),
    };
    expect(cachedPrefix(shuffled, "cycle")).toEqual(cachedPrefix(BRAND, "cycle"));
  });

  it("changes with the archetype, because the schema is in it", () => {
    expect(cachedPrefix(BRAND, "cycle")[0].text).not.toBe(
      cachedPrefix(BRAND, "quadrant_model")[0].text
    );
  });
});

describe("the variable part comes after the cache breakpoint", () => {
  it("the topic is in the user message and nowhere in the system prefix", () => {
    const [request] = buildBatchRequests(BRAND, [TOPIC]);
    const system = (request.params.system as Array<{ text: string }>)[0].text;
    expect(system).not.toContain(TOPIC.title);
    expect(system).not.toContain(TOPIC.checkin);
    expect(JSON.stringify(request.params.messages)).toContain(TOPIC.title);
  });

  it("the check-in is variable and is never cached", () => {
    // It changes every month; in the prefix it would rewrite the cache monthly
    // for every subscriber at once.
    expect(variablePart(TOPIC)).toContain(TOPIC.checkin);
    expect(cachedPrefix(BRAND, TOPIC.archetypeKey)[0].text).not.toContain(TOPIC.checkin);
  });

  it("each request is keyed by its topic id", () => {
    const requests = buildBatchRequests(BRAND, [TOPIC, { ...TOPIC, topicId: "other" }]);
    expect(requests.map((r) => r.custom_id)).toEqual([TOPIC.topicId, "other"]);
    expect(requests[0].params.model).toBe(massCopyModel());
  });
});

describe("validation rejects, and never repairs", () => {
  const good = JSON.stringify({
    payload: {
      nodes: [
        { label: "Notice", gloss: "the first flicker" },
        { label: "Name it", gloss: "out loud if possible" },
        { label: "Let it pass", gloss: "without arguing" },
      ],
    },
    caption: "A caption she can post as is.",
    alt_text: "A three-step cycle.",
    rationale: "Because rumination keeps coming up.",
  });

  it("accepts a conforming output", () => {
    const result = validateCopy("cycle", good);
    expect(result.ok).toBe(true);
    expect(result.caption).toBe("A caption she can post as is.");
  });

  it("accepts one wrapped in a code fence, which is the one deviation it can read", () => {
    expect(validateCopy("cycle", "```json\n" + good + "\n```").ok).toBe(true);
  });

  it("refuses a payload of the wrong shape", () => {
    const twoNodes = JSON.parse(good);
    twoNodes.payload.nodes.pop();
    expect(validateCopy("cycle", JSON.stringify(twoNodes)).reason).toBe("payload_shape");
  });

  /*
   * ⚠ ET IL NE LE RÉPARE PAS. Un payload à deux nœuds rendu comme un cycle
   * valide produirait une carte que personne n'a écrite, et personne ne saurait
   * qu'elle a été fabriquée ici.
   *
   * ⚠ IL LE REND POURTANT, DEPUIS LE 2026-09-21, ET LES DEUX NE SE CONTREDISENT
   * PAS. « Refuser » et « ne rien rendre » étaient la même ligne de code ;
   * elles ne sont pas la même règle. Le payload est connu, il parse, il lui
   * manque un mot — le jeter obligeait l'appelant à tout redemander, légende
   * et texte alternatif compris, pour un `gloss` trop long. Il repart donc
   * avec le refus, et `lib/content/generate/repair.ts` fait réécrire CE
   * champ-là par le modèle.
   *
   * Ce qui ne bouge pas est la seule chose qui protégeait quoi que ce soit :
   * `ok` reste faux. Rien ne peut être écrit en base sans repasser par une
   * validation qui, elle, dira oui.
   */
  it("refuses one word over budget rather than trimming it", () => {
    const over = JSON.parse(good);
    over.payload.nodes[0].gloss = "one two three four five six seven";
    const result = validateCopy("cycle", JSON.stringify(over));
    expect(result.reason).toBe("over_budget");
    expect(result.ok).toBe(false);
    // Le budget dit QUEL champ déborde, et de combien.
    expect(result.budget).toEqual([{ path: "nodes[0].gloss", said: 7, allowed: 6 }]);
  });

  it("⚠ le payload refusé repart INTACT — ni coupé, ni raccourci", () => {
    const over = JSON.parse(good);
    over.payload.nodes[0].gloss = "one two three four five six seven";
    const result = validateCopy("cycle", JSON.stringify(over));
    expect(result.ok).toBe(false);
    expect(result.payload).toEqual(over.payload);
  });

  it("refuses a caption Instagram would refuse", () => {
    const long = JSON.parse(good);
    long.caption = "x".repeat(2201);
    expect(validateCopy("cycle", JSON.stringify(long)).reason).toBe("caption_too_long");
  });

  it("refuses prose that is not JSON at all", () => {
    expect(validateCopy("cycle", "Here is your card!").reason).toBe("not_json");
  });
});

describe("results are read by custom_id, never by position", () => {
  /*
   * ⚠ LA DOCUMENTATION DE L'API LE DIT : les résultats d'un batch reviennent
   * dans un ordre quelconque. Les lire par position produit trente cartes
   * correctes attribuées aux mauvais sujets — chacune valide, l'ensemble faux.
   */
  it("a reversed result set still lands on the right topics", () => {
    const message = (nodes: number) =>
      ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              payload: {
                nodes: Array.from({ length: nodes }, (_, i) => ({
                  label: `Step ${i}`,
                  gloss: "a gloss here",
                })),
              },
              caption: `caption ${nodes}`,
              alt_text: "alt",
              rationale: "because",
            }),
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_read_input_tokens: 900,
          cache_creation_input_tokens: 0,
        },
      }) as never;

    const entries = [
      { custom_id: "b", result: { type: "succeeded", message: message(4) } },
      { custom_id: "a", result: { type: "succeeded", message: message(3) } },
    ];
    const byTopic = new Map([
      ["a", "cycle"],
      ["b", "cycle"],
    ]);

    const results = collectCopy(entries, byTopic);
    const a = results.find((r) => r.topicId === "a")!;
    const b = results.find((r) => r.topicId === "b")!;
    expect(a.caption).toBe("caption 3");
    expect(b.caption).toBe("caption 4");
  });

  it("an errored entry is reported, not dropped", () => {
    const results = collectCopy(
      [{ custom_id: "a", result: { type: "errored" } }],
      new Map([["a", "cycle"]])
    );
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toBe("errored");
  });

  it("carries the cache counters back, which is the only symptom a broken cache has", () => {
    const results = collectCopy(
      [
        {
          custom_id: "a",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "not json" }],
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                cache_read_input_tokens: 1200,
                cache_creation_input_tokens: 0,
              },
            } as never,
          },
        },
      ],
      new Map([["a", "cycle"]])
    );
    expect(results[0].usage).toEqual({ input: 10, output: 20, cacheRead: 1200, cacheWrite: 0 });
  });
});

describe("cost", () => {
  it("multiplies the batch discount and the cache discount together", () => {
    const cost = batchCostUsd([{ input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }]);
    expect(cost).toBeCloseTo(HAIKU_PRICE.inputPerMTok * 0.5, 6);

    const cached = batchCostUsd([{ input: 0, output: 0, cacheRead: 1e6, cacheWrite: 0 }]);
    // A cached token is a tenth of an input token, then half again for batch.
    expect(cached).toBeCloseTo(HAIKU_PRICE.inputPerMTok * 0.1 * 0.5, 6);
  });

  it("a cached month costs a fraction of an uncached one", () => {
    // 30 cards, ~1200 tokens of prefix each, ~300 output.
    const uncached = batchCostUsd(
      Array.from({ length: 30 }, () => ({ input: 1200, output: 300, cacheRead: 0, cacheWrite: 0 }))
    );
    const cached = batchCostUsd([
      { input: 60, output: 300, cacheRead: 0, cacheWrite: 1200 },
      ...Array.from({ length: 29 }, () => ({
        input: 60,
        output: 300,
        cacheRead: 1200,
        cacheWrite: 0,
      })),
    ]);
    expect(cached).toBeLessThan(uncached);
  });
});
