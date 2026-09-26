import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { withCallCeiling, CeilingReachedError } from "@/lib/content/generate/ceiling";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLAFOND DE DÉPENSE N'A PLUS D'APPELANT — ET C'EST F45 QUI L'A CRÉÉ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `withCallCeiling` était appelé par `lib/content/generate/pipeline.ts`, que F45 a
 * supprimé le 2026-09-26. Son test l'éprouvait À TRAVERS `generateMonth` : le
 * fichier parti, la couverture partait avec lui.
 *
 * ⚠ C'EST UN MÉCANISME BRANCHÉ D'UN SEUL CÔTÉ, ET C'EST MOI QUI L'AI FABRIQUÉ.
 * Toute la série F46-F57 porte sur des mécanismes dont l'appelant n'est jamais
 * arrivé ; celui-ci avait un appelant et je l'ai retiré. Le retrait d'un
 * générateur laisse des mécanismes justes sans personne pour s'en servir, et ne
 * pas le dire serait exactement ce que F48 reproche.
 *
 * Ce fichier fait deux choses : il éprouve le mécanisme DIRECTEMENT, pour que la
 * couverture ne dépende plus d'un appelant, et il DIT que l'appelant manque.
 *
 * ⚠ SA PLACE FUTURE EST CONNUE : `WriterPort` dans
 * `lib/content/month/orchestrate.ts` est le seul accès payant de tout
 * l'enchaînement. Un plafond de dépense s'y pose en une ligne, et il devra y être
 * posé avant que la route quitte le 501.
 */

describe("le plafond, éprouvé sans son appelant", () => {
  /** Un modèle qui compte ce qu'on lui demande, et rien d'autre. */
  function counting() {
    let calls = 0;
    const model = {
      label: "counting",
      async writeThemes() {
        calls += 1;
        return { themes: [], source: "derived_brief" as const, sourceText: null };
      },
      async writeOnImageLine() {
        calls += 1;
        return "ligne";
      },
      async writeCaption() {
        calls += 1;
        return "légende";
      },
      async writeAltText() {
        calls += 1;
        return "alternatif";
      },
      async rewrite() {
        calls += 1;
        return "réécrit";
      },
    } as unknown as Parameters<typeof withCallCeiling>[0];
    return { model, calls: () => calls };
  }

  it("il laisse passer tant que la borne n'est pas atteinte, et compte", async () => {
    const stub = counting();
    const { model, ledger } = withCallCeiling(stub.model, 3);
    await model.writeCaption({ register: "plain" } as never);
    await model.writeAltText({ archetype: "single_statement" } as never);
    expect(stub.calls()).toBe(2);
    expect(ledger.remaining()).toBe(1);
    expect(ledger.calls).toEqual(["caption:plain", "alt_text:single_statement"]);
  });

  /*
   * ⚠ IL REFUSE AVANT D'APPELER, PAS APRÈS. Refuser après aurait déjà dépensé —
   * un plafond qui constate le dépassement n'est pas un plafond.
   */
  it("il refuse avant d'appeler quand la borne serait franchie", async () => {
    const stub = counting();
    const { model } = withCallCeiling(stub.model, 1);
    await model.writeCaption({ register: "plain" } as never);
    await expect(model.writeAltText({ archetype: "x" } as never)).rejects.toThrow(
      CeilingReachedError
    );
    expect(stub.calls(), "il a appelé le modèle, donc il a dépensé").toBe(1);
  });

  /*
   * ⚠ ET IL REJETTE, IL NE LÈVE PAS SYNCHRONEMENT. Une méthode typée comme rendant
   * une promesse mais qui lève tout de suite échappe au `.catch()` de tout appelant
   * qui n'entoure pas aussi l'appel d'un `try` : le refus sortirait en exception
   * non attrapée au lieu d'une promesse rejetée.
   */
  it("le refus est une promesse rejetée", async () => {
    const { model } = withCallCeiling(counting().model, 0);
    const promise = model.writeCaption({ register: "plain" } as never);
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toThrow(/Ceiling reached/);
  });
});

describe("et son appelant manque, ce qui est dit plutôt que tu", () => {
  it("aucun fichier de production ne l'appelle encore", () => {
    /*
     * ⚠ CE TEST TOMBE LE JOUR OÙ ON LE BRANCHE, et c'est le signal de le
     * réécrire — pas de le supprimer. Un test qui affirme une absence doit mourir
     * quand l'absence cesse, sinon il devient un mensonge vert.
     */
    const orchestrator = readFileSync("lib/content/month/orchestrate.ts", "utf8");
    expect(
      orchestrator.includes("withCallCeiling"),
      "le plafond est branché sur l'orchestrateur : réécris ce test, il a fait son travail"
    ).toBe(false);
  });
});
