import type Stripe from "stripe";
import { KIT_PLANS, CURRENCY } from "@/lib/billing/plans";
import {
  parseCheckoutMetadata,
  readMetadataUserId,
} from "@/lib/stripe/metadata";
import type { KitTier } from "@/lib/kit/tiers";
import type { PurchaseStatus, SubscriptionStatus } from "@/types/supabase";

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
  /*
   * ── L'ARGENT QUI REPART ─────────────────────────────────────────────────
   *
   * Un remboursement et un litige retirent l'argent ; sans ces events, le kit
   * restait déverrouillé après un chargeback. Ils sont tous clés sur le
   * PAYMENT INTENT et non sur la session de checkout : Stripe les émet sur la
   * charge, qui ne connaît pas la session. D'où une seconde lecture,
   * `purchaseByPaymentIntent`.
   */
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  /*
   * Un remboursement peut ÉCHOUER après avoir réussi — la banque le rejette,
   * l'argent revient chez nous, et le droit doit revenir avec lui.
   *
   * Les deux noms sont écoutés parce que celui qui arrive dépend de la version
   * d'API du compte : `charge.refund.updated` sur les anciennes,
   * `refund.updated` sur les récentes. N'en écouter qu'un laisserait la
   * réouverture silencieusement inappliquée sur l'autre moitié des comptes.
   */
  "charge.refund.updated",
  "refund.updated",
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
  /**
   * Ouvre l'allocation du palier acheté.
   *
   * Idempotente sur l'id d'event côté base : un rejeu de Stripe ne double pas
   * ce qu'elle a payé. Appelée sur LES DEUX chemins de déverrouillage — le
   * paiement immédiat et le paiement différé confirmé. C'est le même
   * déverrouillage, et le second a déjà été oublié une fois.
   */
  grantPlanAllowance(input: {
    projectId: string | null;
    tier: KitTier;
    stripeEventId: string;
  }): Promise<void>;
  /**
   * L'achat correspondant à un PaymentIntent — LA seconde lecture.
   *
   * Les events de remboursement et de litige ne portent pas la session de
   * checkout, sur laquelle `purchases` est unique. Ils portent la charge, et
   * donc le PaymentIntent, que l'achat a stocké au moment du paiement.
   */
  purchaseByPaymentIntent(
    paymentIntentId: string
  ): Promise<{ id: string; status: PurchaseStatus; projectId: string | null } | null>;
  /**
   * Change le statut d'un achat ET journalise la transition, ensemble.
   *
   * Les deux écritures sont UN seul port pour qu'aucun appelant ne puisse
   * faire l'une sans l'autre : un statut changé sans ligne de journal est un
   * litige gagné qu'on ne saura plus rendre.
   */
  recordStatusTransition(transition: StatusTransition): Promise<void>;
  /**
   * Le statut qui précédait la dernière entrée DANS l'un de ces statuts.
   *
   * C'est ce qui rend un litige gagné à son état d'avant plutôt qu'à un `paid`
   * codé en dur — l'achat pouvait être `partially_refunded` quand le litige a
   * été ouvert, et le rendre `paid` lui offrirait le remboursement en prime.
   */
  previousStatusBefore(
    purchaseId: string,
    intoStatuses: PurchaseStatus[]
  ): Promise<PurchaseStatus | null>;
  upsertSubscription(row: SubscriptionRow): Promise<void>;
  /** Passe l'abonnement en `past_due` sans toucher au reste de la ligne. */
  markSubscriptionPastDue(stripeSubscriptionId: string): Promise<void>;
  /** Relit l'abonnement chez Stripe (statut et période à jour). */
  fetchSubscription(id: string): Promise<Stripe.Subscription | null>;
};

export type StatusTransition = {
  purchaseId: string;
  status: PurchaseStatus;
  /**
   * Le statut d'avant, tel que NOUS l'avons lu.
   *
   * ⚠ Il n'est PAS envoyé à la base : `record_purchase_status_event` le relit
   * lui-même sur la ligne, dans la même transaction que l'écriture. C'est
   * strictement mieux que ce que nous pouvons offrir — entre notre lecture et
   * notre écriture, un autre event a pu passer.
   *
   * Il reste ici parce que le handler s'en sert pour ne pas écrire une
   * transition vers soi-même, et parce que les tests en ont besoin pour dire
   * ce que le journal doit raconter.
   */
  previousStatus: PurchaseStatus;
  /** L'id de l'event Stripe — unique dans le journal. */
  stripeEventId: string;
  /** Le type d'event Stripe brut. La colonne s'appelle `event_type`. */
  reason: string;
  /** Le montant concerné, quand l'event en porte un. */
  amountCents?: number;
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
    | "checkout.session.async_payment_failed",
  eventId: string
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
   * L'ALLOCATION DU PALIER, sur les deux chemins de déverrouillage.
   *
   * Rien à ouvrir tant que l'argent n'est pas là : un `pending` n'accorde
   * aucun droit, et un `failed` encore moins.
   */
  if (paid) {
    await ports.grantPlanAllowance({
      projectId: metadata.projectId,
      tier: metadata.tier,
      stripeEventId: eventId,
    });
  }

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


/* ── L'argent qui repart ─────────────────────────────────────────────────── */

/**
 * Retrouve l'achat visé par un event de charge.
 *
 * Toujours par le PAYMENT INTENT : `purchases` est unique sur la session de
 * checkout, mais une charge ne connaît pas la session. On ne retombe pas sur
 * l'id de charge — la colonne n'existe pas, et deviner un rattachement sur un
 * event qui retire de l'argent serait le pire endroit pour deviner.
 */
async function purchaseFor(
  ports: WebhookPorts,
  paymentIntent: string | { id: string } | null | undefined,
  type: string
): Promise<
  | { found: true; purchase: { id: string; status: PurchaseStatus; projectId: string | null } }
  | { found: false; outcome: WebhookOutcome }
> {
  const paymentIntentId = idOf(paymentIntent);
  if (!paymentIntentId) {
    return {
      found: false,
      outcome: { status: "ignored", type, reason: "event sans payment_intent" },
    };
  }

  const purchase = await ports.purchaseByPaymentIntent(paymentIntentId);
  if (!purchase) {
    /*
     * Aucun achat pour ce PaymentIntent : c'est le cas d'un remboursement sur
     * un paiement qui n'a jamais produit de ligne — un achat ignoré faute de
     * métadonnées, par exemple. Il n'y a rien à révoquer, et inventer une
     * ligne ici serait pire que de ne rien faire.
     */
    return {
      found: false,
      outcome: {
        status: "ignored",
        type,
        reason: "aucun achat pour ce payment_intent",
      },
    };
  }

  return { found: true, purchase };
}

/** Applique une transition, ou l'ignore quand elle ne change rien. */
async function transition(
  ports: WebhookPorts,
  purchase: { id: string; status: PurchaseStatus },
  next: PurchaseStatus,
  event: Stripe.Event,
  amountCents?: number
): Promise<WebhookOutcome> {
  if (purchase.status === next) {
    // Une transition vers soi-même n'apprend rien au journal, et son
    // `previous_status` mentirait à la prochaine restauration.
    return {
      status: "ignored",
      type: event.type,
      reason: `achat déjà en ${next}`,
    };
  }

  await ports.recordStatusTransition({
    purchaseId: purchase.id,
    status: next,
    previousStatus: purchase.status,
    stripeEventId: event.id,
    reason: event.type,
    amountCents,
  });

  return { status: "processed", type: event.type };
}

/**
 * `charge.refunded` — remboursement total ou partiel.
 *
 * Stripe émet cet event à CHAQUE remboursement : deux remboursements partiels
 * font deux events, et celui qui complète la somme fait passer en `refunded`.
 * Chacun a son propre id, donc chacun laisse sa ligne dans le journal.
 */
async function handleChargeRefunded(
  ports: WebhookPorts,
  charge: Stripe.Charge,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  const found = await purchaseFor(ports, charge.payment_intent, event.type);
  if (!found.found) return found.outcome;

  const refunded = charge.amount_refunded ?? 0;
  const total = charge.amount ?? 0;
  const full = total > 0 && refunded >= total;

  return transition(
    ports,
    found.purchase,
    full ? "refunded" : "partially_refunded",
    event,
    refunded
  );
}

/**
 * `charge.dispute.created` — l'argent est DÉJÀ parti.
 *
 * Stripe retire les fonds à l'ouverture, avant toute décision. On révoque donc
 * tout de suite, et `disputed` reste distinct de `refunded` : l'argent peut
 * revenir, et le journal garde de quoi rendre l'état d'avant.
 */
async function handleDisputeCreated(
  ports: WebhookPorts,
  dispute: Stripe.Dispute,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  const found = await purchaseFor(ports, dispute.payment_intent, event.type);
  if (!found.found) return found.outcome;

  return transition(ports, found.purchase, "disputed", event, dispute.amount);
}

/**
 * `charge.dispute.closed` — gagné, on rend ; perdu, on en reste là.
 *
 * ⚠ Le retour se lit DANS LE JOURNAL, jamais en dur. Un achat pouvait être
 * `partially_refunded` au moment où le litige s'est ouvert ; le rendre `paid`
 * lui offrirait le remboursement en prime.
 *
 * Quand le journal ne porte rien à rendre — une ligne perdue, un `disputed`
 * posé à la main — on LAISSE `disputed` et on le crie dans les logs. C'est la
 * même asymétrie que partout ailleurs : un refus injustifié remonte en
 * support, une remise en accès injustifiée ne remonte jamais. Ici le coût est
 * réel et assumé, parce qu'un litige gagné est rare et qu'il a un chemin
 * humain.
 */
async function handleDisputeClosed(
  ports: WebhookPorts,
  dispute: Stripe.Dispute,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  const found = await purchaseFor(ports, dispute.payment_intent, event.type);
  if (!found.found) return found.outcome;

  if (dispute.status === "lost") {
    // L'argent ne revient pas. L'achat reste révoqué, et la ligne de journal
    // le dit explicitement plutôt que de laisser un `disputed` sans épilogue.
    return transition(ports, found.purchase, "disputed", event, dispute.amount);
  }

  /*
   * `won` et `warning_closed` : dans les deux cas nous gardons l'argent. Les
   * autres statuts sont des étapes intermédiaires que `closed` ne devrait pas
   * porter — on les nomme au lieu de les traiter au hasard.
   */
  if (dispute.status !== "won" && dispute.status !== "warning_closed") {
    return {
      status: "ignored",
      type: event.type,
      reason: `litige clos avec le statut ${dispute.status}`,
    };
  }

  const restored = await ports.previousStatusBefore(found.purchase.id, ["disputed"]);
  if (!restored) {
    console.error(
      `[stripe-webhook] litige gagné sans état antérieur pour l'achat ${found.purchase.id} — accès à rouvrir à la main.`
    );
    return {
      status: "ignored",
      type: event.type,
      reason: "aucun état antérieur à rendre",
    };
  }

  return transition(ports, found.purchase, restored, event, dispute.amount);
}

/**
 * Le remboursement qui échoue — la banque le rejette, l'argent revient.
 *
 * Le droit revient avec lui, repris dans le journal comme pour un litige
 * gagné. Un `refund` dont le statut n'est pas `failed` est un autre moment de
 * sa vie (créé, en attente, réussi) et ne change rien ici.
 */
async function handleRefundUpdated(
  ports: WebhookPorts,
  refund: Stripe.Refund,
  event: Stripe.Event
): Promise<WebhookOutcome> {
  if (refund.status !== "failed") {
    return {
      status: "ignored",
      type: event.type,
      reason: `remboursement en statut ${refund.status ?? "inconnu"}`,
    };
  }

  const found = await purchaseFor(ports, refund.payment_intent, event.type);
  if (!found.found) return found.outcome;

  const restored = await ports.previousStatusBefore(found.purchase.id, [
    "refunded",
    "partially_refunded",
  ]);
  if (!restored) {
    console.error(
      `[stripe-webhook] remboursement échoué sans état antérieur pour l'achat ${found.purchase.id} — accès à rouvrir à la main.`
    );
    return {
      status: "ignored",
      type: event.type,
      reason: "aucun état antérieur à rendre",
    };
  }

  return transition(ports, found.purchase, restored, event, refund.amount);
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
          event.type,
          event.id
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
      case "charge.refunded":
        return await handleChargeRefunded(
          ports,
          event.data.object as Stripe.Charge,
          event
        );
      case "charge.dispute.created":
        return await handleDisputeCreated(
          ports,
          event.data.object as Stripe.Dispute,
          event
        );
      case "charge.dispute.closed":
        return await handleDisputeClosed(
          ports,
          event.data.object as Stripe.Dispute,
          event
        );
      case "charge.refund.updated":
      case "refund.updated":
        return await handleRefundUpdated(
          ports,
          event.data.object as Stripe.Refund,
          event
        );
    }
  } catch (error) {
    await ports.forgetEvent(event.id);
    throw error;
  }
}
