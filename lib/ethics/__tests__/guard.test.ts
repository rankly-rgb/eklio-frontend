import { describe, expect, it, vi } from "vitest";
import { enforceEthics, rulesBlock, type Rewriter } from "@/lib/ethics/guard";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * L'Ethics Guard ÉTEND le niveau 2 ; il ne le double pas. Ce test tient les
 * trois ajouts : les règles viennent de la base, la réécriture est CIBLÉE
 * (pas une régénération complète), et le verdict est persistable dans la
 * forme que `brand_kit_ethics_check_valid` impose.
 */

const rules: EthicsRule[] = [
  {
    id: "timeframe",
    active: true,
    sort_order: 1,
    short_label: "No timeframes",
    description: "No timeframe or session count attached to relief or results.",
    example_forbidden: "Heal your anxiety in 12 weeks.",
  },
  {
    id: "client_voice",
    active: true,
    sort_order: 3,
    short_label: "No client voice",
    description: "No client quotes or paraphrased client statements.",
    example_forbidden: "Clients often tell me...",
  },
];

describe("enforceEthics", () => {
  it("laisse passer une copy conforme sans appeler le modèle", async () => {
    const rewrite = vi.fn<Rewriter>();
    const result = await enforceEthics(
      [{ field: "hero.headline", text: "A calmer place to start." }],
      rules,
      rewrite
    );

    expect(rewrite).not.toHaveBeenCalled();
    expect(result.check.passed).toBe(true);
    expect(result.check.flagged).toEqual([]);
    expect(result.fields[0].text).toBe("A calmer place to start.");
  });

  it("ne réécrit QUE le champ fautif, pas toute la génération", async () => {
    const rewrite = vi.fn<Rewriter>(
      async () => "Understand what your anxiety protects."
    );

    const result = await enforceEthics(
      [
        { field: "hero.headline", text: "Heal your anxiety in 12 weeks." },
        { field: "hero.subhead", text: "Therapy for adults who can't switch off." },
      ],
      rules,
      rewrite
    );

    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(rewrite.mock.calls[0][0].field).toBe("hero.headline");
    expect(result.fields[0].text).toBe("Understand what your anxiety protects.");
    // Le champ conforme est laissé strictement intact.
    expect(result.fields[1].text).toBe(
      "Therapy for adults who can't switch off."
    );
  });

  it("cite l'extrait ET le texte de la règle LU EN BASE", async () => {
    const rewrite = vi.fn<Rewriter>(async () => "A calmer place to start.");
    await enforceEthics(
      // Une promesse DATÉE sans verbe de résolution : elle ne déclenche que la
      // règle `timeframe`, ce qui rend l'assertion sur la source du texte
      // sans ambiguïté.
      [{ field: "hero.headline", text: "Real progress in 8 sessions." }],
      rules,
      rewrite
    );

    const problem = rewrite.mock.calls[0][0].problems[0];
    expect(problem.ruleId).toBe("timeframe");
    expect(problem.excerpt.toLowerCase()).toContain("sessions");
    expect(problem.description).toBe(
      "No timeframe or session count attached to relief or results."
    );
    expect(problem.exampleForbidden).toBe("Heal your anxiety in 12 weeks.");
  });

  it("retombe sur la formulation du pattern quand la règle manque en base", async () => {
    const rewrite = vi.fn<Rewriter>(async () => "A calmer place to start.");
    await enforceEthics(
      [{ field: "hero.headline", text: "Heal your anxiety for good." }],
      // `proven` n'est pas dans cette table : la consigne ne doit pas devenir
      // muette pour autant.
      rules,
      rewrite
    );

    const problem = rewrite.mock.calls[0][0].problems[0];
    expect(problem.ruleId).toBe("proven");
    expect(problem.description.length).toBeGreaterThan(0);
  });

  it("consigne le passage rattrapé, avec l'id de règle de `ethics_rules`", async () => {
    const result = await enforceEthics(
      [{ field: "voice.line", text: "Clients often tell me it helped." }],
      rules,
      async () => "People come in saying the same three things."
    );

    expect(result.check.passed).toBe(true);
    expect(result.check.flagged[0]).toMatchObject({
      field: "voice.line",
      rule_id: "client_voice",
    });
    expect(() => new Date(result.check.checked_at).toISOString()).not.toThrow();
  });

  it("lève plutôt que de persister ce qui reste bloquant", async () => {
    // Un réécriveur qui ne corrige rien : après deux tentatives, on refuse.
    const rewrite = vi.fn<Rewriter>(async () => "Heal your anxiety in 12 weeks.");

    await expect(
      enforceEthics(
        [{ field: "hero.headline", text: "Heal your anxiety in 12 weeks." }],
        rules,
        rewrite
      )
    ).rejects.toBeInstanceOf(EthicsComplianceError);

    expect(rewrite).toHaveBeenCalledTimes(2);
  });

  it("garde le texte d'origine quand la réécriture rend du vide", async () => {
    const result = await enforceEthics(
      [{ field: "hero.subhead", text: "Therapy for high-performing adults." }],
      rules,
      async () => ""
    );
    expect(result.fields[0].text).toBe("Therapy for high-performing adults.");
  });
});

describe("rulesBlock", () => {
  it("construit le bloc de prompt DEPUIS LA BASE — pas depuis le code", () => {
    const block = rulesBlock(rules);
    expect(block).toContain("No timeframes");
    expect(block).toContain(
      "No timeframe or session count attached to relief or results."
    );
    expect(block).toContain('Never: "Heal your anxiety in 12 weeks."');
  });

  it("rend une chaîne vide quand la table est vide, plutôt qu'un titre orphelin", () => {
    expect(rulesBlock([])).toBe("");
  });
});
