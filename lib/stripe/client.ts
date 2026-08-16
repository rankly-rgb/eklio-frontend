import "server-only";

import Stripe from "stripe";

/**
 * The Stripe client.
 *
 * Server-only, and the secret key is never prefixed NEXT_PUBLIC_. We use
 * Stripe's hosted Checkout, so no card data ever reaches this application and
 * the publishable key is not needed either — the browser only receives a
 * redirect URL.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Checkout is disabled until it is configured server-side."
    );
  }

  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

/**
 * Reads a Stripe Price id from the environment. Prices live in the Stripe
 * dashboard, not in code, so test and live mode can differ without a deploy.
 */
export function requirePriceId(envVar: string): string {
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(
      `${envVar} is not set. Add the Stripe Price id for this plan before taking payments.`
    );
  }
  return priceId;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
