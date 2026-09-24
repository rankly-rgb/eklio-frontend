import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { failureFamily, validateCopy, collectCopy } from "@/lib/content/generate/copy-batch";

/*
 * ── ⚠ TROIS LOTS SONT REVENUS SANS UNE SEULE RÉPONSE, ET LE RAPPORT A DIT
 *      « LE MOIS NE PASSE PAS SES CONTRÔLES » ─────────────────────────────
 *
 * Mesuré le 2026-09-24, en mesurant. Le solde du compte fournisseur s'est
 * épuisé pendant la session : les trois lots de 72 candidats sont revenus
 * `{"succeeded":0,"errored":72}`, et le harnais a continué.
 *
 * Quatre choses ont menti à la suite :
 *
 *   1. le motif d'échec : « schema », 216 fois — « le modèle a rendu une
 *      forme invalide ». Il n'avait rien rendu du tout ;
 *   2. l'entonnoir : « 72 générés, 0 conformes », soit un taux de conformité
 *      de zéro pour cent sur une écriture qui n'avait pas eu lieu ;
 *   3. le verdict du mois : `month.short` — un mois court, donc un défaut de
 *      génération ;
 *   4. l'attente elle-même n'avait aucune borne.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

describe("trois familles, distinguées à la source", () => {
  /*
   * ⚠ ELLES APPELLENT TROIS GESTES DIFFÉRENTS : recharger un compte, corriger
   * un lecteur, relire une ligne. Les confondre, c'est faire le mauvais.
   */
  it("le fournisseur, le technique et le refus ne se mélangent pas", () => {
    for (const r of ["errored", "expired", "canceled", "overloaded", "rate_limited", "no_credit"]) {
      expect(failureFamily(r), r).toBe("unavailable");
    }
    for (const r of ["not_json", "unknown_topic", "unknown_archetype", "no_message"]) {
      expect(failureFamily(r), r).toBe("technical");
    }
    for (const r of ["over_budget", "payload_shape", "missing_fields", "caption_too_long"]) {
      expect(failureFamily(r), r).toBe("refused");
    }
  });

  /*
   * ⚠ LE DÉFAUT EST `refused`, ET DANS CE SENS-LÀ SEULEMENT. Un motif inconnu
   * décrit une réponse reçue et jugée ; le ranger en `unavailable` effacerait
   * un essai réel de la mesure, ce qui est le pire des deux.
   */
  it("un motif inconnu est un refus, jamais une indisponibilité", () => {
    expect(failureFamily("quelque chose de neuf")).toBe("refused");
    expect(failureFamily(undefined)).toBe("refused");
  });

  it("la validation ne rend jamais `unavailable` : elle ne voit que des réponses", () => {
    expect(validateCopy("single_statement", "pas du json").family).toBe("technical");
    expect(validateCopy("single_statement", JSON.stringify({ payload: {}, caption: "a", alt_text: "b" })).family)
      .toBe("refused");
  });

  /* ⚠ Et une entrée de lot non aboutie porte le mot du fournisseur. */
  it("une entrée de lot en erreur est une indisponibilité", () => {
    const out = collectCopy(
      [{ custom_id: "t1", result: { type: "errored" } }],
      new Map([["t1", "single_statement"]])
    );
    expect(out[0]).toMatchObject({ ok: false, reason: "errored", family: "unavailable" });
  });

  /*
   * ⚠ UNE ENTRÉE QUI A ABOUTI MAIS DONT LE MESSAGE MANQUE EST DE NOTRE CÔTÉ.
   * Les deux ne se confondent pas : l'une se règle chez le fournisseur,
   * l'autre dans ce fichier.
   */
  it("une entrée aboutie sans message est un défaut technique", () => {
    const out = collectCopy(
      [{ custom_id: "t1", result: { type: "succeeded" } }],
      new Map([["t1", "single_statement"]])
    );
    expect(out[0]).toMatchObject({ reason: "no_message", family: "technical" });
  });
});

describe("l'entonnoir ne confond pas « refusé » et « jamais tenté »", () => {
  it("il compte les réponses, pas les résultats", () => {
    expect(SOURCE).toContain("answered: 0,");
    expect(SOURCE).toContain("neverAnswered: 0,");
    expect(SOURCE).toContain("technicalFailures: 0,");
    expect(SOURCE).not.toContain("funnel.generated");
  });

  /*
   * ⚠ COMPTÉ PAR FAMILLE, PAS PAR PRÉSENCE D'UN RÉSULTAT. Un candidat dont le
   * lot a erré porte un résultat — d'échec — et le compter comme « généré »
   * est exactement ce qui a produit « 72 générés, 0 conformes ».
   */
  it("un résultat d'échec n'est pas une réponse", () => {
    expect(SOURCE).toContain('if (c.result.family === "unavailable") funnel.neverAnswered += 1;');
    expect(SOURCE).toContain('else if (c.result.family === "technical") funnel.technicalFailures += 1;');
  });

  it("le motif d'échec vient de la famille, il ne se devine plus", () => {
    expect(SOURCE).toContain('const family = result.family ?? "refused";');
    expect(SOURCE).toContain('family === "unavailable" ? "fournisseur"');
  });
});

describe("un lot sans réponse arrête le run avant tout verdict de contenu", () => {
  it("il s'arrête, et il dit que rien n'a été tenté", () => {
    const at = SOURCE.indexOf("const counts = status.request_counts;");
    expect(at).toBeGreaterThan(-1);
    const block = SOURCE.slice(at, at + 1200);
    expect(block).toContain("counts.succeeded === 0 && counts.errored > 0");
    expect(block).toContain("neverRan: true");
    expect(block).toContain("Aucun essai n'a eu lieu");
  });

  /*
   * ⚠ AVANT LA SÉLECTION. Poursuivre produisait `month.short` — un verdict de
   * CONTENU — pour une écriture qui n'avait pas eu lieu, et c'est ce
   * verdict-là qu'on lit en premier.
   */
  it("il s'arrête avant les contrôles de mois", () => {
    expect(SOURCE.indexOf("const counts = status.request_counts;"))
      .toBeLessThan(SOURCE.indexOf("const selection = selectDeliverable("));
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

  it("le journal est écrit avant l'attente", () => {
    const remembered = SOURCE.indexOf("journal = rememberBatch(journal, batch.id");
    expect(remembered).toBeGreaterThan(-1);
    expect(remembered).toBeLessThan(SOURCE.indexOf("const BATCH_DEADLINE_MS"));
  });
});
