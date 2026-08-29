import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import type { WebhookPorts } from "@/lib/stripe/webhook";
import type { PurchaseStatus } from "@/types/supabase";
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

    async grantPlanAllowance({ projectId, tier, stripeEventId }): Promise<void> {
      /*
       * Sans projet, il n'y a rien à créditer : un checkout lancé depuis
       * `/pricing` vaut pour tous les projets du praticien, et l'allocation se
       * pose sur un projet précis. Le droit, lui, est déjà accordé par la
       * ligne `purchases`.
       */
      if (!projectId) return;

      /*
       * `p_grant_key` — la clé d'idempotence. La base la fait défaut au dernier
       * achat du projet à ce palier ; on lui passe plutôt l'id de l'event, qui
       * couvre notre propre mode de défaillance : un handler qui jette après
       * cet appel fait désarmer l'idempotence par `forgetEvent`, et Stripe
       * rejoue le même event. La même clé arrête le second octroi.
       */
      const { error } = await supabase.rpc("grant_plan_allowance", {
        p_project_id: projectId,
        p_tier: tier,
        p_grant_key: stripeEventId,
      });

      if (error) throw error;
    },

    async purchaseByPaymentIntent(paymentIntentId) {
      /*
       * LA SECONDE LECTURE. `purchases` est unique sur la session de checkout,
       * mais les events de charge ne la connaissent pas : ils portent le
       * PaymentIntent, que l'achat a stocké au paiement.
       *
       * `maybeSingle()` et non `single()` : un remboursement sur un paiement
       * qui n'a jamais produit de ligne est un cas réel, pas une exception.
       */
      const { data, error } = await supabase
        .from("purchases")
        .select("id, status, project_id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (error) {
        console.error("[stripe-webhook] lecture achat par payment_intent", error);
        throw error;
      }
      if (!data) return null;

      return {
        id: data.id,
        status: data.status as PurchaseStatus,
        projectId: data.project_id,
      };
    },

    async recordStatusTransition(t): Promise<void> {
      /*
       * LE JOURNAL D'ABORD, la ligne ensuite.
       *
       * `stripe_event_id` y est unique : si l'insertion passe, c'est que cet
       * event n'a jamais été appliqué. Écrire le statut d'abord laisserait,
       * sur un rejeu arrivé pendant l'écriture, un achat modifié deux fois
       * dont le journal ne porterait qu'une trace — et c'est le journal qui
       * sert à rendre l'état d'avant.
       *
       * Le conflit d'unicité n'est PAS une erreur : c'est la réponse. On sort
       * sans toucher à l'achat.
       */
      const { error: ledgerError } = await supabase
        .from("purchase_status_events")
        .insert({
          purchase_id: t.purchaseId,
          status: t.status,
          previous_status: t.previousStatus,
          stripe_event_id: t.stripeEventId,
          reason: t.reason,
        });

      if (ledgerError) {
        if (ledgerError.code === UNIQUE_VIOLATION) return;
        throw ledgerError;
      }

      const { error } = await supabase
        .from("purchases")
        .update({ status: t.status, updated_at: new Date().toISOString() })
        .eq("id", t.purchaseId);

      if (error) throw error;
    },

    async previousStatusBefore(purchaseId, intoStatuses) {
      /*
       * Le `previous_status` de la DERNIÈRE entrée dans l'un de ces statuts.
       *
       * On filtre sur `status` plutôt que de prendre la ligne la plus récente :
       * un achat contesté puis remboursé porte deux transitions, et rendre
       * « celle d'avant la dernière » rendrait l'état d'avant le
       * remboursement, pas celui d'avant le litige.
       */
      const { data, error } = await supabase
        .from("purchase_status_events")
        .select("previous_status")
        .eq("purchase_id", purchaseId)
        .in("status", intoStatuses)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[stripe-webhook] lecture du statut antérieur", error);
        return null;
      }
      return (data?.previous_status as PurchaseStatus | undefined) ?? null;
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
