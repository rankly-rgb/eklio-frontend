import "server-only";

import Stripe from "stripe";

/**
 * Le client Stripe. Serveur uniquement — STRIPE_SECRET_KEY n'est jamais
 * préfixée NEXT_PUBLIC_.
 */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante côté serveur.");
  return new Stripe(key);
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
