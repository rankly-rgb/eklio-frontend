import { describe, expect, it } from "vitest";
import { CombinedCheckoutClosedError, createCheckoutSession } from "@/lib/stripe/checkout";
import { KIT_AND_MONTHLY_PRESENCE_IN_ONE_CHECKOUT } from "@/lib/billing/plans";

/*
 * F62 — le kit et Monthly Presence ne s'achètent plus dans la même session.
 *
 * Joué le 2026-09-27 : case cochée, le checkout passait en mode `subscription`,
 * la session n'avait pas de payment intent, et `charge.refunded` ne retrouvait
 * pas le kit — un remboursement le laissait ouvert.
 *
 * ⚠ LE TEST APPELLE LA VRAIE FONCTION. Une doublure de base répond « vendable,
 * rien d'acheté » ; aucune variable Stripe n'est posée. Si la garde tient, la
 * fonction refuse AVANT d'atteindre Stripe ; sinon elle tombe sur
 * `StripeConfigError` en cherchant sa clé — et le test le dit.
 */
function fakeSupabase() {
  const chain = (rows: unknown) => {
    const node = {
      select: () => node,
      eq: () => node,
      maybeSingle: async () => ({ data: rows, error: null }),
      then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: [], error: null }),
    };
    return node;
  };
  return {
    from: (table: string) =>
      table === "plans"
        ? chain({ sellable: true, requires_publishable_platform: false })
        : chain(null),
  } as never;
}

describe("⚠ F62 : un kit se paie seul", () => {
  it("le panier combiné est fermé", () => {
    expect(KIT_AND_MONTHLY_PRESENCE_IN_ONE_CHECKOUT).toBe(false);
  });

  it("le serveur REFUSE la case cochée, avant tout appel à Stripe", async () => {
    await expect(
      createCheckoutSession(fakeSupabase(), {
        userId: "u",
        email: "a@b.c",
        tier: "starter",
        projectId: null,
        withMonthlyPresence: true,
      })
    ).rejects.toBeInstanceOf(CombinedCheckoutClosedError);
  });

  it("Signature n'est pas concerné : ses trois mois ne passent pas par la case", async () => {
    // La case est sans objet pour Signature ; la fonction continue et n'échoue
    // qu'en cherchant la clé Stripe absente — preuve que la garde l'a laissé passer.
    await expect(
      createCheckoutSession(fakeSupabase(), {
        userId: "u",
        email: "a@b.c",
        tier: "signature",
        projectId: null,
        withMonthlyPresence: true,
      })
    ).rejects.not.toBeInstanceOf(CombinedCheckoutClosedError);
  });
});
