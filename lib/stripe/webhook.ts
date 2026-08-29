import type Stripe from "stripe";
import { KIT_PLANS, CURRENCY } from "@/lib/billing/plans";
import {
  parseCheckoutMetadata,
  readMetadataUserId,
} from "@/lib/stripe/metadata";
import type { KitTier } from "@/lib/kit/tiers";
import type { SubscriptionStatus } from "@/types/supabase";

/*
 * Traitement des events Stripe — la logique, sans le transport.
 *
 * Le route handler fait deux choses et deux seulement : vérifier la SIGNATURE
 * et brancher les ports ci-dessous sur Supabase. Tout le reste est ici, dans
 * une fonction qui ne connaît ni HTTP ni base de données, donc testable event
 * par event sans serveur ni réseau.
 *
 * C'est le webhook qui fait autorité sur ce qui est payé. Aucune redirection,
 * aucune page, aucun formulaire n'accorde le moindre droit : `purchases` et
 * `subscriptions` ne sont écrites que d'ici.
 */

export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  /*
   * ⚠ LES DEUX EVENTS DU PAIEMENT DIFFÉRÉ, et ils n'étaient pas là.
   *
   * `checkout.session.completed` arrive avec `payment_status: "unpaid"` sur un
   * moyen de paiement asynchrone (prélèvement bancaire, virement) : la session
   * est complétée, l'argent n'est pas encore arrivé. On écrit alors l'achat en
   * `pending`, qui n'accorde aucun droit.
   *
   * Ce qui manquait, c'est le SECOND event. Sans lui, la praticienne payait et
   * n'était JAMAIS débloquée : sa ligne `purchases` restait `pending` pour
   * toujours, et rien dans le produit ne la faisait bouger. Un paiement
   * encaissé sans contrepartie, silencieux, sans erreur nulle part.
   */
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandled(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

export type PurchaseRow = {
  userId: string;
  projectId: string | null;
  tier: KitTier;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  /*
   * `failed` : le paiement différé a été refusé par la banque. La ligne reste,
   * avec son statut — la supprimer ferait disparaître la trace d'une tentative
   * que la praticienne a bien faite, et qu'elle peut vouloir comprendre.
   */
  status: "pending" | "paid" | "failed";
  paidAt: string | null;
};

export type SubscriptionRow = {
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/*
 * Les ports : tout ce que le traitement a besoin de faire au monde extérieur.
 *
 * Toutes ces écritures passent par la service_role côté implémentation —
 * `stripe_events`, `purchases`, `subscriptions` sont en écriture refusée aux
 * clients par RLS, volontairement. Il n'y a pas d'autre chemin.
 */
export type WebhookPorts = {
  /**
   * Enregistre l'event. Rend `false` s'il était DÉJÀ là — donc déjà traité.
   *
   * C'est le verrou d'idempotence : Stripe rejoue un event tant qu'il n'a pas
   * reçu un 2xx, et un rejeu non gardé créerait un second `purchases`.
   */
  recordEvent(event: Stripe.Event): Promise<boolean>;
  /**
   * Retire l'event enregistré.
   *
   * Appelé quand le traitement échoue APRÈS l'enregistrement. Sans ça, le
   * verrou d'idempotence se retournerait contre nous : le rejeu de Stripe
   * verrait l'event « déjà traité » et l'ignorerait, laissant un paiement
   * encaissé sans droit accordé. On préfère un rejeu de trop à un droit perdu.
   */
  forgetEvent(eventId: string): Promise<void>;
  /** `profiles.stripe_customer_id` → id utilisateur. */
  userIdForCustomer(customerId: string): Promise<string | null>;
  /** Note la correspondance customer → user si elle manquait. */
  linkCustomer(userId: string, customerId: string): Promise<void>;
  recordPurchase(row: PurchaseRow): Promise<void>;
  upsertSubscription(row: SubscriptionRow): Promise<void>;
  /** Passe l'abonnement en `past_due` sans toucher au reste de la ligne. */
  markSubscriptionPastDue(stripeSubscriptionId: string): Promise<void>;
  /** Relit l'abonnement chez Stripe (statut et période à jour). */
  fetchSubscription(id: string): Promise<Stripe.Subscription | null>;
};

export type WebhookOutcome =
  | { status: "processed"; type: string }
  | { status: "duplicate"; type: string }
  | { status: "ignored"; type: string; reason: string };

/** Id d'un champ Stripe qui peut arriver développé ou en simple référence. */
function idOf(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Statut d'abonnement Stripe → statut en base.
 *
 * Les huit valeurs coïncident aujourd'hui avec le CHECK de `subscriptions`,
 * mais le type Stripe porte aussi un `OtherString` : l'API peut introduire un
 * statut que ce code ne connaît pas. On le ramène alors à `incomplete`, le
 * seul repli qui n'accorde AUCUN accès — un statut inconnu ne doit jamais
 * ouvrir le livrable mensuel par accident.
 */
export function mapSubscriptionStatus(status: string): SubscriptionStatus {
  const known: SubscriptionStatus[] = [
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ];
  return known.includes(status as SubscriptionStatus)
    ? (status as SubscriptionStatus)
    : "incomplete";
}

/**
 * Fin de période courante d'un abonnement, en ISO.
 *
 * Depuis l'API `2026-07-29.dahlia`, `current_period_end` n'est PLUS sur
 * l'abonnement : il vit sur chacun de ses ITEMS. Un abonnement à plusieurs
 * lignes en porte donc plusieurs, et la date qui compte pour un accès est la
 * plus lointaine — c'est jusque-là que le praticien a payé.
 */
export function subscriptionPeriodEnd(
  subscription: Stripe.Subscription
): string | null {
  const ends = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");

  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

/** Premier prix de l'abonnement, celui qui identifie le produit souscrit. */
function subscriptionPriceId(
  subscription: Stripe.Subscription
): string | null {
  return idOf(subscription.items?.data?.[0]?.price);
}

/**
 * Construit la ligne `subscriptions` à partir de l'objet Stripe.
 *
 * `deleted` force `canceled` : Stripe envoie l'abonnement dans son dernier
 * état connu, et se fier à `status` seul laisserait passer un `active` sur un
 * abonnement qui vient d'être supprimé.
 */
export function subscriptionRow(
  subscription: Stripe.Subscription,
  userId: string,
  { deleted = false }: { deleted?: boolean } = {}
): SubscriptionRow {
  return {
    userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscriptionPriceId(subscription),
    status: deleted ? "canceled" : mapSubscriptionStatus(subscription.status),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  };
}

/**
 * Qui est le client de cet objet Stripe ?
 *
 * Deux chemins, dans cet ordre : les métadonnées que nous avons posées au
 * checkout, puis `profiles.stripe_customer_id`. Le second seul ne suffit pas —
 * si l'écriture de la colonne avait échoué au checkout, un paiement encaissé
 * deviendrait orphelin. Quand les métadonnées sauvent la mise, on en profite
 * pour réparer la correspondance manquante.
 */
async function resolveUserId(
  ports: WebhookPorts,
  metadataUserId: string | null,
  customerId: string | null
): Promise<string | null> {
  if (metadataUserId) {
    if (customerId) await ports.linkCustomer(metadataUserId, customerId);
    return metadataUserId;
  }
  if (!customerId) return null;
  return ports.userIdForCustomer(customerId);
}

/**
 * Les trois events de session de checkout, sur un seul chemin.
 *
 * Ils portent le MÊME objet `Checkout.Session` et demandent la même résolution
 * d'utilisateur ; seul le statut qu'ils écrivent change. Les séparer en trois
 * handlers ferait trois copies de la résolution, et c'est elle qui décide à
 * quel compte un paiement se rattache.
 */
async function handleCheckoutSession(
  ports: WebhookPorts,
  session: Stripe.Checkout.Session,
  type:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.async_payment_failed"
): Promise<WebhookOutcome> {
  const metadata = parseCheckoutMetadata(
    session.metadata as Record<string, string> | null
  );
  const customerId = idOf(session.customer);

  const userId = await resolveUserId(
    ports,
    metadata?.userId ?? session.client_reference_id ?? null,
    customerId
  );

  if (!userId || !metadata) {
    /*
     * On refuse de DEVINER. Sans utilisateur ni tier, écrire dans `purchases`
     * reviendrait à inventer un rattachement — mieux vaut un droit non accordé,
     * réparable à la main, qu'un droit accordé au mauvais compte.
     */
    return {
      status: "ignored",
      type,
      reason: userId
        ? "métadonnées de session illisibles (tier manquant)"
        : "aucun utilisateur résolu pour cette session",
    };
  }

  /*
   * `payment_status` peut être `unpaid` sur un moyen de paiement asynchrone :
   * la session est complétée, l'argent n'est pas encore là. On enregistre alors
   * l'achat en `pending`, ce qui n'accorde aucun droit (le gating exige
   * `paid`), plutôt que de le perdre — et
   * `checkout.session.async_payment_succeeded` vient l'achever.
   *
   * L'échec du paiement différé écrit `failed` sans regarder
   * `payment_status` : Stripe n'a pas de raison de l'avoir mis à jour sur la
   * session, et c'est le TYPE de l'event qui fait foi ici.
   */
  const failed = type === "checkout.session.async_payment_failed";
  const paid =
    !failed &&
    (session.payment_status === "paid" ||
      session.payment_status === "no_payment_required");
  const status = failed ? "failed" : paid ? "paid" : "pending";

  /*
   * Le montant vient du CATALOGUE, pas de `amount_total` : quand l'add-on est
   * gardé, le total de la session comprend aussi les $39 du premier mois
   * d'abonnement, qui ne sont pas un achat de kit.
   */
  await ports.recordPurchase({
    userId,
    projectId: metadata.projectId,
    tier: metadata.tier,
    checkoutSessionId: session.id,
    paymentIntentId: idOf(session.payment_intent),
    amountCents: KIT_PLANS[metadata.tier].amountCents,
    currency: session.currency ?? CURRENCY,
    status,
    paidAt: paid ? new Date().toISOString() : null,
  });

  /*
   * L'add-on a été gardé : la session porte un abonnement. On le RELIT chez
   * Stripe plutôt que de se fier au champ de la session, qui n'est qu'une
   * référence — statut et fin de période n'y sont pas.
   *
   * Rien à relire quand le paiement a échoué : Stripe n'aura pas activé
   * l'abonnement, et un `customer.subscription.*` viendra le dire lui-même.
   */
  const subscriptionId = failed ? null : idOf(session.subscription);
  if (subscriptionId) {
    const subscription = await ports.fetchSubscription(subscriptionId);
    if (subscription) {
      await ports.upsertSubscription(subscriptionRow(subscription, userId));
    }
  }

  return { status: "processed", type };
}

async function handleSubscriptionChange(
  ports: WebhookPorts,
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<WebhookOutcome> {
  /*
   * Ici on ne lit QUE l'utilisateur : un event d'abonnement n'a pas besoin du
   * tier, et exiger des métadonnées complètes perdrait le seul indice
   * disponible quand la correspondance customer → user manque en base.
   */
  const metadataUserId = readMetadataUserId(
    subscription.metadata as Record<string, string> | null
  );
  const customerId = idOf(subscription.customer);

  const userId = await resolveUserId(ports, metadataUserId, customerId);

  if (!userId) {
    return {
      status: "ignored",
      type: event.type,
      reason: "aucun utilisateur résolu pour cet abonnement",
    };
  }

  await ports.upsertSubscription(
    subscriptionRow(subscription, userId, {
      deleted: event.type === "customer.subscription.deleted",
    })
  );

  return { status: "processed", type: event.type };
}

async function handleInvoiceFailed(
  ports: WebhookPorts,
  invoice: Stripe.Invoice
): Promise<WebhookOutcome> {
  const type = "invoice.payment_failed";

  /*
   * Depuis l'API `2026-07-29.dahlia`, une facture ne porte plus `subscription`
   * à la racine : l'abonnement qui l'a produite vit dans
   * `parent.subscription_details`.
   */
  const parent = invoice.parent;
  const subscriptionId =
    parent?.type === "subscription_details"
      ? idOf(parent.subscription_details?.subscription)
      : null;

  if (!subscriptionId) {
    return {
      status: "ignored",
      type,
      reason: "facture sans abonnement rattaché",
    };
  }

  /*
   * On passe en `past_due` sans toucher au reste de la ligne : ni la période
   * payée, ni le prix, ni le rattachement. Stripe enverra ensuite un
   * `customer.subscription.updated` avec l'état définitif (`unpaid`,
   * `canceled`, ou de nouveau `active` après une relance réussie).
   */
  await ports.markSubscriptionPastDue(subscriptionId);

  return { status: "processed", type };
}

/**
 * Point d'entrée : un event Stripe VÉRIFIÉ, un effet en base.
 *
 * L'enregistrement dans `stripe_events` vient EN PREMIER — c'est le verrou
 * d'idempotence — et il est défait si le traitement échoue ensuite, pour que
 * le rejeu de Stripe ait encore une chance d'aboutir.
 */
export async function processStripeEvent(
  ports: WebhookPorts,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  if (!isHandled(event.type)) {
    return { status: "ignored", type: event.type, reason: "event non traité" };
  }

  const fresh = await ports.recordEvent(event);
  if (!fresh) {
    return { status: "duplicate", type: event.type };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        return await handleCheckoutSession(
          ports,
          event.data.object as Stripe.Checkout.Session,
          event.type
        );
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return await handleSubscriptionChange(
          ports,
          event,
          event.data.object as Stripe.Subscription
        );
      case "invoice.payment_failed":
        return await handleInvoiceFailed(
          ports,
          event.data.object as Stripe.Invoice
        );
    }
  } catch (error) {
    await ports.forgetEvent(event.id);
    throw error;
  }
}
