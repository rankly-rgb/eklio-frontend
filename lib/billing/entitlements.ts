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

/* ── Le droit sur UN kit — la base fait autorité ─────────────────────────── */

/**
 * Ce kit est-il déverrouillé pour l'appelante ?
 *
 * ⚠ ON NE REPOSE PAS LA QUESTION ICI. `brand_kit_entitled` vit en base, à côté
 * des policies qui refusent déjà les écritures ; une seconde implémentation de
 * la même phrase finirait par diverger de la première, et le jour où ça
 * arrive c'est la version la plus permissive qui gagne — c'est-à-dire nous.
 * `resolveEntitledTier` ci-dessus répond à une AUTRE question (« quel palier
 * a-t-elle payé »), pour un autre usage.
 *
 * ── ÉCHEC FERMÉ ─────────────────────────────────────────────────────────
 *
 * Une erreur de lecture rend `false`. Un droit qu'on n'a pas pu vérifier n'est
 * pas un droit accordé : le pire résultat d'un refus injustifié est un
 * checkout affiché à quelqu'un qui a payé — visible, réparable, et qui remonte
 * en support. Le pire résultat de l'inverse est un livrable qui part sans
 * contrepartie, et celui-là ne remonte jamais.
 */
export async function isBrandKitEntitled(
  supabase: Client,
  brandKitId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("brand_kit_entitled", {
    p_brand_kit_id: brandKitId,
  });

  if (error) {
    console.error("[entitlements] brand_kit_entitled", error);
    return false;
  }
  return data === true;
}

/* ── Les projets qu'on n'a pas payés ─────────────────────────────────────── */

/**
 * Combien de projets de cette utilisatrice ne sont adossés à AUCUN achat.
 *
 * ── Pourquoi ce compte, et pas celui des projets ────────────────────────
 *
 * Le plafond existe pour empêcher de remettre à zéro l'allocation de
 * génération avec « New brief » : le crédit est par kit, un kit par projet,
 * donc sans plafond la porte à côté est grande ouverte.
 *
 * Mais quelqu'un qui a payé ne cultive rien. Compter ses projets payés
 * reviendrait à lui opposer un mur après trois achats — un ticket de support
 * qu'on ne devrait jamais recevoir. Le compte ne porte donc que sur les
 * projets NON ADOSSÉS À UN ACHAT, et le refus n'atteint jamais que ceux à qui
 * il est destiné.
 *
 * ── L'achat sans projet ─────────────────────────────────────────────────
 *
 * Un checkout lancé depuis `/pricing`, avant d'avoir choisi un projet, écrit
 * `project_id: null`. `resolveEntitledTier` le fait valoir pour TOUS ses
 * projets ; le même raisonnement s'applique ici, sinon on refuserait un
 * nouveau brief à quelqu'un qui vient de payer.
 */
export async function countUnpaidProjects(
  supabase: Client,
  userId: string
): Promise<number> {
  const [{ data: projects, error: projectsError }, { data: purchases, error: purchasesError }] =
    await Promise.all([
      supabase.from("projects").select("id").eq("user_id", userId),
      supabase.from("purchases").select("project_id").eq("status", "paid"),
    ]);

  if (projectsError || purchasesError) {
    // On ne DEVINE pas. Zéro laisse passer la création, ce qui est le bon sens
    // du repli ici : le plafond est une mesure anti-abus, pas une garde de
    // sécurité, et le crédit de génération reste atomique derrière.
    console.error(
      "[entitlements] comptage des projets non payés",
      projectsError ?? purchasesError
    );
    return 0;
  }

  const paid = purchases ?? [];
  // Un achat sans projet vaut pour tous : rien n'est « non payé ».
  if (paid.some((row) => row.project_id === null)) return 0;

  const paidProjects = new Set(paid.map((row) => row.project_id));
  return (projects ?? []).filter((project) => !paidProjects.has(project.id)).length;
}
