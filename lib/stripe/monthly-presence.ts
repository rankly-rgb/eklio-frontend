import type Stripe from "stripe";
import { getStripeClient, monthlyPresencePriceId } from "@/lib/stripe/client";
import { INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS } from "@/lib/billing/plans";

/*
 * Les trois mois de Monthly Presence inclus dans Practice Suite.
 *
 * ── CE QUE C'EST, ET CE QUE CE N'EST PAS ─────────────────────────────────
 *
 * C'est un VRAI abonnement Stripe avec 90 jours d'essai. Pas un crédit, pas un
 * booléen, pas une date posée à côté : la ligne `subscriptions` reste la seule
 * source de vérité, `status` vaut `trialing`, et `isEntitledToMonthlyPresence`
 * répond oui sans apprendre une seconde façon d'être vraie. Ce module ne
 * touche JAMAIS à la base — il parle à Stripe et rend l'abonnement ; c'est le
 * webhook qui écrit la ligne, par le même `subscriptionRow()` que tous les
 * autres events. Un seul écrivain.
 *
 * ── POURQUOI C'EST ICI ET PAS DANS LE CHECKOUT ───────────────────────────
 *
 * Cf. l'en-tête de `lib/stripe/checkout.ts` : le kit est encaissé
 * immédiatement en `mode: "payment"`, et l'abonnement n'est créé qu'ensuite,
 * une fois l'argent arrivé. Une session `subscription` en essai de 90 jours
 * aurait risqué de repousser l'encaissement des $249 de trois mois.
 */

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Les statuts qui veulent dire « cet abonnement existe encore ».
 *
 * ⚠ TOUT CE QUI N'EST PAS MORT COMPTE, y compris `past_due` et `incomplete`.
 * La question à laquelle cette liste répond n'est pas « a-t-elle accès ? »
 * (ça, c'est `isEntitledToMonthlyPresence`, et la réponse y est plus
 * restrictive) mais « en créer un second serait-il une erreur ? ». Pour un
 * abonnement en souffrance de paiement, oui : elle se retrouverait avec deux
 * lignes chez Stripe, dont une qu'on essaierait de prélever deux fois.
 */
const LIVE_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
];

export type ExistingSubscription = {
  id: string;
  status: string;
  /** Unix seconds, tel que Stripe les rend. `null` hors période d'essai. */
  trialEnd: number | null;
  /** Unix seconds. Fin de la période déjà payée. */
  currentPeriodEnd: number | null;
};

export type GrantPlan =
  | { action: "create"; trialPeriodDays: number }
  | { action: "extend"; subscriptionId: string; trialEnd: number };

/**
 * Que faire des trois mois, sachant ce qu'elle a déjà.
 *
 * Fonction PURE — pas de SDK, pas d'horloge implicite — parce que c'est la
 * seule règle du lot qui décide combien de temps quelqu'un ne paie pas, et
 * qu'elle doit être testable aux bornes sans toucher à Stripe.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────
 *
 *   aucun abonnement vivant  → en créer un, 90 jours d'essai
 *   un abonnement vivant     → repousser SON essai de 90 jours
 *
 * ⚠ ON REPOUSSE DEPUIS LA FIN DE CE QU'ELLE A DÉJÀ PAYÉ, pas depuis
 * maintenant. Une abonnée payée jusqu'au 30 du mois qui achète Practice Suite
 * le 10 doit obtenir 90 jours APRÈS le 30 : partir de maintenant lui
 * avalerait les vingt jours qu'elle a déjà réglés, et « trois mois offerts »
 * lui en coûterait deux tiers d'un.
 *
 * ⚠ ET JAMAIS DEPUIS UNE DATE PASSÉE. Un `past_due` porte une fin de période
 * dépassée ; l'utiliser comme base rendrait moins de 90 jours, voire une date
 * d'essai déjà expirée que Stripe traiterait comme « essai terminé ». D'où le
 * `Math.max` avec l'instant courant.
 *
 * ⚠ LE PLAFOND DES DEUX ANS DE STRIPE N'EST PAS ATTEIGNABLE ICI. L'API refuse
 * un `trial_end` à plus de deux ans du `billing_cycle_anchor`, mais la même
 * documentation dit que l'anchor est déplacé SUR le `trial_end` à chaque mise
 * à jour. Chaque prolongation repart donc d'une ancre neuve, à 90 jours, et
 * dix achats successifs ne rapprochent pas du plafond.
 */
export function planIncludedMonths(
  existing: ExistingSubscription | null,
  nowSeconds: number,
  trialDays: number = INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS
): GrantPlan {
  const added = trialDays * DAY_SECONDS;

  if (!existing || !LIVE_STATUSES.includes(existing.status)) {
    return { action: "create", trialPeriodDays: trialDays };
  }

  /*
   * La base de départ : ce qu'elle a déjà, au plus loin. `trialEnd` prime sur
   * `currentPeriodEnd` quand les deux existent — pendant un essai ils
   * coïncident chez Stripe, mais le premier est celui qui dit explicitement
   * jusqu'à quand elle ne paie pas.
   */
  const paidThrough = Math.max(
    existing.trialEnd ?? 0,
    existing.currentPeriodEnd ?? 0,
    nowSeconds
  );

  return {
    action: "extend",
    subscriptionId: existing.id,
    trialEnd: paidThrough + added,
  };
}

/**
 * L'abonnement Monthly Presence de ce customer, s'il en a un.
 *
 * ⚠ ON NE FILTRE PAS SUR L'ID DE PRIX, et c'est délibéré. Le produit ne vend
 * qu'un seul abonnement : tout abonnement vivant de ce customer EST celui-là.
 * Filtrer sur `monthlyPresencePriceId()` créerait un second abonnement le jour
 * où ce prix est remplacé chez Stripe (même produit, même $39, nouvel id) —
 * c'est-à-dire exactement le doublon que ce module existe pour empêcher.
 */
export async function findLiveSubscription(
  customerId: string
): Promise<ExistingSubscription | null> {
  const { data } = await getStripeClient().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const live = data.find((subscription) =>
    LIVE_STATUSES.includes(subscription.status)
  );
  if (!live) return null;

  /*
   * Depuis l'API `2026-07-29.dahlia`, `current_period_end` vit sur les ITEMS
   * et non sur l'abonnement. La date qui compte est la plus lointaine : c'est
   * jusque-là qu'elle a payé. Même lecture que `subscriptionPeriodEnd()` dans
   * le webhook.
   */
  const ends = (live.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");

  return {
    id: live.id,
    status: live.status,
    trialEnd: live.trial_end ?? null,
    currentPeriodEnd: ends.length > 0 ? Math.max(...ends) : null,
  };
}

/**
 * Accorde les trois mois, et rend l'abonnement tel que Stripe le voit ensuite.
 *
 * L'appelant (le webhook) écrit la ligne à partir de ce retour, par le même
 * `subscriptionRow()` que tous les autres events d'abonnement.
 *
 * ── L'IDEMPOTENCE, ET POURQUOI ELLE N'EST PAS FACULTATIVE ────────────────
 *
 * Le webhook garde déjà les rejeux par l'id d'event… sauf sur un chemin :
 * quand le traitement échoue APRÈS cet appel, `forgetEvent` défait le verrou
 * pour que Stripe puisse rejouer — et le rejeu repasserait ici. Sans clé
 * d'idempotence, elle repartirait pour 90 jours de plus à chaque tentative.
 *
 * La clé dérive de la session de checkout : un même achat ne peut accorder ses
 * trois mois qu'une fois. (Les clés d'idempotence Stripe vivent 24 h, ce qui
 * couvre très largement la fenêtre de rejeu.)
 */
export async function grantIncludedMonthlyPresence(input: {
  customerId: string;
  userId: string;
  checkoutSessionId: string;
  /** Le moyen de paiement enregistré au checkout, à prélever dans 90 jours. */
  paymentMethodId: string | null;
  metadata: Record<string, string>;
  now?: Date;
}): Promise<Stripe.Subscription> {
  const { customerId, checkoutSessionId, paymentMethodId, metadata } = input;
  const stripe = getStripeClient();
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);

  const existing = await findLiveSubscription(customerId);
  const plan = planIncludedMonths(existing, nowSeconds);
  const idempotencyKey = `eklio-included-mp-${checkoutSessionId}`;

  if (plan.action === "extend") {
    return stripe.subscriptions.update(
      plan.subscriptionId,
      {
        trial_end: plan.trialEnd,
        /*
         * ⚠ AUCUNE PRORATION. Démarrer un essai sur un abonnement actif fait
         * par défaut créditer la partie non consommée de la période en cours —
         * ce qui lui offrirait, en plus des trois mois, le reste du mois
         * qu'elle a déjà payé. On lui donne ce qui est vendu : trois mois,
         * ajoutés à ce qu'elle a déjà.
         */
        proration_behavior: "none",
        metadata,
      },
      { idempotencyKey }
    );
  }

  return stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: monthlyPresencePriceId() }],
      trial_period_days: plan.trialPeriodDays,
      metadata,
      ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
      /*
       * ⚠ `create_invoice`, PAS `cancel` NI `pause`.
       *
       * Ce réglage ne décide que du cas anormal : les 90 jours sont écoulés et
       * Stripe n'a aucun moyen de paiement à prélever. Elle a pourtant payé
       * $249 et on lui a promis que ça continuerait à $39.
       *
       *   `cancel` supprimerait Monthly Presence en silence — une résiliation
       *     qu'elle n'a pas demandée et qu'elle découvrirait en constatant que
       *     le mois n'arrive pas ;
       *   `pause` la laisserait dans un état que rien dans le produit ne sait
       *     nommer ni rattraper ;
       *   `create_invoice` émet une facture visible, que Stripe lui envoie et
       *     qu'elle peut payer. Le statut passe `past_due`, la grâce de trois
       *     jours de `isEntitledToMonthlyPresence` s'applique, et le produit a
       *     déjà de quoi le raconter.
       *
       * Aucun de ces trois n'est censé arriver : `setup_future_usage` attache
       * la carte au checkout. C'est le comportement du jour où ça arrive quand
       * même.
       */
      trial_settings: { end_behavior: { missing_payment_method: "create_invoice" } },
    },
    { idempotencyKey }
  );
}
