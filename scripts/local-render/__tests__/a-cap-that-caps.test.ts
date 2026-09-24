import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * ── ⚠ `capUsd: 2` FIGURAIT AU BAS DE CHAQUE RAPPORT, ET N'ARRÊTAIT RIEN ──
 *
 * La constante existait, elle était juste, elle était publiée à côté du coût
 * réel — et personne ne la lisait. Une valeur exacte, au bon endroit, branchée
 * d'un seul côté : la classe de F27, trouvée dans le harnais qui la recense.
 *
 * ⚠ ET ELLE NE POUVAIT PAS SE MESURER SUR LE LEDGER. `spentSoFarUsd` somme
 * TOUT l'historique — 10,82 $ au 2026-09-24 — donc un plafond comparé à lui
 * aurait refusé tout run, pour toujours. C'est probablement pour ça qu'il n'a
 * jamais été branché.
 */
const LIB = readFileSync("scripts/local-render/lib.ts", "utf8");
const MONTH = readFileSync("scripts/local-render/20-month.ts", "utf8");

describe("le plafond arrête quelque chose", () => {
  it("il lève quand le run le franchit", () => {
    expect(LIB).toContain("export function noteSpend(usd: number, what: string): void {");
    expect(LIB).toContain("if (spentThisRun > SESSION_CAP_USD) {");
  });

  /*
   * ⚠ IL COMPTE CE QUE CE RUN DÉPENSE, pas ce que la base porte. Les deux
   * grandeurs ont le même nom et ne mesurent pas la même chose.
   */
  it("il compte le run, pas l'historique", () => {
    expect(LIB).toContain("let spentThisRun = 0;");
    expect(LIB).not.toMatch(/spentThisRun\s*=\s*await spentSoFarUsd/);
  });

  /*
   * ⚠ AU GOULOT, PAS À CÔTÉ. Frais généraux et crédits de post se soldent au
   * même endroit : compter ailleurs aurait compté la moitié.
   */
  it("il est appelé là où chaque dollar passe", () => {
    const settle = MONTH.indexOf("async settle(reservationId, costUsd, succeeded) {");
    expect(settle).toBeGreaterThan(-1);
    expect(MONTH.slice(settle, settle + 700)).toContain("noteSpend(costUsd,");
  });

  it("le rapport dit ce que le run a dépensé, pas seulement le plafond", () => {
    expect(MONTH).toContain("spentThisRunUsd: Number(runSpendUsd().toFixed(5)),");
  });

  /* ⚠ Et il se relève par commande, en connaissance de cause. */
  it("il se relève par variable d'environnement", () => {
    expect(LIB).toContain("Number(process.env.CONTENT_SESSION_CAP_USD)");
  });
});
