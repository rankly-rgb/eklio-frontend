import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ LE CHEMIN BATCH NE RÉSERVAIT AUCUN CRÉDIT ────────────────────────
 *
 * Mesuré le 2026-09-23 : dix mois générés dans la session, et `credit_ledger`
 * n'avait pas gagné UNE ligne. `reserve` n'était appelé que dans la branche
 * synchrone. `quotaRefusals` valait 0 partout — pas parce que le quota tenait,
 * mais parce que personne ne le consultait.
 *
 * ⚠ ET C'EST LE CHEMIN DE PRODUCTION. Le synchrone ne sert qu'au PREMIER mois
 * d'un compte — « une nouvelle abonnée n'attend pas trente minutes ». Tous les
 * mois suivants passent par le lot. Le quota de trente crédits
 * `post_generation` n'était donc appliqué qu'une seule fois par praticienne,
 * et jamais ensuite.
 *
 * Même famille que F18, F19 et F21 : une grandeur existait, elle était juste,
 * et elle n'était branchée que d'un côté.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

/*
 * ⚠ LES BORNES SONT DES MARQUEURS DISTINCTIFS, PAS DES ACCOLADES. Découper sur
 * « } else { » attrapait le `else` INTERNE de la reprise de lot — quatre
 * espaces au lieu de deux, mais l'un contient l'autre — et la branche Batch
 * s'arrêtait donc avant la moitié de son code.
 */
const SYNC_MARKER = "⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE";
const branch = (from: string, to: string) => {
  const a = SOURCE.indexOf(from);
  const b = SOURCE.indexOf(to);
  expect(a, `borne introuvable : ${from}`).toBeGreaterThan(-1);
  expect(b, `borne introuvable : ${to}`).toBeGreaterThan(a);
  return SOURCE.slice(a, b);
};

describe("le quota tient sur les deux chemins", () => {
  const batch = branch("  if (useBatch) {", SYNC_MARKER);

  it("le chemin Batch réserve avant de soumettre", () => {
    const reserveAt = batch.indexOf("await reserve(`month ${MONTH}");
    expect(reserveAt, "aucune réservation dans la branche Batch").toBeGreaterThan(-1);
    // ⚠ Avant `batches.create` : le lot est facturé à la soumission, donc
    // réserver après serait réserver pour une dépense déjà faite.
    expect(reserveAt).toBeLessThan(batch.indexOf("client.messages.batches.create"));
  });

  it("un refus de quota est compté, pas avalé", () => {
    expect(batch).toContain("funnel.quotaRefusals += 1;");
  });

  it("le chemin synchrone réserve toujours", () => {
    expect(branch(SYNC_MARKER, "/* ── Les contrôles de mois")).toContain("await reserve(`month ${MONTH}");
  });

  /*
   * Le lot ne part qu'avec ce qui est payé : un candidat refusé au quota en
   * sort, sinon on paierait un appel pour un post qu'on ne peut pas livrer.
   */
  it("le lot ne porte que les candidats réservés", () => {
    expect(batch).toContain("const withinQuota: Candidate[] = [];");
    expect(batch.indexOf("asked.push(...withinQuota);"))
      .toBeLessThan(batch.indexOf("const requests = asked.map(asRequest);"));
  });
});
