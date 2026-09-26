import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ⚠ ANCRÉ SUR L'ACTE, PAS SUR L'EN-TÊTE DE BOUCLE. Ces tranches cherchaient
 * « for (const [index, post] of selection.chosen.entries()) » en toutes
 * lettres ; la boucle est devenue une file indexée le 2026-09-26, pour qu'un
 * `insert` refusé prenne un remplaçant au même créneau, et trois tests sont
 * tombés sans qu'une seule de leurs garanties ait bougé. L'`insert` lui-même ne
 * peut pas être reformulé sans changer de sens.
 */
const WRITE_LOOP_ANCHOR = 'db.from("content_items").insert({';


/*
 * ── ⚠ LE QUOTA SE TIENT SUR CE QUI EST LIVRÉ, PAS SUR CE QU'ON TENTE ────
 *
 * Ce fichier a d'abord exigé l'inverse, et il avait tort.
 *
 * Premier constat, juste : le chemin Batch ne réservait AUCUN crédit. Dix
 * mois, trois cents posts, `credit_ledger` inchangé (F25). `reserve` n'était
 * appelé que dans la branche synchrone — et Batch est le chemin de
 * production, le synchrone ne servant qu'au premier mois d'un compte.
 *
 * Première correction, fausse : réserver un crédit `post_generation` PAR
 * CANDIDAT, sur les deux chemins. ⚠ Mesuré dès l'essai suivant : sur
 * soixante-douze candidats, le lot n'en portait que VINGT-NEUF. Le quota
 * accorde trente posts par mois ; quarante-deux réservations étaient donc
 * refusées d'entrée, et le banc — ce qui permet d'échanger un post refusé —
 * ne pouvait pas exister.
 *
 * Le quota n'avait pas tort, le raisonnement si. **La praticienne a acheté
 * trente POSTS, pas soixante-douze tentatives.** Qu'il en faille soixante-
 * douze pour en obtenir trente conformes est le coût de la qualité, et c'est
 * le nôtre : les candidatures sont des frais généraux, et le crédit se prend
 * à l'écriture.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

const SYNC_MARKER = "⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE";

const slice = (from: string, to: string) => {
  const a = SOURCE.indexOf(from);
  const b = SOURCE.indexOf(to);
  expect(a, `borne introuvable : ${from}`).toBeGreaterThan(-1);
  expect(b, `borne introuvable : ${to}`).toBeGreaterThan(a);
  return SOURCE.slice(a, b);
};

describe("la phase de candidature est un frais général", () => {
  /*
   * ⚠ RÉSERVÉE AVANT `batches.create`. Un lot est facturé à la soumission :
   * réserver après, c'est réserver pour une dépense déjà faite, et un quota
   * épuisé découvert à ce moment-là ne peut plus rien empêcher.
   */
  it("elle est réservée avant la soumission du lot", () => {
    const reserveAt = SOURCE.indexOf('reason: `month ${MONTH}: candidate generation`');
    expect(reserveAt, "la phase n'est pas réservée").toBeGreaterThan(-1);
    expect(reserveAt).toBeLessThan(SOURCE.indexOf("client.messages.batches.create"));
  });

  it("elle est prise en `overhead`, donc sans prendre de crédit", () => {
    const at = SOURCE.indexOf("const phaseReservation = await credits.reserve({");
    expect(SOURCE.slice(at, at + 200)).toContain('kind: "overhead"');
  });

  /* ⚠ Et soldée au coût réel, que le mois aboutisse ou non. */
  it("elle est soldée au coût réel avant le verdict", () => {
    const settleAt = SOURCE.indexOf("if (phaseReservation) {");
    expect(settleAt).toBeGreaterThan(-1);
    expect(settleAt).toBeLessThan(SOURCE.indexOf("const selection = selectDeliverable("));
    expect(SOURCE.slice(settleAt, settleAt + 300)).toContain("batchCostUsd([usage])");
  });

  /*
   * ⚠ AUCUN DES DEUX CHEMINS NE PREND UN CRÉDIT PAR CANDIDAT. C'est ce qui
   * rendait le banc impossible, et c'est la ligne qu'il ne faut pas
   * réintroduire.
   */
  it("ni le lot ni le synchrone ne réservent par candidat", () => {
    const batch = slice("  if (useBatch) {", SYNC_MARKER);
    const sync = slice(SYNC_MARKER, "/* ── Les contrôles de mois");
    for (const [name, block] of [["batch", batch], ["sync", sync]] as const) {
      expect(block, `${name} réserve encore par candidat`)
        .not.toContain("await reserve(`month ${MONTH}");
    }
  });
});

describe("le crédit se prend à l'écriture du post", () => {
  const writeLoop = slice(WRITE_LOOP_ANCHOR, "clearJournal(journal);");

  it("un crédit est réservé par post écrit", () => {
    expect(writeLoop).toContain("const reservationId = await reserve(`month ${MONTH}");
  });

  it("un refus de quota arrête l'écriture et se compte", () => {
    expect(writeLoop).toContain("funnel.quotaRefusals += 1;");
    expect(writeLoop).toContain('kind: "quota"');
  });

  /*
   * ⚠ ET IL NE SE CONSOMME QU'À LA LIVRAISON. Soldé dans la boucle, un mois
   * refusé prenait ses trente crédits pour des posts que personne ne recevra.
   * Mesuré : le deuxième essai d'un compte ne pouvait plus réserver que deux
   * candidats sur soixante-douze.
   */
  it("le règlement attend le verdict", () => {
    expect(writeLoop).toContain("delivered.push(candidate);");
    expect(writeLoop).not.toContain("syncCostUsd(candidate.usage), true)");
    const verdict = SOURCE.indexOf("const monthPasses = selection.remaining.length === 0;");
    expect(verdict).toBeGreaterThan(SOURCE.indexOf("delivered.push(candidate);"));
  });
});
