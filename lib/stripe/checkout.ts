import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getStripeClient,
  kitPriceId,
  monthlyPresencePriceId,
} from "@/lib/stripe/client";
import { includesMonthlyPresence } from "@/lib/billing/plans";
import { siteUrl } from "@/lib/site-url";
import { buildCheckoutMetadata } from "@/lib/stripe/metadata";
import type { KitTier } from "@/lib/kit/tiers";

/*
 * Création de la session Stripe Checkout (hébergée) — serveur uniquement.
 *
 * Trois formes de session :
 *
 * - PRACTICE SUITE (`signature`) : `mode: "payment"`, UNE seule ligne, le kit.
 *   Les trois mois de Monthly Presence inclus ne sont PAS une ligne de cette
 *   session — voir le bloc ⚠ ci-dessous, c'est la décision structurante du lot.
 * - AVEC Monthly Presence choisi : `mode: "subscription"`, avec DEUX lignes dans
 *   la même session — le prix récurrent de l'abonnement et le prix unique du
 *   kit. Stripe facture la ligne unique sur la première facture de
 *   l'abonnement ; le praticien paie donc une fois, pour les deux.
 * - SANS : `mode: "payment"`, une seule ligne.
 *
 * Un `mode` qui ne correspond pas aux lignes est refusé par l'API — d'où le
 * branchement explicite plutôt qu'un objet construit à la volée.
 *
 * ── ⚠ POURQUOI L'ABONNEMENT INCLUS N'EST PAS CRÉÉ PAR CE CHECKOUT ─────────
 *
 * La forme « évidente » serait `mode: "subscription"` avec les deux lignes et
 * `subscription_data.trial_period_days: 90`. Elle est écartée, et pour une
 * raison de trésorerie, pas de style.
 *
 * Dans une session `subscription`, une ligne à prix UNIQUE devient un poste de
 * la PREMIÈRE FACTURE de l'abonnement. Avec un essai de 90 jours, cette
 * première facture n'est émise qu'à la FIN de l'essai. Le risque est donc de
 * livrer un kit à $249 et de n'encaisser rien pendant trois mois, sur un
 * abonnement qu'elle peut résilier entre-temps.
 *
 * Je n'ai pas pu vérifier depuis cet environnement ce que Stripe fait
 * exactement d'un poste unique sur la première facture d'un abonnement en
 * essai — et c'est précisément le genre de détail qu'il ne faut pas deviner
 * quand la réponse vaut $249 par vente. Le montage ci-dessous rend la question
 * SANS OBJET : le kit est encaissé immédiatement en `mode: "payment"`, et
 * l'abonnement est créé ensuite, par le webhook, une fois l'argent arrivé
 * (cf. `lib/stripe/monthly-presence.ts`). Deux opérations indépendantes, dont
 * une seule porte de l'argent.
 *
 * `setup_future_usage: "off_session"` est ce qui rend ce montage possible : il
 * attache la carte au customer, pour que l'abonnement créé plus tard ait de
 * quoi prélever au bout des 90 jours.
 */

type Client = SupabaseClient<Database>;

export type CheckoutInput = {
  userId: string;
  email: string;
  tier: KitTier;
  /** Null quand le checkout part de `/pricing`, avant tout choix de projet. */
  projectId: string | null;
  /** Coché par défaut dans l'interface ; décochable, et ça compte. */
  withMonthlyPresence: boolean;
};

/**
 * Le client Stripe de cet utilisateur : celui déjà enregistré, ou un nouveau.
 *
 * UN SEUL customer par utilisateur, pour le paiement unique COMME pour
 * l'abonnement. C'est ce qui rend le chemin inverse possible : le webhook
 * reçoit un `customer` et doit retrouver l'utilisateur, ce qu'il fait par
 * `profiles.stripe_customer_id` (colonne unique). Deux customers pour un même
 * praticien casseraient cette résolution, et son abonnement se retrouverait
 * rattaché à un compte fantôme.
 *
 * La clé d'idempotence dérive de l'id utilisateur : deux checkouts lancés en
 * même temps depuis deux onglets rendent alors le MÊME customer au lieu d'en
 * créer deux.
 */
export async function ensureStripeCustomer(
  supabase: Client,
  { userId, email }: { userId: string; email: string }
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[checkout] lecture profil", error);
  }
  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await getStripeClient().customers.create(
    {
      email,
      metadata: { eklio_user_id: userId },
    },
    { idempotencyKey: `eklio-customer-${userId}` }
  );

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    /*
     * Le customer EXISTE chez Stripe mais n'a pas pu être noté ici. On ne
     * lève pas : le paiement doit pouvoir aboutir, et le webhook sait poser la
     * correspondance manquante à réception (cf. `resolveUserId`). Journalisé
     * parce que c'est une anomalie, pas un cas nominal.
     */
    console.error("[checkout] écriture stripe_customer_id", updateError);
  }

  return customer.id;
}

/** Lignes de la session, dans l'ordre où le praticien les lira sur Stripe. */
function lineItems(
  tier: KitTier,
  withMonthlyPresence: boolean
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items = [{ price: kitPriceId(tier), quantity: 1 }];
  /*
   * `subscribeNow` est déjà faux pour un tier qui inclut l'abonnement (cf.
   * `createCheckoutSession`), mais la garde est répétée ici parce que c'est
   * CETTE fonction qui décide de facturer $39 de plus : ajouter la ligne
   * récurrente à une praticienne qui vient de payer pour trois mois offerts
   * lui ferait payer le mois qu'on lui offre.
   */
  if (withMonthlyPresence && !includesMonthlyPresence(tier)) {
    items.push({ price: monthlyPresencePriceId(), quantity: 1 });
  }
  return items;
}

/**
 * Crée la session et rend l'URL hébergée par Stripe.
 *
 * `client_reference_id` et les métadonnées portent la même information par
 * deux chemins : le webhook peut ainsi rattacher le paiement même si la
 * correspondance customer → user n'a pas pu être écrite au moment du checkout.
 */
export async function createCheckoutSession(
  supabase: Client,
  input: CheckoutInput
): Promise<string> {
  const { userId, email, tier, projectId, withMonthlyPresence } = input;

  const customerId = await ensureStripeCustomer(supabase, { userId, email });
  const metadata = buildCheckoutMetadata({ userId, projectId, tier });

  const base = siteUrl();

  /*
   * ⚠ SOUSCRIRE MAINTENANT, ou pas du tout dans CETTE session.
   *
   * Practice Suite inclut trois mois : la case cochée est alors sans objet, et
   * l'honorer créerait un abonnement facturé $39 immédiatement à quelqu'un à
   * qui on vient de promettre trois mois offerts. On l'ignore donc ici plutôt
   * que de faire confiance à l'interface pour ne jamais l'envoyer — le client
   * est une entrée, pas une autorité.
   */
  const included = includesMonthlyPresence(tier);
  const subscribeNow = withMonthlyPresence && !included;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: subscribeNow ? "subscription" : "payment",
    customer: customerId,
    client_reference_id: userId,
    line_items: lineItems(tier, subscribeNow),
    metadata,
    /*
     * `{CHECKOUT_SESSION_ID}` est substitué par Stripe à la redirection. La
     * page de succès s'en sert pour AFFICHER l'état de la confirmation — elle
     * n'accorde jamais l'accès elle-même : la vérité vient du webhook.
     */
    success_url: `${base}/app/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/checkout/canceled`,
    allow_promotion_codes: false,
  };

  if (subscribeNow) {
    /*
     * L'abonnement n'hérite PAS des métadonnées de la session : sans ce bloc,
     * un `customer.subscription.updated` arriverait sans le moindre indice de
     * l'utilisateur concerné. La résolution passerait alors uniquement par le
     * customer — et perdrait tout si celui-ci n'avait pas été noté en base.
     */
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = {
      metadata,
      /*
       * ⚠ LA CARTE EST GARDÉE QUAND, ET SEULEMENT QUAND, ON DEVRA S'EN
       * RESERVIR. Pour Practice Suite, l'abonnement est créé après coup par le
       * webhook : sans carte attachée au customer, il n'aurait rien à prélever
       * au bout des 90 jours, et `missing_payment_method` déciderait du sort
       * d'une praticienne qui a pourtant payé $249.
       *
       * Pour les deux autres tiers, aucun prélèvement futur n'est prévu par ce
       * paiement — on ne conserve donc pas le moyen de paiement. Garder une
       * carte « au cas où » est une collecte qu'on ne saurait pas justifier.
       */
      ...(included ? { setup_future_usage: "off_session" as const } : {}),
    };
  }

  const session = await getStripeClient().checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe n'a pas rendu d'URL de checkout.");
  }
  return session.url;
}

/**
 * Checkout de l'abonnement SEUL — la tuile verrouillée du calendrier et la
 * carte Monthly Presence du kit y mènent.
 *
 * Pas de ligne de kit : ce praticien a déjà payé le sien. Le `mode` est
 * `subscription`, et les métadonnées sont posées sur l'abonnement pour que le
 * webhook sache à qui le rattacher même si la correspondance customer → user
 * n'existait pas encore.
 */
export async function createMonthlyPresenceCheckout(
  supabase: Client,
  { userId, email }: { userId: string; email: string }
): Promise<string> {
  const customerId = await ensureStripeCustomer(supabase, { userId, email });
  const metadata = { eklio_user_id: userId };
  const base = siteUrl();

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: monthlyPresencePriceId(), quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: `${base}/app/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/checkout/canceled`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    throw new Error("Stripe n'a pas rendu d'URL de checkout.");
  }
  return session.url;
}
