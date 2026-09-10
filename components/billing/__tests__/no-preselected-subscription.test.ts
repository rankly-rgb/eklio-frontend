import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MONTHLY_PRESENCE } from "@/lib/billing/plans";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * AUCUN ABONNEMENT PRÉ-COCHÉ, JAMAIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le checkout a proposé Monthly Presence — 39 $/mois, récurrent — COCHÉ par
 * défaut, greffé sur un achat unique, à des consommateurs américains. C'est
 * une option négative : elle est facturée sauf si elle remarque et décoche.
 *
 * Décocher ne demande l'avis de personne ; c'est l'état que nul n'a à
 * défendre. Qui veut l'abonnement coche une case au passage, et cette coche
 * EST le consentement exprès que la règle demande.
 *
 * ⚠ CE N'EST PAS UN TEST DE RENDU. La valeur qui a causé le défaut est un
 * `useState(true)`, et c'est cette valeur qu'on garde — un test de rendu
 * repasserait au vert si quelqu'un recochait la case dans un `useEffect`.
 */

const ROOT = resolve(__dirname, "../../..");
const FORM = readFileSync(join(ROOT, "components/billing/checkout-form.tsx"), "utf8");

describe("la case de l'abonnement", () => {
  it("part décochée", () => {
    expect(FORM).toContain("useState(false)");
    // ⚠ LE CANARI : la ligne exacte qui était en production.
    expect(FORM).not.toMatch(/setWithMonthlyPresence\s*\]\s*=\s*useState\(true\)/);
    expect(FORM).not.toContain("defaultChecked");
  });

  it("et rien ne la recoche après coup", () => {
    // Un `useEffect` qui la remettrait à true serait le même défaut par un
    // autre chemin, et il passerait un test de valeur initiale seul.
    expect(FORM).not.toMatch(/setWithMonthlyPresence\(true\)/);
  });

  it("le serveur ne l'ajoute que si elle l'a demandée", () => {
    const checkout = readFileSync(join(ROOT, "lib/stripe/checkout.ts"), "utf8");
    // La ligne récurrente est SOUS condition, jamais inconditionnelle.
    expect(checkout).toMatch(/if\s*\(\s*withMonthlyPresence\s*&&/);
  });
});

describe("et la page de tarifs ne dit plus le contraire", () => {
  it("elle n'annonce plus un ajout par défaut", () => {
    // La promesse et le comportement doivent bouger ensemble : laisser
    // « Added by default » sur une case décochée serait la même incohérence
    // dans l'autre sens.
    expect(JSON.stringify(MONTHLY_PRESENCE)).not.toMatch(/Added by default/i);
  });

  it("elle dit qu'il faut la cocher", () => {
    expect(MONTHLY_PRESENCE.addOnMicrocopy).toMatch(/Off unless you add it/);
  });
});
