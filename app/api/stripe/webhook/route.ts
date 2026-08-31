import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le webhook Stripe. C'est le seul endroit de l'application qui a le droit
 * d'utiliser le service_role sur les RPC de facturation — `grant_plan_allowance`
 * est service_role only, par conception.
 *
 * ⚠ Deux idempotences distinctes, et elles ne se remplacent pas :
 *   1. `stripe_events` — l'événement a-t-il déjà été traité ? Stripe rejoue.
 *   2. `p_grant_key` de `grant_plan_allowance` — une allocation accordée deux
 *      fois pour un paiement remet le compteur à zéro deux fois.
 *
 * ⚠ On envoie TOUJOURS l'id d'événement Stripe comme clé d'octroi. La forme à
 * deux arguments n'est pas idempotente contre celle à trois pour le même
 * achat : les deux rendent true et écrivent deux `plan_grants`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    // Signature invalide : on ne lit même pas le corps. C'est le seul contrôle
    // qui distingue Stripe de n'importe qui d'autre postant sur cette URL.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Rejeu : `stripe_events` a l'id en clé primaire, donc l'insert échoue la
  // seconde fois et on sort sans rien refaire.
  const { error: seen } = await admin
    .from("stripe_events")
    .insert({ stripe_event_id: event.id, type: event.type });

  if (seen) return NextResponse.json({ received: true, replayed: true });

  try {
    await handle(event, admin);
  } catch (error) {
    // On retire la marque pour que le rejeu de Stripe puisse retenter : un
    // événement marqué traité mais dont le traitement a échoué serait un
    // paiement encaissé sans allocation, et rien ne le rattraperait.
    await admin.from("stripe_events").delete().eq("stripe_event_id", event.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Handler failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

async function handle(event: Stripe.Event, admin: Admin) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return;

      const projectId = session.metadata?.project_id;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier;
      if (!projectId || !userId || !tier) {
        throw new Error(`Checkout session ${session.id} is missing its metadata.`);
      }

      // `stripe_checkout_session_id` est unique : l'upsert rend le rejeu inerte
      // même si la marque d'événement a été perdue.
      const { error: purchaseError } = await admin.from("purchases").upsert(
        {
          user_id: userId,
          project_id: projectId,
          tier,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          amount_cents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          status: "paid",
          paid_at: new Date(event.created * 1000).toISOString(),
        },
        { onConflict: "stripe_checkout_session_id" }
      );
      if (purchaseError) throw new Error(purchaseError.message);

      // ⚠ L'entitlement est piloté par `purchases` et vient d'ouvrir le
      // livrable. L'allocation, elle, ne se déduit de rien : sans cet appel,
      // une cliente qui a payé reste à deux runs.
      const { error: grantError } = await admin.rpc("grant_plan_allowance", {
        p_project_id: projectId,
        p_tier: tier,
        p_grant_key: event.id,
      });
      if (grantError) throw new Error(grantError.message);
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const status = charge.amount_refunded < charge.amount ? "partially_refunded" : "refunded";
      await advance(admin, event, charge.payment_intent, status, charge.amount_refunded);
      return;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      await advance(admin, event, dispute.charge, "disputed", dispute.amount);
      return;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      // Un litige gagné rend le livrable à l'état qu'il avait AVANT — qui peut
      // être `partially_refunded`, pas `paid`. C'est à ça que sert l'historique.
      const purchase = await findPurchase(admin, dispute.charge);
      if (!purchase) return;

      let next = "refunded";
      if (dispute.status === "won") {
        const { data: before } = await admin.rpc("purchase_status_before", {
          p_purchase_id: purchase.id,
          p_status: "disputed",
        });
        next = (before as string | null) ?? "paid";
      }

      const { error } = await admin.rpc("record_purchase_status_event", {
        p_purchase_id: purchase.id,
        p_stripe_event_id: event.id,
        p_new_status: next,
        p_event_type: event.type,
        p_amount_cents: dispute.amount,
        p_occurred_at: new Date(event.created * 1000).toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await advance(admin, event, intent.id, "failed", intent.amount);
      return;
    }

    default:
      return;
  }
}

async function findPurchase(
  admin: Admin,
  charge: string | Stripe.Charge | null
): Promise<{ id: string } | null> {
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  if (!chargeId) return null;

  const intentId =
    typeof charge === "string"
      ? (await stripe().charges.retrieve(chargeId)).payment_intent
      : charge?.payment_intent;

  const id = typeof intentId === "string" ? intentId : intentId?.id;
  if (!id) return null;

  const { data } = await admin
    .from("purchases")
    .select("id")
    .eq("stripe_payment_intent_id", id)
    .maybeSingle();

  return data ?? null;
}

async function advance(
  admin: Admin,
  event: Stripe.Event,
  reference: string | Stripe.Charge | Stripe.PaymentIntent | null,
  status: string,
  amountCents: number
) {
  const id =
    typeof reference === "string"
      ? reference
      : reference && "payment_intent" in reference
        ? typeof reference.payment_intent === "string"
          ? reference.payment_intent
          : (reference.payment_intent?.id ?? null)
        : (reference?.id ?? null);

  if (!id) return;

  const { data: purchase } = await admin
    .from("purchases")
    .select("id")
    .eq("stripe_payment_intent_id", id)
    .maybeSingle();

  if (!purchase) return;

  const { error } = await admin.rpc("record_purchase_status_event", {
    p_purchase_id: purchase.id,
    p_stripe_event_id: event.id,
    p_new_status: status,
    p_event_type: event.type,
    p_amount_cents: amountCents,
    p_occurred_at: new Date(event.created * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
}
