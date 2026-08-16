import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Stripe webhook. The authority on what was actually paid for.
 *
 * Two things this handler must get right:
 *  - Verify the signature against the raw body. A parsed-and-re-serialized
 *    body changes the bytes and fails the MAC, so we read text() directly.
 *  - Write with the service-role client. There is no user session on a webhook
 *    request, and `orders`/`subscriptions` have no client-writable policies.
 */

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    // A bad signature is either a misconfiguration or someone else calling
    // this endpoint. Either way, do not process it.
    console.error("[stripe] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object);
        break;

      default:
        // Everything else is subscribed-to noise; acknowledge and move on.
        break;
    }
  } catch (error) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // database failure — the handlers are idempotent.
    console.error(`[stripe] failed handling ${event.type}`, error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient();

  const paid =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";

  await supabase
    .from("orders")
    .update({
      status: paid ? "paid" : "failed",
      stripe_customer_id: asId(session.customer),
      stripe_payment_intent_id: asId(session.payment_intent),
    })
    .eq("stripe_checkout_session_id", session.id);

  // The subscription itself arrives on customer.subscription.*; nothing to do
  // for it here beyond the order row above.
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();

  const userId = subscription.metadata?.user_id;
  const projectId = subscription.metadata?.project_id ?? null;

  if (!userId) {
    // Without the metadata we cannot attribute the subscription to an account.
    // Log rather than throw: retrying will not add metadata that was never set.
    console.error(
      `[stripe] subscription ${subscription.id} has no user_id metadata`
    );
    return;
  }

  const periodEnd = currentPeriodEnd(subscription);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      project_id: projectId,
      stripe_customer_id: asId(subscription.customer) ?? "",
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" }
  );
}

/** Stripe returns either an id string or an expanded object. */
function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * `current_period_end` moved onto the subscription's items in recent API
 * versions. Read the item first and fall back to the legacy top-level field so
 * this keeps working across an API version bump.
 */
function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const legacy = (subscription as unknown as { current_period_end?: number })
    .current_period_end;

  const seconds = fromItem ?? legacy;
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : null;
}
