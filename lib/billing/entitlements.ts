import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PurchaseStatus, SubscriptionStatus } from "@/types/supabase";
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
  /*
   * ⚠ THIS PROJECT, AND ONLY THIS PROJECT.
   *
   * It used to read `project_id.eq.X, or project_id.is.null` — a purchase with
   * no project attached counted for EVERY project the account owns. That is
   * not a rare shape and it is not a hypothetical: two different paths produce
   * one, and both were measured in session 4 (`ACQUISITION_WALK.md` §14.6).
   *
   *   1. The brief claim fails at signup, so the checkout page's RLS read finds
   *      no project and `buildCheckoutMetadata` carries `projectId: null`.
   *   2. `purchases_project_id_fkey` is ON DELETE SET NULL. Deleting any
   *      project detaches its purchase rather than removing it — the teardown
   *      in `REHEARSAL.md` was itself one of the entrances.
   *
   * Either way one orphan row said "paid" about work it had never paid for.
   * `brand_kit_entitled` in the database was always scoped to the project, so
   * the deliverable stayed shut — which made this worse, not better: the screen
   * said unlocked, the database said no, and she pressed a direction and was
   * bounced back to checkout for a kit she had apparently bought.
   *
   * One condition closes both entrances. A purchase that names no project buys
   * nothing, which is also exactly what `grant_plan_allowance` already does
   * with one (it returns false on a null project).
   */
  const { data, error } = await supabase
    .from("purchases")
    .select("tier, project_id")
    .eq("status", "paid")
    .eq("project_id", projectId);

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

/* ── Comp access — un signal d'AFFICHAGE, jamais un droit ────────────────── */

/**
 * L'utilisatrice courante a-t-elle un accès comp actif ?
 *
 * ⚠ CECI N'ACCORDE RIEN. C'est un signal d'affichage — pour distinguer une
 * session comp d'une session payante en QA ou sur une capture d'écran — pas
 * une seconde façon de décider un droit. Le droit reste entièrement dans
 * `brand_kit_entitled` (en base) : `comp_access_active()` y est déjà lu en
 * interne, elle n'est pas redécidée ici.
 *
 * ── ÉCHEC FERMÉ ─────────────────────────────────────────────────────────
 * Une erreur de lecture rend `false` : au pire l'indicateur manque, jamais
 * l'inverse.
 */
export async function isCompAccessActive(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.rpc("comp_access_active");

  if (error) {
    console.error("[entitlements] comp_access_active", error);
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
 * ── ⚠ L'ACHAT SANS PROJET NE COMPTE PLUS, ET LE RAISONNEMENT A CHANGÉ ────
 *
 * Ce bloc disait : « un checkout lancé depuis `/pricing` écrit
 * `project_id: null` ; `resolveEntitledTier` le fait valoir pour TOUS ses
 * projets, donc le même raisonnement s'applique ici. » La prémisse a été
 * retirée en session 4 — `resolveEntitledTier` est désormais scopé au projet —
 * donc la conclusion tombe avec elle.
 *
 * Ce qu'on a appris en la retirant : cette règle ne faisait pas MARCHER
 * l'achat depuis `/pricing`, elle le faisait SEMBLER marcher. `grant_plan_
 * allowance` rend `false` sur un projet nul, et `brand_kit_entitled` en base a
 * toujours été scopé au projet. Une ligne orpheline n'ouvrait donc rien du
 * tout : elle faisait seulement dire « payé » à l'écran pendant que la base
 * refusait. Une seule ligne orpheline désactivait aussi ce plafond-ci pour
 * toujours, sur ce compte.
 *
 * Le plafond reste généreux (trois briefs) et reste FAIL-OPEN sur une erreur
 * de lecture : c'est une mesure anti-abus, pas une garde de sécurité. Et une
 * acheteuse partie de `/pricing` est maintenant VISIBLE — `npm run funnel`
 * affiche les achats sans projet en tête de rapport, pour qu'on rattache le
 * sien à la main plutôt qu'un droit fantôme le fasse en silence.
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

  /*
   * Un achat NOMME le projet qu'il a payé, ou il n'en paye aucun. C'est la
   * même phrase que `resolveEntitledTier` et que `grant_plan_allowance`
   * disent déjà, et les trois doivent la dire pareil.
   */
  const paidProjects = new Set(
    (purchases ?? [])
      .map((row) => row.project_id)
      .filter((id): id is string => id !== null)
  );
  return (projects ?? []).filter((project) => !paidProjects.has(project.id)).length;
}

/* ── Ce qu'on dit quand un achat a été annulé ────────────────────────────── */

/**
 * Les statuts qui veulent dire « l'argent est reparti ».
 *
 * `partially_refunded` n'en est PAS : elle a acheté la chose et en a récupéré
 * une part. Lui fermer le kit pour un geste commercial serait exactement le
 * genre de mur qu'on vient de retirer du plafond de projets.
 *
 * ⚠ CETTE LISTE DOIT DIRE LA MÊME CHOSE QUE `brand_kit_entitled`, qui est la
 * seule autorité sur le droit. Elle ne décide rien — elle choisit un TEXTE —
 * mais si les deux divergent, la praticienne lit « votre achat a été annulé »
 * sur un kit qui s'ouvre, ou l'inverse. Exporté pour être épinglé par un test :
 * le jour où la base change d'avis, la divergence doit se voir ici et pas en
 * production.
 */
export const REVERSED_STATUSES = ["refunded", "disputed"] as const;

/** Les statuts qui laissent le kit ouvert. Le complément exact du précédent. */
export const ENTITLING_STATUSES = [
  "paid",
  "partially_refunded",
] as const satisfies readonly PurchaseStatus[];

/**
 * L'achat de ce projet a-t-il été annulé ?
 *
 * Sert UNIQUEMENT à choisir le texte : le droit lui-même vient de
 * `brand_kit_entitled`, en base. On ne redécide rien ici, on explique.
 */
export async function purchaseWasReversed(
  supabase: Client,
  projectId: string
): Promise<boolean> {
  /*
   * ⚠ SCOPED, for the same reason as `resolveEntitledTier` above. An orphaned
   * REFUNDED purchase would otherwise tell an unrelated project that its
   * purchase had been reversed — a sentence about someone else's money, on her
   * screen.
   */
  const { data, error } = await supabase
    .from("purchases")
    .select("status")
    .eq("project_id", projectId)
    .in("status", [...REVERSED_STATUSES]);

  if (error) {
    // On ne sait pas : on dira la phrase neutre, qui est vraie dans les deux
    // cas. Se tromper de texte est moins grave que de se tromper de droit.
    console.error("[entitlements] lecture des achats annulés", error);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * La ligne montrée quand le kit est fermé.
 *
 * ⚠ LA MÊME POUR TOUT LE MONDE. Une carte volée et un litige de mauvaise foi
 * reçoivent le mot pour mot identique : nous ne savons pas lequel des deux
 * nous avons en face, et un produit qui accuse se trompera un jour sur
 * quelqu'un dont la carte a été utilisée sans lui.
 *
 * Elle dit ce qui s'est passé et comment revenir. Rien d'autre : pas de
 * reproche, pas de compte à rebours, et aucune tentative d'atteindre le
 * fichier qu'elle a déjà — il est à elle, la révocation ne porte que sur ce
 * qui vient après.
 */
export function lockedMessage(reversed: boolean): string {
  return reversed
    ? "That purchase was reversed, so this kit is locked. You can unlock it again whenever you like."
    : "Your kit is ready when you are.";
}
