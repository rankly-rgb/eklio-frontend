import Stripe from "stripe";
import { MONTHLY_PRESENCE, KIT_PLANS } from "@/lib/billing/plans";
import type { KitTier } from "@/lib/kit/tiers";

/*
 * Client Stripe — STRICTEMENT serveur.
 *
 * Même convention que `lib/ai/client.ts` : aucune clé n'est écrite dans le
 * repo, aucune n'est préfixée `NEXT_PUBLIC_` (sauf la publiable, qui l'est par
 * nature), et ce module n'est importé que par des Server Actions et des route
 * handlers. Un import depuis un composant client embarquerait `STRIPE_SECRET_KEY`
 * dans le bundle du navigateur — d'où la lecture PARESSEUSE ci-dessous : rien
 * n'est lu au chargement du module, donc un import fautif casse au premier
 * appel plutôt que de fuiter silencieusement au build.
 *
 * La version d'API n'est pas épinglée à la main : le SDK envoie la sienne
 * (`Stripe.apiVersion`), celle contre laquelle ses types sont générés. Épingler
 * une chaîne différente ici ferait mentir les types sur ce que l'API renvoie.
 */

let client: Stripe | null = null;

/** Levée quand une variable Stripe manque. Message serveur, jamais rendu tel quel. */
export class StripeConfigError extends Error {
  constructor(name: string) {
    super(
      `Variable d'environnement Stripe manquante : ${name}. Voir .env.example.`
    );
    this.name = "StripeConfigError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new StripeConfigError(name);
  return value;
}

export function getStripeClient(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return client;
}

/** Secret de signature du webhook. Sans lui, aucun event n'est accepté. */
export function getWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

/**
 * Id du prix Stripe d'un tier de kit (`price_…`).
 *
 * Les ids DIFFÈRENT entre le mode test et le mode live : les figer dans le
 * repo garantirait de facturer en test contre un catalogue live, ou l'inverse.
 * `lib/billing/plans.ts` ne porte donc que le NOM de la variable.
 */
export function kitPriceId(tier: KitTier): string {
  return requireEnv(KIT_PLANS[tier].priceEnvVar);
}

/** Id du prix récurrent de l'abonnement Monthly Presence. */
export function monthlyPresencePriceId(): string {
  return requireEnv(MONTHLY_PRESENCE.priceEnvVar);
}
