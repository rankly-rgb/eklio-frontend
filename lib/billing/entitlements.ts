import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionStatus } from "@/types/supabase";
import { highestTier } from "@/lib/billing/plans";
import { parseKitTier, type KitTier } from "@/lib/kit/tiers";

/*
 * Ce à quoi un praticien a DROIT.
 *
 * Deux droits distincts, et la distinction n'est pas cosmétique :
 *
 * - le TIER DE KIT vient de `purchases` (paiement unique). C'est un journal
 *   d'ÉVÉNEMENTS : un upgrade ajoute une ligne, il n'en remplace aucune. Le
 *   droit courant est donc le PLUS GÉNÉREUX des achats payés, jamais le
 *   dernier (cf. `highestTier`).
 * - l'ABONNEMENT vient de `subscriptions`, une ligne par utilisateur, tenue à
 *   jour par le webhook Stripe.
 *
 * `brand_kits.tier` n'entre PAS dans ce calcul : c'est l'instantané du
 * périmètre livré à la génération, pas le droit courant. Le commentaire de la
 * colonne en base le dit explicitement.
 */

type Client = SupabaseClient<Database>;

/* ── LA règle d'accès, écrite une seule fois ────────────────────────────── */

/**
 * Le délai de grâce sur `past_due`. Il existe pour qu'une carte refusée ne
 * vide pas le calendrier de contenu de quelqu'un le matin même : Stripe
 * réessaie, et trois jours suffisent presque toujours.
 */
export const PAST_DUE_GRACE_DAYS = 3;
const GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type Subscription = {
  status: SubscriptionStatus | string;
  /** ISO 8601, tel qu'il est en base. `null` quand Stripe ne l'a pas encore posé. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
};

/**
 * LA fonction d'accès à Monthly Presence. Tout passe par elle : les tuiles
 * verrouillées du calendrier, la carte Monthly Presence du kit, la route
 * `unlock`, et le choix du cron mensuel entre un post prêt et seize.
 *
 * `subscriptions.active` est une colonne GÉNÉRÉE, miroir du statut Stripe.
 * Ce n'est PAS la règle d'accès : la base ne tient délibérément aucune
 * horloge, donc la grâce sur `past_due` se décide ici, et seulement ici.
 *
 *   entitled = status ∈ {active, trialing}
 *           || (status = past_due ET current_period_end + 3 jours > maintenant)
 *
 * `now` est un paramètre pour que les quatre bornes soient testables sans
 * geler l'horloge du processus.
 */
export function isEntitledToMonthlyPresence(
  subscription: Subscription | null,
  now: Date = new Date()
): boolean {
  if (!subscription) return false;

  if (subscription.status === "active" || subscription.status === "trialing") {
    return true;
  }

  if (subscription.status !== "past_due") return false;

  // Un `past_due` sans fin de période connue n'ouvre rien : on ne devine pas
  // une date de grâce qu'on n'a pas.
  if (!subscription.currentPeriodEnd) return false;

  const periodEnd = Date.parse(subscription.currentPeriodEnd);
  if (Number.isNaN(periodEnd)) return false;

  return periodEnd + GRACE_MS > now.getTime();
}

/* ── Lectures ───────────────────────────────────────────────────────────── */

/**
 * L'abonnement de l'utilisateur courant, ou `null` s'il n'en a aucun.
 *
 * La RLS de `subscriptions` est propriétaire-only en lecture : le client de
 * session suffit, la service_role n'a rien à faire ici.
 */
export async function getSubscription(
  supabase: Client,
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "status, current_period_end, cancel_at_period_end, stripe_subscription_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // On ne DEVINE pas un droit en cas d'erreur de lecture : pas de droit.
    console.error("[entitlements] lecture subscriptions", error);
    return null;
  }
  if (!data) return null;

  return {
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

/**
 * Tier de kit auquel ce praticien a droit sur ce projet, ou `null` s'il n'a
 * rien payé.
 *
 * Un achat sans `project_id` (checkout lancé depuis `/pricing`, avant d'avoir
 * choisi le projet) compte pour TOUS ses projets : refuser de servir un
 * paiement encaissé parce qu'il n'était rattaché à rien serait une régression
 * de facturation, pas une sécurité.
 */
export async function resolveEntitledTier(
  supabase: Client,
  projectId: string
): Promise<KitTier | null> {
  const { data, error } = await supabase
    .from("purchases")
    .select("tier, project_id")
    .eq("status", "paid")
    .or(`project_id.eq.${projectId},project_id.is.null`);

  if (error) {
    console.error("[entitlements] lecture purchases", error);
    return null;
  }

  const tiers = (data ?? [])
    .map((row) => parseKitTier(row.tier))
    .filter((tier): tier is KitTier => tier !== null);

  return highestTier(tiers);
}
