import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { withinCeiling } from "@/lib/content/month/spend-ceiling";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLAFOND EST UN PRÉREQUIS, PAS UNE FINITION (F58)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `WriterPort` reçoit la liste des sujets tirés, et cette liste vient de la
 * banque — 1 331 tirables sur la base locale du 2026-09-26. Rien ne bornait ce
 * qu'on faisait rédiger : la facture suivait la banque au lieu de suivre
 * l'abonnement.
 */

const CEILING = { capUsd: 1, estimatedCostPerPostUsd: 0.01, maxTopics: 60 };

describe("la borne du nombre ne dépend d'aucune estimation", () => {
  it("elle laisse passer ce qui tient", () => {
    const v = withinCeiling(CEILING, { topics: 57, spentUsd: 0 });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.estimateUsd).toBeCloseTo(0.57, 5);
  });

  /*
   * ⚠ C'EST LA BORNE QUI TIENT QUAND LE PRIX EST FAUX. Un prix par post
   * sous-estimé rendrait la borne en dollars muette ; celle-ci refuse quand même.
   */
  it("elle refuse même quand les dollars tiendraient", () => {
    const v = withinCeiling(
      { capUsd: 1000, estimatedCostPerPostUsd: 0.0001, maxTopics: 60 },
      { topics: 1331, spentUsd: 0 }
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.bound).toBe("count");
    expect(v.refusal, "le refus ne dit pas les deux nombres").toContain("1331 sujets");
    expect(v.refusal).toContain("plafond de 60");
    expect(v.refusal).toContain("rien n'a été dépensé");
  });
});

describe("la borne des dollars compte le mois, pas l'appel", () => {
  /*
   * ⚠ UN PLAFOND PAR APPEL SE CONTOURNE EN APPELANT DEUX FOIS, et une reprise le
   * fait par construction : elle repart avec ce que le premier passage a payé.
   */
  it("un déjà-dépensé rapproche du plafond", () => {
    expect(withinCeiling(CEILING, { topics: 40, spentUsd: 0 }).ok).toBe(true);
    const v = withinCeiling(CEILING, { topics: 40, spentUsd: 0.7 });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.bound).toBe("spend");
    expect(v.refusal).toContain("0.7000");
    expect(v.refusal).toContain("0.4000");
  });

  it("pile au plafond passe, au-dessus refuse", () => {
    expect(withinCeiling(CEILING, { topics: 50, spentUsd: 0.5 }).ok).toBe(true);
    expect(withinCeiling(CEILING, { topics: 51, spentUsd: 0.5 }).ok).toBe(false);
  });

  it("un plafond à zéro refuse tout, y compris un seul sujet", () => {
    const v = withinCeiling({ ...CEILING, capUsd: 0 }, { topics: 1, spentUsd: 0 });
    expect(v.ok).toBe(false);
  });
});

/*
 * ⚠ ET LE NOMBRE EST TESTÉ AVANT LES DOLLARS, exprès. Le refus le plus utile est
 * celui qui nomme la cause : « la liste suit la banque » dit quoi corriger, « le
 * plafond est franchi » envoie régler le plafond.
 */
describe("l'ordre des deux bornes", () => {
  it("quand les deux sont franchies, c'est le nombre qui parle", () => {
    const v = withinCeiling(CEILING, { topics: 1331, spentUsd: 0.99 });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.bound).toBe("count");
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  ⚠ ET AUCUN APPELANT NE PEUT L'OUBLIER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La leçon de F56 : un paramètre facultatif finit par ne pas être passé. Le
 * plafond est donc un champ OBLIGATOIRE de `OrchestrateInput`, sans valeur par
 * défaut — une valeur par défaut est un plafond hérité que personne ne relit.
 */
describe("le plafond ne peut pas être oublié", () => {
  const source = readFileSync("lib/content/month/orchestrate.ts", "utf8");

  it("il est obligatoire dans l'entrée de l'orchestrateur", () => {
    expect(source, "le plafond est redevenu facultatif").toMatch(/^ {2}ceiling: SpendCeiling;$/m);
    expect(source).not.toMatch(/ceiling\?:/);
    expect(source, "une valeur par défaut est un plafond que personne ne relit").not.toMatch(
      /input\.ceiling\s*\?\?/
    );
  });

  /*
   * ⚠ ET IL EST CONSULTÉ AVANT LE PORT, pas après. Un plafond qui constate le
   * dépassement n'est pas un plafond : un lot est facturé à la SOUMISSION.
   */
  it("il est consulté avant l'appel de rédaction", () => {
    const check = source.indexOf("withinCeiling(input.ceiling");
    const call = source.indexOf("ports.writer.write(");
    expect(check, "l'orchestrateur ne consulte plus le plafond").toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(check, "le plafond est consulté APRÈS la dépense").toBeLessThan(call);
  });
});
