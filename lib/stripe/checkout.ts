import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getStripeClient,
  kitPriceId,
  monthlyPresencePriceId,
  siteUrl,
} from "@/lib/stripe/client";
import { buildCheckoutMetadata } from "@/lib/stripe/metadata";
import type { KitTier } from "@/lib/kit/tiers";

/*
 * Création de la session Stripe Checkout (hébergée) — serveur uniquement.
 *
 * Deux formes de session, selon que l'add-on est gardé ou décoché :
 *
 * - AVEC Monthly Presence : `mode: "subscription"`, avec DEUX lignes dans la
 *   même session — le prix récurrent de l'abonnement et le prix unique du kit.
 *   Stripe facture la ligne unique sur la première facture de l'abonnement ; le
 *   praticien paie donc une fois, pour les deux.
 * - SANS : `mode: "payment"`, une seule ligne.
 *
 * Un `mode` qui ne correspond pas aux lignes est refusé par l'API — d'où le
 * branchement explicite plutôt qu'un objet construit à la volée.
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
  if (withMonthlyPresence) {
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

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: withMonthlyPresence ? "subscription" : "payment",
    customer: customerId,
    client_reference_id: userId,
    line_items: lineItems(tier, withMonthlyPresence),
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

  if (withMonthlyPresence) {
    /*
     * L'abonnement n'hérite PAS des métadonnées de la session : sans ce bloc,
     * un `customer.subscription.updated` arriverait sans le moindre indice de
     * l'utilisateur concerné. La résolution passerait alors uniquement par le
     * customer — et perdrait tout si celui-ci n'avait pas été noté en base.
     */
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
  }

  const session = await getStripeClient().checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe n'a pas rendu d'URL de checkout.");
  }
  return session.url;
}
