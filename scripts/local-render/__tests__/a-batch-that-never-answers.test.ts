import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ TROIS LOTS SONT REVENUS SANS UNE SEULE RÉPONSE, ET LE RAPPORT A DIT
 *      « LE MOIS NE PASSE PAS SES CONTRÔLES » ─────────────────────────────
 *
 * Mesuré le 2026-09-24, en mesurant. Le solde du compte fournisseur s'est
 * épuisé pendant la session : les trois lots de 72 candidats sont revenus
 * `{"succeeded":0,"errored":72}`, et le harnais a continué comme si de rien
 * n'était.
 *
 * Trois choses ont menti à la suite :
 *
 *   1. le motif d'échec : « schema », deux cent seize fois, c'est-à-dire « le
 *      modèle a rendu une forme invalide ». Il n'avait rien rendu du tout ;
 *   2. le verdict du mois : `month.short`, un mois court — donc un défaut de
 *      génération, alors qu'il n'y avait pas eu de génération ;
 *   3. l'attente elle-même n'avait aucune borne : un lot qui n'aboutit jamais
 *      laissait le run tourner indéfiniment.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

describe("l'échec du fournisseur porte son nom", () => {
  /*
   * ⚠ « sinon, schema » RANGE SOUS LE SEUL MOTIF QU'ON SAIT NOMMER tout ce
   * qu'on ne sait pas nommer — y compris ce qui n'est pas de notre côté.
   */
  it("une entrée de lot en erreur n'est pas un défaut de forme", () => {
    expect(SOURCE).toContain('const PROVIDER = new Set(["errored", "expired", "canceled"]);');
    expect(SOURCE).toContain('PROVIDER.has(result.reason ?? "") ? "provider"');
  });

  it("un JSON illisible n'est pas un défaut de forme non plus", () => {
    expect(SOURCE).toContain('result.reason === "not_json" ? "not JSON"');
  });
});

describe("l'attente d'un lot a une borne", () => {
  /*
   * ⚠ Six mesures donnent vingt-cinq à trente minutes pour un lot.
   * Quatre-vingt-dix est trois fois la durée observée : ce qui dépasse n'est
   * plus une attente.
   */
  it("elle s'arrête, et elle dit que le lot est payé", () => {
    expect(SOURCE).toContain("const BATCH_DEADLINE_MS = 90 * 60 * 1000;");
    expect(SOURCE).toMatch(/n'a pas abouti en 90 minutes/);
    expect(SOURCE).toMatch(/il est payé et le journal le garde/);
  });

  /* ⚠ Et abandonner l'attente ne perd pas le lot : le journal porte ses sujets. */
  it("le journal est écrit avant l'attente", () => {
    const remembered = SOURCE.indexOf("journal = rememberBatch(journal, batch.id");
    const waiting = SOURCE.indexOf("const BATCH_DEADLINE_MS");
    expect(remembered).toBeGreaterThan(-1);
    expect(remembered).toBeLessThan(waiting);
  });
});

describe("un lot sans réponse le dit avant qu'on relise le mois", () => {
  it("il est signalé dès la fin du lot", () => {
    const at = SOURCE.indexOf("const counts = status.request_counts;");
    expect(at).toBeGreaterThan(-1);
    const block = SOURCE.slice(at, at + 600);
    expect(block).toContain("counts.succeeded === 0 && counts.errored > 0");
    expect(block).toContain("Ce n'est pas un défaut d'écriture");
  });

  /*
   * ⚠ AVANT LA SÉLECTION, pas dans le rapport final : c'est `month.short` qu'on
   * lit d'abord quand il n'y a rien, et il envoie chercher le défaut du mauvais
   * côté.
   */
  it("il est signalé avant les contrôles de mois", () => {
    expect(SOURCE.indexOf("const counts = status.request_counts;"))
      .toBeLessThan(SOURCE.indexOf("const selection = selectDeliverable("));
  });
});
