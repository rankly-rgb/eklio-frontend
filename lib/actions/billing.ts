"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe, requirePriceId } from "@/lib/stripe/client";
import { MONTHLY_PRESENCE, getTier } from "@/lib/billing/plans";

export type CheckoutState = { error: string } | null;

/**
 * Creates one Stripe Checkout session covering the one-time kit purchase and,
 * when kept, the Monthly Presence subscription.
 *
 * Both go in a single session: the session runs in `subscription` mode and the
 * one-time tier rides along as a line item billed on the first invoice. That
 * keeps it to one card entry and one confirmation rather than two checkouts
 * the practitioner could abandon halfway through.
 */
export async function startCheckout(
  projectId: string,
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const tierId = String(formData.get("tier") ?? "");
  // Default-checked in the form; absent from the payload means unticked.
  const withMonthlyPresence = formData.get("monthlyPresence") === "on";

  const tier = getTier(tierId);
  if (!tier) return { error: "Pick a plan to continue." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  let checkoutUrl: string;

  try {
    const stripe = getStripe();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: requirePriceId(tier.priceEnvVar), quantity: 1 },
    ];

    if (withMonthlyPresence) {
      lineItems.push({
        price: requirePriceId(MONTHLY_PRESENCE.priceEnvVar),
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      // Subscription mode when the add-on is kept, so the recurring price and
      // the one-time tier settle together on the first invoice.
      mode: withMonthlyPresence ? "subscription" : "payment",
      line_items: lineItems,
      customer_email: user.email,
      client_reference_id: projectId,
      // The webhook has no session, so everything it needs to write the order
      // travels on the session's metadata.
      metadata: {
        project_id: projectId,
        user_id: user.id,
        tier: tier.id,
        monthly_presence: withMonthlyPresence ? "true" : "false",
      },
      ...(withMonthlyPresence
        ? {
            subscription_data: {
              metadata: { project_id: projectId, user_id: user.id },
            },
          }
        : {}),
      success_url: `${getSiteUrl()}/app/projects/${projectId}/kit?purchase=complete`,
      cancel_url: `${getSiteUrl()}/app/projects/${projectId}/checkout?purchase=canceled`,
    });

    if (!session.url) {
      return { error: "Stripe did not return a checkout link. Try again." };
    }

    // Recorded as pending now so an abandoned checkout is still visible; the
    // webhook is what flips it to paid. Written with the service-role client
    // because `orders` has no INSERT policy by design — nothing client-side
    // may ever mint a purchase record, not even a pending one.
    await createAdminClient().from("orders").insert({
      user_id: user.id,
      project_id: projectId,
      tier: tier.id,
      amount_cents: tier.amountCents,
      currency: "usd",
      status: "pending",
      stripe_checkout_session_id: session.id,
    });

    checkoutUrl = session.url;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start checkout. Try again.",
    };
  }

  // Outside the try: redirect() throws by design and must not be caught.
  redirect(checkoutUrl);
}
