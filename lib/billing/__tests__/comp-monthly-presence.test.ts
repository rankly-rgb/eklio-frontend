import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canUseMonthlyPresence,
  type Subscription,
} from "@/lib/billing/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── L'OCTROI COMP OUVRE MONTHLY PRESENCE, ET IL L'OUVRE À UN SEUL ENDROIT ──
 *
 * `20260901182419_comp_grant_entitlement.sql` s'est arrêté sur ce manque, en
 * l'écrivant plutôt qu'en le contournant : un compte comp franchissait le mur
 * du kit et se heurtait quand même à celui de Monthly Presence. La base n'a
 * aucun point d'étranglement où OU-er le comp — elle ne tient pas d'horloge,
 * et `subscriptions.stripe_subscription_id` est `not null unique`, donc une
 * ligne fabriquée demanderait d'inventer un identifiant Stripe.
 *
 * Le manque se ferme donc en code, dans `canUseMonthlyPresence`, et ce fichier
 * garde les deux moitiés de ce qui compte :
 *
 *   1. le comp ouvre bien la surface, sans abonnement ;
 *   2. la règle d'abonnement, elle, n'a RIEN appris — elle reste un fait, pas
 *      deux. C'est la règle structurante de `independence.test.ts`, et un
 *      correctif qui l'aurait violée aurait marché tout en créant les deux
 *      réponses divergentes que ce dépôt refuse.
 */

const NOW = new Date("2026-09-15T12:00:00.000Z");

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: "sub_test",
    ...overrides,
  };
}

/**
 * Un client dont le seul comportement utile est `rpc("comp_access_active")`.
 *
 * `calls` compte les allers-retours : l'ordre des deux faits est une propriété
 * de perf qu'on teste, pas un hasard d'écriture.
 */
function clientWithComp(
  result: { data: unknown; error: unknown }
): { supabase: SupabaseClient<Database>; calls: () => number } {
  let calls = 0;
  const supabase = {
    rpc: async (name: string) => {
      if (name !== "comp_access_active") {
        throw new Error(`rpc inattendu : ${name}`);
      }
      calls += 1;
      return result;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, calls: () => calls };
}

const COMP_ON = () => clientWithComp({ data: true, error: null });
const COMP_OFF = () => clientWithComp({ data: false, error: null });

describe("canUseMonthlyPresence", () => {
  /* ⚠ LE MANQUE QUI SE FERME. Aucun abonnement, et pourtant l'accès. */
  it("un octroi comp ouvre la surface sans la moindre ligne `subscriptions`", async () => {
    const { supabase } = COMP_ON();
    await expect(canUseMonthlyPresence(supabase, null, NOW)).resolves.toBe(true);
  });

  it("sans abonnement ET sans comp, la surface reste fermée", async () => {
    const { supabase } = COMP_OFF();
    await expect(canUseMonthlyPresence(supabase, null, NOW)).resolves.toBe(false);
  });

  it("un abonnement actif suffit, comp ou pas", async () => {
    for (const make of [COMP_ON, COMP_OFF]) {
      const { supabase } = make();
      await expect(
        canUseMonthlyPresence(supabase, subscription({ status: "active" }), NOW)
      ).resolves.toBe(true);
    }
  });

  /*
   * ⚠ L'ORDRE. La règle pure est en mémoire, le comp est un aller-retour
   * réseau : une abonnée payante ne doit jamais le payer. Compté, pas supposé.
   */
  it("n'interroge pas la base quand l'abonnement a déjà répondu oui", async () => {
    const { supabase, calls } = COMP_ON();
    await canUseMonthlyPresence(supabase, subscription({ status: "active" }), NOW);
    expect(calls()).toBe(0);

    // Anti-vacuité : le compteur sait compter.
    await canUseMonthlyPresence(supabase, null, NOW);
    expect(calls()).toBe(1);
  });

  /*
   * ── ÉCHEC FERMÉ ────────────────────────────────────────────────────────
   * Une lecture comp en erreur ne doit pas ouvrir la surface : il ne reste
   * alors que l'abonnement, jamais l'inverse.
   */
  it("une erreur de lecture comp n'ouvre rien", async () => {
    const { supabase } = clientWithComp({
      data: null,
      error: { message: "boom" },
    });
    await expect(canUseMonthlyPresence(supabase, null, NOW)).resolves.toBe(false);
  });

  it("un `past_due` hors grâce n'est pas rattrapé par l'absence de comp", async () => {
    const { supabase } = COMP_OFF();
    await expect(
      canUseMonthlyPresence(
        supabase,
        subscription({
          status: "past_due",
          currentPeriodEnd: "2026-09-01T12:00:00.000Z",
        }),
        NOW
      )
    ).resolves.toBe(false);
  });
});

/* ── La règle d'abonnement n'a rien appris ─────────────────────────────── */

describe("le comp n'est pas entré dans la règle d'abonnement", () => {
  /*
   * Le pendant de `independence.test.ts` : là-bas on garde la fonction contre
   * `purchases` et les paliers, ici contre le comp. Même raison, et c'est la
   * raison qui compte : deux réponses à une même question finissent par
   * diverger, et c'est la plus permissive qui gagne.
   */
  it("le corps de `isEntitledToMonthlyPresence` ne lit aucun comp", () => {
    const source = readFileSync("lib/billing/entitlements.ts", "utf8");
    const fn = source.slice(
      source.indexOf("export function isEntitledToMonthlyPresence")
    );
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).not.toMatch(/comp/i);
    expect(body).not.toMatch(/supabase/);

    // Anti-vacuité : c'est bien un corps de fonction qu'on inspecte.
    expect(body).toMatch(/status === "trialing"/);
    expect(body).toMatch(/past_due/);
    expect(body.length).toBeGreaterThan(120);
  });

  /*
   * ⚠ ET LE PORTAIL STRIPE RESTE SUR L'ABONNEMENT NU. Un compte comp n'a aucun
   * client Stripe : lui ouvrir un portail échouerait, et lui répondre « tu es
   * abonnée » serait faux. Cette route pose la bonne question, qu'elle garde.
   */
  it("la route du portail Stripe ne passe pas par le point d'étranglement comp", () => {
    const source = readFileSync("app/api/billing/portal/route.ts", "utf8");
    expect(source).not.toMatch(/canUseMonthlyPresence/);
    expect(source).toMatch(/getSubscription/);
  });
});
