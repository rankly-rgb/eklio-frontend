import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isEntitledToMonthlyPresence } from "@/lib/billing/entitlements";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { SURFACES, SURFACE_MIN_TIER } from "@/lib/billing/surfaces";
import { KIT_TIERS } from "@/lib/kit/tiers";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * L'ACHAT UNIQUE ET L'ABONNEMENT SONT INDÉPENDANTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Practice Suite comprend trois mois de Monthly Presence : les deux choses
 * arrivent par le même paiement, le même jour, sur le même écran. C'est
 * précisément pour ça qu'il faut prouver qu'elles ne partagent aucune entrée.
 *
 * Le webhook a sa propre moitié de cette preuve (cf.
 * `lib/stripe/__tests__/webhook.test.ts`, « indépendance de l'achat et de
 * l'abonnement ») : aucun event d'abonnement n'écrit dans `purchases`, aucun
 * event de remboursement n'écrit dans `subscriptions`. Ici on prouve l'autre
 * moitié — celle des DROITS, en aval.
 */

function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* ── SENS 1 : résilier ne retire QUE Monthly Presence ─────────────────── */

describe("résilier ne retire que le contenu mensuel", () => {
  it("l'abonnement résilié n'ouvre plus rien de mensuel", () => {
    for (const status of ["canceled", "incomplete_expired", "unpaid"]) {
      expect(
        isEntitledToMonthlyPresence({
          status,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: "sub_1",
        }),
        status
      ).toBe(false);
    }
  });

  /*
   * ⚠ ET TOUTES LES SURFACES DE PRACTICE SUITE RESTENT OUVERTES. C'est la
   * phrase du lot, écrite comme une assertion : « le kit, et toutes les
   * surfaces Practice Suite, sont à elle définitivement ».
   *
   * La preuve est structurelle autant que numérique : `surfaceAccess` ne prend
   * QUE le palier acheté. Il n'existe aucun argument par lequel un abonnement
   * résilié pourrait l'atteindre.
   */
  it("mais toutes les surfaces du palier acheté restent ouvertes", () => {
    for (const surface of SURFACES) {
      expect(surfaceAccess(surface, "signature").ok, surface).toBe(true);
    }
  });

  it("y compris les surfaces réservées à Practice Suite", () => {
    const signatureOnly = SURFACES.filter(
      (surface) => SURFACE_MIN_TIER[surface] === "signature"
    );
    // Garde anti-vacuité : il y en a, et ce ne sont pas toutes les surfaces.
    expect(signatureOnly.length).toBeGreaterThan(0);
    expect(signatureOnly.length).toBeLessThan(SURFACES.length);

    for (const surface of signatureOnly) {
      expect(surfaceAccess(surface, "signature").ok, surface).toBe(true);
    }
  });

  /*
   * L'inverse du canari : le palier, lui, décide bel et bien. Sans ça,
   * l'assertion ci-dessus passerait même si `surfaceAccess` rendait
   * toujours `ok`.
   */
  it("et le palier reste ce qui décide — la garde n'est pas passive", () => {
    const refused = SURFACES.filter(
      (surface) => !surfaceAccess(surface, "starter").ok
    );
    expect(refused.length).toBeGreaterThan(0);
  });
});

/* ── SENS 2 : perdre le kit ne touche pas à l'abonnement ──────────────── */

describe("le droit mensuel ne sait rien des achats", () => {
  /*
   * `isEntitledToMonthlyPresence` ne prend qu'un abonnement. Un remboursement,
   * un litige, un palier : rien de tout ça ne peut l'atteindre, parce que rien
   * de tout ça ne lui est passé.
   */
  it("un abonnement actif ouvre le mensuel quel que soit l'état des achats", () => {
    for (const status of ["active", "trialing"]) {
      expect(
        isEntitledToMonthlyPresence({
          status,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: true,
          stripeSubscriptionId: "sub_1",
        }),
        status
      ).toBe(true);
    }
  });

  it("et sa source ne lit ni purchases ni palier", () => {
    const source = code("lib/billing/entitlements.ts");
    const fn = source.slice(source.indexOf("export function isEntitledToMonthlyPresence"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).not.toMatch(/purchases/);
    expect(body).not.toMatch(/\btier\b/);
    expect(body).not.toMatch(/entitledTier/);
  });

  it("et la garde de surface ne lit aucun abonnement", () => {
    const body = code("lib/billing/surface-access.ts");
    expect(body).not.toMatch(/subscription/i);
    expect(body).not.toMatch(/isEntitledToMonthlyPresence/);
  });
});

/* ── UNE SEULE FAÇON D'ÊTRE ABONNÉE ───────────────────────────────────── */

describe("l'essai n'est pas une seconde façon d'avoir le droit", () => {
  /*
   * ⚠ LA RÈGLE STRUCTURANTE DU LOT. `trialing` était DÉJÀ entitlant avant ce
   * lot ; les trois mois inclus n'ont donc rien appris à la fonction d'accès.
   * Si un jour quelqu'un lui ajoute un `trial_end` ou un compteur de mois
   * offerts, il y aura deux réponses à la même question, et elles finiront par
   * diverger.
   */
  it("`trialing` suffit, et rien d'autre n'est consulté", () => {
    expect(
      isEntitledToMonthlyPresence({
        status: "trialing",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
      })
    ).toBe(true);
  });

  it("la fonction d'accès ne connaît ni trial_end ni mois inclus", () => {
    const source = code("lib/billing/entitlements.ts");
    const fn = source.slice(source.indexOf("export function isEntitledToMonthlyPresence"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).not.toMatch(/trial_end|trialEnd/);
    expect(body).not.toMatch(/includedMonths|included_months/);
    expect(body).not.toMatch(/INCLUDED_MONTHLY_PRESENCE/);
  });

  // Garde anti-vacuité : on a bien isolé un corps de fonction, pas une chaîne
  // vide qui ne contiendrait évidemment rien.
  it("et le corps inspecté est bien celui de la fonction", () => {
    const source = code("lib/billing/entitlements.ts");
    const fn = source.slice(source.indexOf("export function isEntitledToMonthlyPresence"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).toMatch(/status === "trialing"/);
    expect(body).toMatch(/past_due/);
    expect(body.length).toBeGreaterThan(120);
  });
});

/* ── L'énumération elle-même ──────────────────────────────────────────── */

describe("l'énumération", () => {
  it("les paliers et les surfaces existent", () => {
    expect(KIT_TIERS.length).toBe(3);
    expect(SURFACES.length).toBeGreaterThan(10);
  });
});
