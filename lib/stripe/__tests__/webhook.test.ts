import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  HANDLED_EVENT_TYPES,
  isHandled,
  mapSubscriptionStatus,
  processStripeEvent,
  subscriptionPeriodEnd,
  subscriptionRow,
  type PurchaseRow,
  type SubscriptionRow,
  type WebhookPorts,
} from "@/lib/stripe/webhook";
import { KIT_PLANS, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { buildCheckoutMetadata } from "@/lib/stripe/metadata";

/*
 * Le webhook est le seul endroit du produit qui transforme de l'argent en
 * droit. Ces tests figent ce qui, s'il cassait, se paierait en paiements
 * encaissés sans contrepartie ou en accès accordés sans paiement.
 */

const USER = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "cus_test_123";

type Recorded = {
  events: string[];
  forgotten: string[];
  purchases: PurchaseRow[];
  subscriptions: SubscriptionRow[];
  pastDue: string[];
  links: { userId: string; customerId: string }[];
};

function makePorts(
  overrides: Partial<WebhookPorts> = {},
  seenEvents = new Set<string>()
): { ports: WebhookPorts; recorded: Recorded } {
  const recorded: Recorded = {
    events: [],
    forgotten: [],
    purchases: [],
    subscriptions: [],
    pastDue: [],
    links: [],
  };

  const ports: WebhookPorts = {
    async recordEvent(event) {
      if (seenEvents.has(event.id)) return false;
      seenEvents.add(event.id);
      recorded.events.push(event.id);
      return true;
    },
    async forgetEvent(id) {
      seenEvents.delete(id);
      recorded.forgotten.push(id);
    },
    async userIdForCustomer(customerId) {
      return customerId === CUSTOMER ? USER : null;
    },
    async linkCustomer(userId, customerId) {
      recorded.links.push({ userId, customerId });
    },
    async recordPurchase(row) {
      recorded.purchases.push(row);
    },
    async upsertSubscription(row) {
      recorded.subscriptions.push(row);
    },
    async markSubscriptionPastDue(id) {
      recorded.pastDue.push(id);
    },
    async fetchSubscription() {
      return null;
    },
    ...overrides,
  };

  return { ports, recorded };
}

function checkoutEvent(
  session: Partial<Stripe.Checkout.Session>,
  id = "evt_checkout_1"
): Stripe.Event {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        customer: CUSTOMER,
        client_reference_id: null,
        currency: "usd",
        amount_total: 14900,
        payment_status: "paid",
        payment_intent: "pi_test_1",
        subscription: null,
        metadata: buildCheckoutMetadata({
          userId: USER,
          projectId: PROJECT,
          tier: "practice",
        }),
        ...session,
      },
    },
  } as unknown as Stripe.Event;
}

function stripeSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: "sub_test_1",
    object: "subscription",
    customer: CUSTOMER,
    status: "active",
    cancel_at_period_end: false,
    metadata: {},
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          price: { id: "price_monthly_presence" },
          // 2026-03-01T00:00:00Z
          current_period_end: 1772323200,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function subscriptionEvent(
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
  subscription: Stripe.Subscription,
  id = "evt_sub_1"
): Stripe.Event {
  return {
    id,
    type,
    data: { object: subscription },
  } as unknown as Stripe.Event;
}

describe("périmètre des events traités", () => {
  it("ne traite que les cinq events du modèle économique", () => {
    expect([...HANDLED_EVENT_TYPES]).toEqual([
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ]);
    expect(isHandled("payment_intent.succeeded")).toBe(false);
  });

  it("ignore un event non traité SANS l'enregistrer", () => {
    // L'enregistrer marquerait comme « déjà traité » un event qu'on pourrait
    // vouloir traiter après une mise à jour du code.
    const { ports, recorded } = makePorts();
    return processStripeEvent(ports, {
      id: "evt_other",
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as unknown as Stripe.Event).then((outcome) => {
      expect(outcome.status).toBe("ignored");
      expect(recorded.events).toEqual([]);
    });
  });
});

describe("idempotence — stripe_events", () => {
  it("traite une fois, puis reconnaît le rejeu", async () => {
    const seen = new Set<string>();
    const first = makePorts({}, seen);
    const second = makePorts({}, seen);

    const event = checkoutEvent({});

    expect((await processStripeEvent(first.ports, event)).status).toBe(
      "processed"
    );
    expect(first.recorded.purchases).toHaveLength(1);

    // Stripe rejoue tant qu'il n'a pas reçu de 2xx : sans ce verrou, un seul
    // paiement produirait deux achats.
    expect((await processStripeEvent(second.ports, event)).status).toBe(
      "duplicate"
    );
    expect(second.recorded.purchases).toHaveLength(0);
  });

  it("retire l'event quand le traitement échoue, pour que le rejeu marche", async () => {
    const seen = new Set<string>();
    const boom = new Error("écriture refusée");
    const { ports, recorded } = makePorts(
      {
        async recordPurchase() {
          throw boom;
        },
      },
      seen
    );

    const event = checkoutEvent({});
    await expect(processStripeEvent(ports, event)).rejects.toThrow(boom);

    // Sans ce désarmement, le verrou se retournerait contre nous : le rejeu
    // verrait « déjà traité » et le paiement resterait sans droit accordé.
    expect(recorded.forgotten).toEqual([event.id]);
    expect(seen.has(event.id)).toBe(false);
  });
});

describe("checkout.session.completed", () => {
  it("enregistre l'achat payé, au montant du CATALOGUE", async () => {
    const { ports, recorded } = makePorts();

    await processStripeEvent(ports, checkoutEvent({}));

    expect(recorded.purchases).toHaveLength(1);
    const purchase = recorded.purchases[0];
    expect(purchase.userId).toBe(USER);
    expect(purchase.projectId).toBe(PROJECT);
    expect(purchase.tier).toBe("practice");
    expect(purchase.status).toBe("paid");
    expect(purchase.paidAt).not.toBeNull();
    expect(purchase.amountCents).toBe(KIT_PLANS.practice.amountCents);
    expect(purchase.paymentIntentId).toBe("pi_test_1");
  });

  it("n'enregistre PAS l'add-on comme un achat de kit", async () => {
    // `amount_total` vaut kit + premier mois quand l'add-on est gardé. Le
    // montant du kit vient donc du catalogue, jamais de la session.
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      checkoutEvent({
        amount_total:
          KIT_PLANS.practice.amountCents + MONTHLY_PRESENCE.amountCents,
      })
    );

    expect(recorded.purchases[0].amountCents).toBe(
      KIT_PLANS.practice.amountCents
    );
  });

  it("enregistre en `pending` un paiement encore non encaissé", async () => {
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      checkoutEvent({ payment_status: "unpaid" })
    );

    // `pending` n'accorde AUCUN droit — le gating exige `paid` — mais le
    // paiement asynchrone n'est pas perdu pour autant.
    expect(recorded.purchases[0].status).toBe("pending");
    expect(recorded.purchases[0].paidAt).toBeNull();
  });

  it("active l'abonnement quand l'add-on a été gardé", async () => {
    const subscription = stripeSubscription();
    const { ports, recorded } = makePorts({
      async fetchSubscription() {
        return subscription;
      },
    });

    await processStripeEvent(
      ports,
      checkoutEvent({ subscription: "sub_test_1" })
    );

    expect(recorded.subscriptions).toHaveLength(1);
    expect(recorded.subscriptions[0]).toMatchObject({
      userId: USER,
      stripeSubscriptionId: "sub_test_1",
      status: "active",
      stripePriceId: "price_monthly_presence",
    });
  });

  it("n'écrit RIEN quand ni l'utilisateur ni le tier ne sont résolus", async () => {
    const { ports, recorded } = makePorts();

    const outcome = await processStripeEvent(
      ports,
      checkoutEvent({ metadata: {}, customer: "cus_inconnu" })
    );

    // Mieux vaut un droit non accordé, réparable à la main, qu'un droit
    // accordé au mauvais compte.
    expect(outcome.status).toBe("ignored");
    expect(recorded.purchases).toEqual([]);
  });

  it("répare la correspondance customer → user quand elle manquait", async () => {
    const { ports, recorded } = makePorts({
      async userIdForCustomer() {
        return null; // la colonne n'a pas pu être écrite au checkout
      },
    });

    await processStripeEvent(ports, checkoutEvent({}));

    expect(recorded.links).toEqual([{ userId: USER, customerId: CUSTOMER }]);
    expect(recorded.purchases).toHaveLength(1);
  });
});

describe("mapping event → statut d'abonnement", () => {
  it("reprend le statut Stripe tel quel sur une mise à jour", async () => {
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      subscriptionEvent(
        "customer.subscription.updated",
        stripeSubscription({ status: "past_due" })
      )
    );

    expect(recorded.subscriptions[0].status).toBe("past_due");
  });

  it("force `canceled` sur une suppression, quel que soit le statut reçu", async () => {
    // Stripe envoie l'objet dans son dernier état connu : se fier à `status`
    // laisserait passer un `active` sur un abonnement qui vient de disparaître.
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      subscriptionEvent(
        "customer.subscription.deleted",
        stripeSubscription({ status: "active" })
      )
    );

    expect(recorded.subscriptions[0].status).toBe("canceled");
  });

  it("ramène un statut inconnu à `incomplete`, qui n'ouvre rien", () => {
    expect(mapSubscriptionStatus("something_new")).toBe("incomplete");
    for (const status of [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
      "incomplete",
      "incomplete_expired",
    ]) {
      expect(mapSubscriptionStatus(status)).toBe(status);
    }
  });

  it("résout l'utilisateur par les métadonnées quand le customer est inconnu", async () => {
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      subscriptionEvent(
        "customer.subscription.updated",
        stripeSubscription({
          customer: "cus_jamais_vu",
          metadata: buildCheckoutMetadata({
            userId: USER,
            projectId: null,
            tier: "starter",
          }),
        })
      )
    );

    expect(recorded.subscriptions[0].userId).toBe(USER);
  });

  it("ignore un abonnement qu'on ne sait rattacher à personne", async () => {
    const { ports, recorded } = makePorts();

    const outcome = await processStripeEvent(
      ports,
      subscriptionEvent(
        "customer.subscription.updated",
        stripeSubscription({ customer: "cus_jamais_vu" })
      )
    );

    expect(outcome.status).toBe("ignored");
    expect(recorded.subscriptions).toEqual([]);
  });
});

describe("fin de période — API 2026-07-29.dahlia", () => {
  it("lit la date sur les ITEMS, plus sur l'abonnement", () => {
    // `current_period_end` a quitté l'abonnement pour ses items. Lire l'ancien
    // emplacement rendrait `undefined` en silence, donc un accès sans échéance.
    expect(subscriptionPeriodEnd(stripeSubscription())).toBe(
      "2026-03-01T00:00:00.000Z"
    );
  });

  it("retient la date la PLUS LOINTAINE quand l'abonnement a plusieurs lignes", () => {
    const subscription = stripeSubscription({
      items: {
        object: "list",
        data: [
          { id: "si_1", price: { id: "p1" }, current_period_end: 1772323200 },
          { id: "si_2", price: { id: "p2" }, current_period_end: 1774915200 },
        ],
      },
    } as unknown as Partial<Stripe.Subscription>);

    // C'est jusque-là que le praticien a payé.
    expect(subscriptionPeriodEnd(subscription)).toBe(
      "2026-03-31T00:00:00.000Z"
    );
  });

  it("rend null plutôt qu'une date inventée quand aucun item n'en porte", () => {
    const subscription = stripeSubscription({
      items: { object: "list", data: [] },
    } as unknown as Partial<Stripe.Subscription>);

    expect(subscriptionPeriodEnd(subscription)).toBeNull();
    expect(subscriptionRow(subscription, USER).currentPeriodEnd).toBeNull();
  });
});

describe("invoice.payment_failed", () => {
  function invoiceEvent(parent: unknown, id = "evt_inv_1"): Stripe.Event {
    return {
      id,
      type: "invoice.payment_failed",
      data: { object: { id: "in_test_1", object: "invoice", parent } },
    } as unknown as Stripe.Event;
  }

  it("passe l'abonnement en past_due", async () => {
    const { ports, recorded } = makePorts();

    await processStripeEvent(
      ports,
      invoiceEvent({
        type: "subscription_details",
        subscription_details: { subscription: "sub_test_1" },
      })
    );

    expect(recorded.pastDue).toEqual(["sub_test_1"]);
  });

  it("ignore une facture sans abonnement rattaché", async () => {
    const { ports, recorded } = makePorts();

    const outcome = await processStripeEvent(
      ports,
      invoiceEvent({ type: "quote_details", quote_details: { quote: "qt_1" } })
    );

    expect(outcome.status).toBe("ignored");
    expect(recorded.pastDue).toEqual([]);
  });
});

describe("route du webhook — la signature d'abord", () => {
  it("refuse une requête sans en-tête stripe-signature, sans rien lire", async () => {
    vi.resetModules();
    const constructEventAsync = vi.fn();
    vi.doMock("@/lib/stripe/client", () => ({
      getStripeClient: () => ({ webhooks: { constructEventAsync } }),
      getWebhookSecret: () => "whsec_test",
      StripeConfigError: class extends Error {},
    }));
    vi.doMock("@/lib/stripe/webhook-store", () => ({
      createWebhookPorts: () => {
        throw new Error("les ports ne doivent jamais être construits ici");
      },
    }));

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("https://eklio.test/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_forge", type: "checkout.session.completed" }),
      })
    );

    expect(response.status).toBe(400);
    expect(constructEventAsync).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/stripe/client");
    vi.doUnmock("@/lib/stripe/webhook-store");
  });

  it("refuse une signature invalide et ne traite rien", async () => {
    vi.resetModules();
    vi.doMock("@/lib/stripe/client", () => ({
      getStripeClient: () => ({
        webhooks: {
          constructEventAsync: () => {
            throw new Error("No signatures found matching the expected signature");
          },
        },
      }),
      getWebhookSecret: () => "whsec_test",
      StripeConfigError: class extends Error {},
    }));
    vi.doMock("@/lib/stripe/webhook-store", () => ({
      createWebhookPorts: () => {
        throw new Error("les ports ne doivent jamais être construits ici");
      },
    }));

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("https://eklio.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=faux" },
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    vi.doUnmock("@/lib/stripe/client");
    vi.doUnmock("@/lib/stripe/webhook-store");
  });
});

describe("résolution de l'utilisateur sur un event d'abonnement", () => {
  it("se contente de l'id utilisateur, sans exiger le tier", async () => {
    /*
     * Un event d'abonnement n'a pas besoin du tier. Exiger des métadonnées
     * COMPLÈTES perdrait le seul indice disponible quand la correspondance
     * customer → user manque en base — et l'abonnement se retrouverait sans
     * propriétaire alors que son identité était écrite noir sur blanc.
     */
    const { ports, recorded } = makePorts();

    const outcome = await processStripeEvent(
      ports,
      subscriptionEvent(
        "customer.subscription.updated",
        stripeSubscription({
          customer: "cus_jamais_vu",
          metadata: { eklio_user_id: USER },
        })
      )
    );

    expect(outcome.status).toBe("processed");
    expect(recorded.subscriptions[0].userId).toBe(USER);
  });
});
