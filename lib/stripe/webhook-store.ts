import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import type { WebhookPorts } from "@/lib/stripe/webhook";
import type { Json } from "@/types/supabase";

/*
 * Les ports du webhook, branchés sur Supabase et sur Stripe.
 *
 * TOUT passe par la service_role, et ce n'est pas un raccourci : `purchases`,
 * `subscriptions` et `monthly_presence_content` sont en écriture REFUSÉE aux
 * clients par RLS (policies `*_insert_denied` / `*_update_denied`), et
 * `stripe_events` n'a aucune policy du tout — RLS activée, privilèges anon et
 * authenticated révoqués. C'est le seul chemin d'écriture qui existe, et il
 * n'est atteignable que depuis ce route handler serveur.
 *
 * Corollaire à ne jamais oublier : la service_role BYPASSE la RLS. Chaque
 * écriture ci-dessous doit donc porter elle-même la contrainte que la policy
 * aurait portée — d'où le `.is("stripe_customer_id", null)` de `linkCustomer`,
 * qui empêche d'écraser la correspondance d'un autre compte.
 */

/** Code Postgres d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = "23505";

export function createWebhookPorts(): WebhookPorts {
  const supabase = createAdminClient();

  return {
    async recordEvent(event: Stripe.Event): Promise<boolean> {
      const { error } = await supabase.from("stripe_events").insert({
        stripe_event_id: event.id,
        type: event.type,
        // L'objet complet sert au diagnostic : sans lui, un event mal traité
        // n'est plus rejouable une fois passé le délai de rejeu de Stripe.
        payload: event as unknown as Json,
      });

      if (!error) return true;

      /*
       * `stripe_event_id` est la clé primaire : le conflit EST la réponse.
       * Stripe rejoue un event tant qu'il n'a pas reçu de 2xx, et sans ce
       * verrou un rejeu créerait un second achat pour un seul paiement.
       */
      if (error.code === UNIQUE_VIOLATION) return false;
      throw error;
    },

    async forgetEvent(eventId: string): Promise<void> {
      const { error } = await supabase
        .from("stripe_events")
        .delete()
        .eq("stripe_event_id", eventId);

      if (error) {
        // Échec du désarmement : le rejeu de Stripe sera ignoré. On le crie
        // dans les logs, c'est un cas à reprendre à la main.
        console.error(
          `[stripe-webhook] IMPOSSIBLE de retirer l'event ${eventId} après échec — le rejeu sera ignoré.`,
          error
        );
      }
    },

    async userIdForCustomer(customerId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (error) {
        console.error("[stripe-webhook] lecture profil par customer", error);
        return null;
      }
      return data?.id ?? null;
    },

    async linkCustomer(userId: string, customerId: string): Promise<void> {
      /*
       * `.is(null)` est la garde qui remplace la policy : on ne pose la
       * correspondance QUE si elle manquait. Sans elle, la service_role
       * réécrirait le customer d'un compte dès qu'un event porterait un autre
       * identifiant — et rattacherait un abonnement au mauvais praticien.
       */
      const { error } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId)
        .is("stripe_customer_id", null);

      if (error) {
        console.error("[stripe-webhook] écriture stripe_customer_id", error);
      }
    },

    async recordPurchase(row): Promise<void> {
      /*
       * Upsert sur la session de checkout (colonne unique) plutôt qu'insert :
       * le verrou d'idempotence couvre déjà le rejeu, mais un achat passé de
       * `pending` à `paid` par un second event doit pouvoir se mettre à jour.
       */
      const { error } = await supabase.from("purchases").upsert(
        {
          user_id: row.userId,
          project_id: row.projectId,
          tier: row.tier,
          stripe_checkout_session_id: row.checkoutSessionId,
          stripe_payment_intent_id: row.paymentIntentId,
          amount_cents: row.amountCents,
          currency: row.currency,
          status: row.status,
          paid_at: row.paidAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_checkout_session_id" }
      );

      if (error) throw error;
    },

    async upsertSubscription(row): Promise<void> {
      /*
       * Conflit sur `user_id` (unique) : un praticien porte UN abonnement.
       * Une résiliation suivie d'un réabonnement remplace donc la ligne au
       * lieu d'en ajouter une seconde, qui ferait diverger le droit courant.
       */
      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: row.userId,
          stripe_subscription_id: row.stripeSubscriptionId,
          stripe_price_id: row.stripePriceId,
          status: row.status,
          current_period_end: row.currentPeriodEnd,
          cancel_at_period_end: row.cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;
    },

    async markSubscriptionPastDue(stripeSubscriptionId): Promise<void> {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripeSubscriptionId);

      if (error) throw error;
    },

    async fetchSubscription(id: string): Promise<Stripe.Subscription | null> {
      try {
        return await getStripeClient().subscriptions.retrieve(id);
      } catch (error) {
        console.error(`[stripe-webhook] lecture abonnement ${id}`, error);
        return null;
      }
    },
  };
}
