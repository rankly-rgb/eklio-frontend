import { describe, expect, it } from "vitest";
import { spendMeter, type OpenAiResponse } from "@/lib/content/generate/openai";
import { writerSystemPrompt, writerUserPrompt, type SeoWriterBrief } from "@/lib/seo/brief";
import { openAiSeoWriter, repairRequestBody, seoRequestBody } from "@/lib/seo/writer";
import {
  assembleBody,
  firstParagraphOf,
  sectionsOf,
  wordCount,
  writerOutputJsonSchema,
  writerOutputSchema,
} from "@/lib/seo/output";

const BRIEF: SeoWriterBrief = {
  kind: "local_page",
  primaryQuery: "EMDR therapy in Oakland, CA",
  modalityTerm: "EMDR therapy",
  populationTerm: null,
  city: "Oakland",
  state: "CA",
  practitioner: { name: "Dana Whitfield", credential: "LMFT", licenceMention: "LMFT 123456", title: "Licensed Marriage and Family Therapist", doctorate: false },
  brand: {
    practiceName: "Whitfield Therapy",
    positioning: "Steady, structured trauma work for adults who are tired of talking around it.",
    usp: "",
    soundsLike: ["plain", "warm"],
    neverWrite: ["journey"],
  },
  sources: [{ label: "NIMH", url: "https://www.nimh.nih.gov/news" }],
  ethicsRules: ["No testimonials: ..."],
  bannedPhrases: ["safe space", "your journey"],
  answeredElsewhere: ["Is EMDR the same as hypnosis?"],
};

const OUTPUT = {
  title: "EMDR therapy in Oakland, CA",
  meta_description: "x".repeat(150),
  h1: "EMDR therapy in Oakland, CA",
  intro: "EMDR therapy in Oakland, CA is offered by Dana Whitfield.",
  sections: [
    { heading: "What is EMDR?", paragraphs: ["EMDR is a structured therapy.", "More."], bullets: [], subsections: [] },
    { heading: "# How does a session go?", paragraphs: ["A session follows set phases."], bullets: ["One", "Two"], subsections: [{ heading: "Preparation", paragraphs: ["First you prepare."] }] },
    { heading: "Who is it for?", paragraphs: ["It is used with adults."], bullets: [], subsections: [] },
  ],
  faq: [{ question: "Q?", answer: "A." }],
};

describe("le brief", () => {
  it("porte les règles que les contrôles vérifient", () => {
    const sys = writerSystemPrompt(BRIEF);
    expect(sys).toContain("700 to 1100 words");
    expect(sys).toContain('"EMDR therapy in Oakland, CA"');
    expect(sys).toContain("ANSWER FIRST");
    expect(sys).toContain("https://www.nimh.nih.gov/news");
    expect(sys).toContain('"safe space"');
    expect(sys).toContain("Location: Oakland, CA");
    expect(sys).toContain("Do NOT write a byline");
    // Session 2 : « get rid of » a déclenché l'Ethics Guard sur deux pièces (A, E).
    expect(sys).toContain('"get rid of"');
    // Session 2 (mois 3 de Lena) : la consigne noyée au milieu n'était pas suivie.
    expect(sys).toContain("HEADINGS AND QUESTIONS ALREADY ON HER SITE");
    expect(sys.trimEnd().endsWith('- "Is EMDR the same as hypnosis?"')).toBe(true);
  });

  it("un article ne reçoit aucun lieu", () => {
    const sys = writerSystemPrompt({ ...BRIEF, kind: "article", city: null, state: null });
    expect(sys).toContain("do not name any city");
    expect(sys).toContain("1000 to 1600 words");
  });

  it("la réécriture porte le rapport d'échec et la version précédente", () => {
    const user = writerUserPrompt(BRIEF, { findings: [{ check: "seo.title_length", detail: "71 > 60" }], previous: { a: 1 } });
    expect(user).toContain("[seo.title_length] 71 > 60");
    expect(user).toContain('{"a":1}');
  });
});

describe("la sortie", () => {
  it("le schéma JSON strict décrit les mêmes clés que Zod", () => {
    const json = writerOutputJsonSchema() as { required: string[] };
    expect(json.required.sort()).toEqual(Object.keys(writerOutputSchema.shape).sort());
  });

  it("assemble un corps sans H1, titres nettoyés", () => {
    const body = assembleBody(writerOutputSchema.parse(OUTPUT));
    expect(body).not.toMatch(/^# /m);
    expect(body).toContain("## How does a session go?");
    expect(body).toContain("- One\n- Two");
    expect(body).toContain("### Preparation");
    expect(firstParagraphOf(body)).toBe(OUTPUT.intro);
    expect(sectionsOf(body).map((s) => s.firstParagraph)).toEqual([
      "EMDR is a structured therapy.",
      "A session follows set phases.",
      "It is used with adults.",
    ]);
  });

  it("compte les mots sans la syntaxe Markdown", () => {
    expect(wordCount("## Title here\n\nOne [two three](https://x.y) **four**.\n\n- five")).toBe(7);
  });
});

describe("le rédacteur OpenAI", () => {
  it("envoie une sortie stricte, sans stockage, et passe par le compteur", async () => {
    const body = seoRequestBody("gpt-5.6-terra", { brief: BRIEF });
    expect((body.text as { format: { strict: boolean } }).format.strict).toBe(true);
    expect(body.store).toBe(false);

    const sent: Array<Record<string, unknown>> = [];
    const transport = async (b: Record<string, unknown>): Promise<OpenAiResponse> => {
      sent.push(b);
      return { status: "completed", output_text: JSON.stringify(OUTPUT), usage: { input_tokens: 3000, output_tokens: 4000 } };
    };
    const meter = spendMeter(1);
    const writer = openAiSeoWriter({ transport, meter, model: "gpt-5.6-terra" });
    const result = await writer.write({ brief: BRIEF });
    expect(sent).toHaveLength(1);
    expect(result.output).toEqual(OUTPUT);
    expect(result.costUsd).toBeCloseTo((3000 * 2 + 4000 * 12) / 1e6, 6);
    expect(meter.spentUsd()).toBeCloseTo(result.costUsd, 6);
    expect(writer.worstCaseUsd({ brief: BRIEF })).toBeGreaterThan(result.costUsd);
  });

  it("refuse d'appeler au-delà du plafond", async () => {
    const writer = openAiSeoWriter({
      transport: async () => ({ status: "completed", output_text: "{}" }),
      meter: spendMeter(0.01),
      model: "gpt-5.6-terra",
    });
    await expect(writer.write({ brief: BRIEF })).rejects.toThrow(/plafond/);
  });

  it("une réponse qui n'est pas du JSON est rendue comme problème, pas comme sortie", async () => {
    const writer = openAiSeoWriter({
      transport: async () => ({ status: "completed", output_text: "Sorry", usage: { input_tokens: 10, output_tokens: 10 } }),
      meter: spendMeter(1),
      model: "gpt-5.6-terra",
    });
    const result = await writer.write({ brief: BRIEF });
    expect(result.output).toBeNull();
    expect(result.problem).toMatch(/JSON/);
  });
});

describe("la réparation d'un champ (session 3)", () => {
  const req = {
    field: "meta_description" as const,
    current: "Too short.",
    problem: "the meta description is 10 characters; it must be 140 to 160: add 130 to 150 characters.",
    primaryQuery: "EMDR therapy in Oakland, CA",
    h1: "EMDR therapy in Oakland, CA",
    intro: "EMDR therapy in Oakland, CA is a structured approach.",
  };

  it("un appel court, strict, sans stockage, qui ne demande que le champ", () => {
    const body = seoRequestBody("gpt-5.6-terra", { brief: BRIEF });
    const repair = repairRequestBody("gpt-5.6-terra", req);
    expect(repair.store).toBe(false);
    expect((repair.text as { format: { strict: boolean; schema: { required: string[] } } }).format.schema.required).toEqual(["value"]);
    expect(Number(repair.max_output_tokens)).toBeLessThan(Number(body.max_output_tokens));
    expect(String(repair.instructions)).toContain("140 to 160 characters");
    expect(String(repair.input)).toContain("add 130 to 150 characters");
  });

  it("passe par le compteur, et rend la valeur", async () => {
    const meter = spendMeter(1);
    const writer = openAiSeoWriter({
      transport: async () => ({ status: "completed", output_text: JSON.stringify({ value: "  A longer description.  " }), usage: { input_tokens: 500, output_tokens: 300 } }),
      meter,
      model: "gpt-5.6-terra",
    });
    const r = await writer.repairField(req);
    expect(r.value).toBe("A longer description.");
    expect(meter.spentUsd()).toBeCloseTo((500 * 2 + 300 * 12) / 1e6, 6);
    expect(writer.worstCaseRepairUsd(req)).toBeLessThan(writer.worstCaseUsd({ brief: BRIEF }));
  });
});
