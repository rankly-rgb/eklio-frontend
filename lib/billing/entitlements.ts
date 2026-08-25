import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { highestTier } from "@/lib/billing/plans";
import { parseKitTier, type KitTier } from "@/lib/kit/tiers";

/*
 * Ce à quoi un praticien a DROIT, lu depuis la base.
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
 * `brand_kits.tier` n'entre PAS dans ce calcul. Cette colonne est
 * l'instantané du périmètre à la génération — ce qui a été livré — pas le
 * droit courant ; le commentaire de la colonne en base le dit explicitement.
 * Confondre les deux ferait qu'un praticien passé de Starter à Signature
 * régénérerait éternellement un kit à 3 pages.
 *
 * Ces lectures passent par le client de session : la RLS de `purchases` et de
 * `subscriptions` est propriétaire-only en lecture, donc un utilisateur ne
 * peut voir que ses propres droits. Aucune raison d'y mettre la service_role.
 */

type Client = SupabaseClient<Database>;

/** Un abonnement dans ces états donne accès au livrable mensuel. */
const SUBSCRIBED_STATUSES = new Set(["active", "trialing"]);

export type SubscriptionState = {
  /** Vrai seulement si le webhook a confirmé un abonnement en cours. */
  isActive: boolean;
  /** Statut brut tel qu'il est en base, `null` si aucun abonnement connu. */
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const NO_SUBSCRIPTION: SubscriptionState = {
  isActive: false,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

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
    // On ne DEVINE pas un droit en cas d'erreur de lecture : pas de droit.
    console.error("[entitlements] lecture purchases", error);
    return null;
  }

  const tiers = (data ?? [])
    .map((row) => parseKitTier(row.tier))
    .filter((tier): tier is KitTier => tier !== null);

  return highestTier(tiers);
}

/**
 * État de l'abonnement Monthly Presence de l'utilisateur courant.
 *
 * `isActive` est la SEULE porte du livrable mensuel. Un `past_due` reste
 * visible dans l'interface (pour qu'on puisse le réparer) mais ne donne accès
 * à rien : la vérité vient du webhook, pas d'un retour de navigateur.
 */
export async function getSubscriptionState(
  supabase: Client,
  userId: string
): Promise<SubscriptionState> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[entitlements] lecture subscriptions", error);
    return NO_SUBSCRIPTION;
  }
  if (!data) return NO_SUBSCRIPTION;

  return {
    isActive: SUBSCRIBED_STATUSES.has(data.status),
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  };
}

/** Vrai si l'abonnement donne accès au livrable mensuel, ici et maintenant. */
export function hasMonthlyPresenceAccess(state: SubscriptionState): boolean {
  return state.isActive;
}
