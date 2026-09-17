import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getStripeClient,
  kitPriceId,
  monthlyPresencePriceId,
} from "@/lib/stripe/client";
import { includesMonthlyPresence, tierRank } from "@/lib/billing/plans";
import { siteUrl } from "@/lib/site-url";
import { buildCheckoutMetadata } from "@/lib/stripe/metadata";
import type { KitTier } from "@/lib/kit/tiers";
import { loadSitePlatforms, qualify } from "@/lib/brief/platform";

/*
 * Création de la session Stripe Checkout (hébergée) — serveur uniquement.
 *
 * Trois formes de session :
 *
 * - PRACTICE SUITE (`signature`) : `mode: "payment"`, UNE seule ligne, le kit.
 *   Les trois mois de Monthly Presence inclus ne sont PAS une ligne de cette
 *   session — voir le bloc ⚠ ci-dessous, c'est la décision structurante du lot.
 * - AVEC Monthly Presence choisi : `mode: "subscription"`, avec DEUX lignes dans
 *   la même session — le prix récurrent de l'abonnement et le prix unique du
 *   kit. Stripe facture la ligne unique sur la première facture de
 *   l'abonnement ; le praticien paie donc une fois, pour les deux.
 * - SANS : `mode: "payment"`, une seule ligne.
 *
 * Un `mode` qui ne correspond pas aux lignes est refusé par l'API — d'où le
 * branchement explicite plutôt qu'un objet construit à la volée.
 *
 * ── ⚠ POURQUOI L'ABONNEMENT INCLUS N'EST PAS CRÉÉ PAR CE CHECKOUT ─────────
 *
 * La forme « évidente » serait `mode: "subscription"` avec les deux lignes et
 * `subscription_data.trial_period_days: 90`. Elle est écartée, et pour une
 * raison de trésorerie, pas de style.
 *
 * Dans une session `subscription`, une ligne à prix UNIQUE devient un poste de
 * la PREMIÈRE FACTURE de l'abonnement. Avec un essai de 90 jours, cette
 * première facture n'est émise qu'à la FIN de l'essai. Le risque est donc de
 * livrer un kit à $249 et de n'encaisser rien pendant trois mois, sur un
 * abonnement qu'elle peut résilier entre-temps.
 *
 * Je n'ai pas pu vérifier depuis cet environnement ce que Stripe fait
 * exactement d'un poste unique sur la première facture d'un abonnement en
 * essai — et c'est précisément le genre de détail qu'il ne faut pas deviner
 * quand la réponse vaut $249 par vente. Le montage ci-dessous rend la question
 * SANS OBJET : le kit est encaissé immédiatement en `mode: "payment"`, et
 * l'abonnement est créé ensuite, par le webhook, une fois l'argent arrivé
 * (cf. `lib/stripe/monthly-presence.ts`). Deux opérations indépendantes, dont
 * une seule porte de l'argent.
 *
 * `setup_future_usage: "off_session"` est ce qui rend ce montage possible : il
 * attache la carte au customer, pour que l'abonnement créé plus tard ait de
 * quoi prélever au bout des 90 jours.
 */

type Client = SupabaseClient<Database>;

export type CheckoutInput = {
  userId: string;
  email: string;
  tier: KitTier;
  /** Null quand le checkout part de `/pricing`, avant tout choix de projet. */
  projectId: string | null;
  /** Coché par défaut dans l'interface ; décochable, et ça compte. */
  withMonthlyPresence: boolean;
};

/**
 * Le client Stripe de cet utilisateur : celui déjà enregistré, ou un nouveau.
 *
 * UN SEUL customer par utilisateur, pour le paiement unique COMME pour
 * l'abonnement. C'est ce qui rend le chemin inverse possible : le webhook
 * reçoit un `customer` et doit retrouver l'utilisateur, ce qu'il fait par
 * `profiles.stripe_customer_id` (colonne unique). Deux customers pour un même
 * praticien casseraient cette résolution, et son abonnement se retrouverait
 * rattaché à un compte fantôme.
 *
 * La clé d'idempotence dérive de l'id utilisateur : deux checkouts lancés en
 * même temps depuis deux onglets rendent alors le MÊME customer au lieu d'en
 * créer deux.
 */
export async function ensureStripeCustomer(
  supabase: Client,
  { userId, email }: { userId: string; email: string }
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[checkout] lecture profil", error);
  }
  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await getStripeClient().customers.create(
    {
      email,
      metadata: { eklio_user_id: userId },
    },
    { idempotencyKey: `eklio-customer-${userId}` }
  );

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    /*
     * Le customer EXISTE chez Stripe mais n'a pas pu être noté ici. On ne
     * lève pas : le paiement doit pouvoir aboutir, et le webhook sait poser la
     * correspondance manquante à réception (cf. `resolveUserId`). Journalisé
     * parce que c'est une anomalie, pas un cas nominal.
     */
    console.error("[checkout] écriture stripe_customer_id", updateError);
  }

  return customer.id;
}

/** Lignes de la session, dans l'ordre où le praticien les lira sur Stripe. */
function lineItems(
  tier: KitTier,
  withMonthlyPresence: boolean
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items = [{ price: kitPriceId(tier), quantity: 1 }];
  /*
   * `subscribeNow` est déjà faux pour un tier qui inclut l'abonnement (cf.
   * `createCheckoutSession`), mais la garde est répétée ici parce que c'est
   * CETTE fonction qui décide de facturer $39 de plus : ajouter la ligne
   * récurrente à une praticienne qui vient de payer pour trois mois offerts
   * lui ferait payer le mois qu'on lui offre.
   */
  if (withMonthlyPresence && !includesMonthlyPresence(tier)) {
    items.push({ price: monthlyPresencePriceId(), quantity: 1 });
  }
  return items;
}

/**
 * Crée la session et rend l'URL hébergée par Stripe.
 *
 * `client_reference_id` et les métadonnées portent la même information par
 * deux chemins : le webhook peut ainsi rattacher le paiement même si la
 * correspondance customer → user n'a pas pu être écrite au moment du checkout.
 */
/**
 * Ce SKU n'est pas en vente.
 *
 * ⚠ PAS « pas encore disponible ». Trois lignes du catalogue portent un prix
 * et ne livrent rien : `roster_seat` (un siège acheté ne produit aucun kit
 * tant que L21 n'a pas écrit ce que l'arrivée d'une clinicienne déclenche),
 * `fill_solo` et `fill_practice` (le cycle mensuel qu'elles vendent n'existe
 * pas). `DECISIONS_NEEDED.md` §4 et §7 l'ont écrit au lot 1, et se terminaient
 * tous les deux par « il ne faut pas les mettre en vente » — une consigne, qui
 * survit tant que quelqu'un est là pour la rappeler.
 *
 * `plans.sellable` est cette consigne devenue une donnée, et cette classe est
 * ce qui la lit à l'endroit où l'argent bouge.
 */
export class UnsellableSkuError extends Error {
  constructor(public readonly sku: string) {
    super(`${sku} is not on sale.`);
    this.name = "UnsellableSkuError";
  }
}

/**
 * Refuse le checkout d'un SKU que le produit ne sait pas livrer.
 *
 * ⚠ CETTE GARDE-CI ÉCHOUE FERMÉ, ET C'EST L'INVERSE DE SA VOISINE. Dix lignes
 * plus bas, `alreadyPaidFor` rend `null` quand la lecture échoue, avec une
 * raison écrite : un hoquet de base ne doit pas coûter une cliente. Les deux
 * règles coexistent parce qu'elles ne répondent pas à la même sorte de
 * question.
 *
 *   `alreadyPaidFor`  « CETTE cliente-ci a-t-elle déjà payé CE projet-là ? »
 *                     La réponse change d'une cliente à l'autre et d'une
 *                     minute à l'autre. Il FAUT une lecture vivante pour avoir
 *                     raison, et quand elle manque, on ne sait pas.
 *
 *   ici               « cette ligne de catalogue est-elle en vente ? »
 *                     La réponse est la même pour tout le monde et ne bouge
 *                     qu'au rythme des lots. Une lecture manquante sur un fait
 *                     quasi statique n'est pas une incertitude : c'est une
 *                     absence de réponse, et une absence de réponse n'ouvre
 *                     pas une caisse.
 *
 * Et le coût réel de ce choix est petit : `ensureStripeCustomer`, juste après,
 * lit `profiles` avec le MÊME client. Une base qui ne rend pas `plans` ne
 * rendra pas `profiles` non plus, et ce checkout allait échouer de toute façon.
 * Échouer fermé ici ne perd donc presque aucune vente réelle — il ferme le cas
 * où la lecture échoue précisément sur la ligne qui disait non.
 *
 * ⚠ UNE LIGNE ABSENTE EST UN REFUS AUSSI. Un `tier` qui n'est pas dans `plans`
 * est un SKU que le catalogue ne connaît pas. Le laisser passer ferait de la
 * garde une garde sur les noms qu'on a pensé à écrire.
 */
async function refuseIfUnsellable(
  supabase: Client,
  sku: string,
  projectId: string | null
): Promise<void> {
  const { data, error } = await supabase
    .from("plans")
    .select("sellable, requires_publishable_platform")
    .eq("tier", sku)
    .maybeSingle();

  if (error) {
    console.error(`[checkout] sellability read: ${error.message}`);
    throw new UnsellableSkuError(sku);
  }
  if (!data || !data.sellable) {
    throw new UnsellableSkuError(sku);
  }

  /*
   * ── LA SECONDE RAISON, À LA MÊME PORTE ────────────────────────────────
   *
   * `sellable` répond « à personne ». Celle-ci répond « pas à elle ». Elles
   * vivent dans la même fonction parce qu'un second point de passage serait un
   * second endroit où l'on peut oublier de brancher une règle — et c'est
   * précisément le défaut que ce lot corrige.
   *
   * ⚠ CE N'EST PAS UN REFUS. Ce qui est fermé ici, ce sont les SKU qui
   * PROMETTENT qu'Eklio publie. L'offre précédente ne le promet pas, porte
   * `requires_publishable_platform = false`, et ne passe donc jamais par ce
   * bloc : quelqu'un sur Wix continue d'acheter tout ce qu'on sait lui livrer.
   */
  if (!data.requires_publishable_platform) return;

  /*
   * ⚠ SANS PROJET, PAS DE RÉPONSE — ET PAS DE VENTE DE CE SKU-LÀ. La
   * plateforme est une réponse du brief ; un checkout parti de `/pricing` n'en
   * a pas. On ne DEVINE pas : encaisser 390 $ en promettant de publier sur une
   * plateforme dont on ne sait rien est exactement ce que cette colonne existe
   * pour empêcher. Le `notice` est nul, et l'écran dit alors de commencer un
   * brief — ce qui est la vraie prochaine étape, pas une porte fermée.
   *
   * C'est le même sens de repli que `loadSitePlatforms`, qui rend une liste
   * VIDE sur une lecture ratée, et pour la même raison écrite là-bas.
   */
  if (!projectId) throw new PlatformNotEligibleError(sku, null);

  const { data: brief, error: briefError } = await supabase
    .from("project_briefs")
    .select("site_platform_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (briefError) {
    console.error(`[checkout] platform read: ${briefError.message}`);
    throw new PlatformNotEligibleError(sku, null);
  }

  const platforms = await loadSitePlatforms(supabase);
  const verdict = qualify(brief?.site_platform_id, platforms);

  /*
   * ⚠ `conditional` PASSE. C'est la raison d'être du troisième état : on prend
   * l'inscription, et ce qui n'est pas garanti a déjà été dit à l'étape 1,
   * avant qu'elle arrive ici. Le transformer en refus au paiement rendrait
   * `conditional` identique à `refused`, et la colonne ne dirait plus rien.
   */
  if (verdict.ok) return;

  throw new PlatformNotEligibleError(
    sku,
    "notice" in verdict ? verdict.notice : null
  );
}

/**
 * A kit this project has already been paid for.
 *
 * ⚠ MEASURED, NOT SUPPOSED. Two Checkout sessions for the same project and
 * tier were exercised against the live database: both wrote a `purchases` row
 * and BOTH opened an allowance, because `purchases` is unique on the Stripe
 * session id and a second press gets a second session id. $158 for one $79
 * kit, and nothing in the schema noticed.
 *
 * ⚠ AND IT IS NOT ATOMIC, WHICH IS WHY IT SITS BEFORE THE CHARGE RATHER THAN
 * AFTER IT. Two genuinely simultaneous presses can still both read "nothing
 * paid" and both proceed. The alternative -- a unique index on
 * (project_id, tier) where status = 'paid' -- would make the SECOND WEBHOOK
 * fail, which means the money is taken and the row is lost: strictly worse,
 * because there is no refund primitive anywhere in this product. A guard in
 * front of the payment can only ever fail towards not charging.
 */
/**
 * Ce SKU promet une publication, et on ne publiera pas sur SA plateforme.
 *
 * ⚠ CE N'EST PAS UN REFUS DE VENTE, ET LA DISTINCTION EST TOUT LE SUJET.
 * `UnsellableSkuError` dit « on ne sait livrer ça à personne ».
 * Celle-ci dit « on ne sait pas livrer CE SKU-LÀ à ELLE » — et tout ce qui ne
 * promet pas de publication lui reste ouvert. L'offre précédente n'est pas
 * retirée de la vente et n'a jamais promis qu'Eklio publierait : elle livre des
 * fichiers et un texte à coller.
 *
 * Elle porte le `notice` de `site_platforms`, donc la phrase que la cliente lit
 * vient de la base et pas d'ici. Un écran qui refuse sans expliquer est un
 * ticket de support ; un écran qui explique avec une phrase écrite en dur
 * cesse d'être vrai au premier changement d'avis.
 */
export class PlatformNotEligibleError extends Error {
  constructor(
    public readonly sku: string,
    /** La phrase de `site_platforms.notice`, ou `null` si on n'a pas de réponse. */
    public readonly notice: string | null
  ) {
    super(`${sku} needs a platform we can publish to.`);
    this.name = "PlatformNotEligibleError";
  }
}

export class AlreadyPurchasedError extends Error {
  constructor(public readonly tier: KitTier) {
    super(`This project already has a paid ${tier} kit.`);
    this.name = "AlreadyPurchasedError";
  }
}

async function alreadyPaidFor(
  supabase: Client,
  projectId: string,
  tier: KitTier
): Promise<KitTier | null> {
  const { data, error } = await supabase
    .from("purchases")
    .select("tier")
    .eq("project_id", projectId)
    .eq("status", "paid");

  /*
   * ⚠ A READ THAT FAILS DOES NOT BLOCK THE SALE. Every other fail-closed rule
   * in this product guards a deliverable; this one guards a PAYMENT, and the
   * two point in opposite directions. Refusing a checkout because a read
   * failed would turn a database hiccup into a lost customer, and the failure
   * it is protecting against -- a second charge -- is visible, refundable by
   * hand, and remembered in `purchases`.
   */
  if (error) {
    console.error(`[checkout] paid-already read: ${error.message}`);
    return null;
  }

  /*
   * The same tier or better. An UPGRADE is a real purchase and must go
   * through: she bought Starter and wants Signature, and `highestTier` is
   * already the rule everywhere else that what she owns is the most generous
   * thing she bought.
   */
  for (const row of data ?? []) {
    const owned = row.tier as KitTier;
    if (tierRank(owned) >= tierRank(tier)) return owned;
  }
  return null;
}

export async function createCheckoutSession(
  supabase: Client,
  input: CheckoutInput
): Promise<string> {
  const { userId, email, tier, projectId, withMonthlyPresence } = input;

  /*
   * ⚠ PREMIÈRE QUESTION, AVANT TOUTE AUTRE : est-ce seulement en vente ?
   *
   * Avant la cliente, avant le projet, avant Stripe. Les autres gardes de
   * cette fonction demandent si CETTE vente-ci est légitime ; celle-ci demande
   * si la chose vendue existe. Une réponse « non » ici rend les suivantes sans
   * objet.
   *
   * `kitTierSchema`, dans l'action serveur, refuse déjà les trois SKU
   * invendables — ils ne sont pas des `KitTier`. Cette garde n'est donc pas la
   * seule, et c'est voulu : le jour où L20 ou L21 élargit `startCheckout` pour
   * accepter un SKU plutôt qu'un palier, le refus est DÉJÀ sur le chemin de
   * l'argent, et il se lève par un UPDATE au lieu d'être réinventé.
   */
  await refuseIfUnsellable(supabase, tier, projectId);

  /*
   * Before Stripe, before the customer: a second charge for a kit she already
   * owns is the one failure here that costs her money rather than costing us
   * a sale.
   */
  if (projectId) {
    const owned = await alreadyPaidFor(supabase, projectId, tier);
    if (owned) throw new AlreadyPurchasedError(owned);
  }

  const customerId = await ensureStripeCustomer(supabase, { userId, email });
  const metadata = buildCheckoutMetadata({ userId, projectId, tier });

  const base = siteUrl();

  /*
   * ⚠ SOUSCRIRE MAINTENANT, ou pas du tout dans CETTE session.
   *
   * Practice Suite inclut trois mois : la case cochée est alors sans objet, et
   * l'honorer créerait un abonnement facturé $39 immédiatement à quelqu'un à
   * qui on vient de promettre trois mois offerts. On l'ignore donc ici plutôt
   * que de faire confiance à l'interface pour ne jamais l'envoyer — le client
   * est une entrée, pas une autorité.
   */
  const included = includesMonthlyPresence(tier);
  const subscribeNow = withMonthlyPresence && !included;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: subscribeNow ? "subscription" : "payment",
    customer: customerId,
    client_reference_id: userId,
    line_items: lineItems(tier, subscribeNow),
    metadata,
    /*
     * `{CHECKOUT_SESSION_ID}` est substitué par Stripe à la redirection. La
     * page de succès s'en sert pour AFFICHER l'état de la confirmation — elle
     * n'accorde jamais l'accès elle-même : la vérité vient du webhook.
     */
    success_url: `${base}/app/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/checkout/canceled`,
    allow_promotion_codes: false,
  };

  if (subscribeNow) {
    /*
     * L'abonnement n'hérite PAS des métadonnées de la session : sans ce bloc,
     * un `customer.subscription.updated` arriverait sans le moindre indice de
     * l'utilisateur concerné. La résolution passerait alors uniquement par le
     * customer — et perdrait tout si celui-ci n'avait pas été noté en base.
     */
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = {
      metadata,
      /*
       * ⚠ LA CARTE EST GARDÉE QUAND, ET SEULEMENT QUAND, ON DEVRA S'EN
       * RESERVIR. Pour Practice Suite, l'abonnement est créé après coup par le
       * webhook : sans carte attachée au customer, il n'aurait rien à prélever
       * au bout des 90 jours, et `missing_payment_method` déciderait du sort
       * d'une praticienne qui a pourtant payé $249.
       *
       * Pour les deux autres tiers, aucun prélèvement futur n'est prévu par ce
       * paiement — on ne conserve donc pas le moyen de paiement. Garder une
       * carte « au cas où » est une collecte qu'on ne saurait pas justifier.
       */
      ...(included ? { setup_future_usage: "off_session" as const } : {}),
    };
  }

  const session = await getStripeClient().checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe n'a pas rendu d'URL de checkout.");
  }
  return session.url;
}

/**
 * Checkout de l'abonnement SEUL — la tuile verrouillée du calendrier et la
 * carte Monthly Presence du kit y mènent.
 *
 * Pas de ligne de kit : ce praticien a déjà payé le sien. Le `mode` est
 * `subscription`, et les métadonnées sont posées sur l'abonnement pour que le
 * webhook sache à qui le rattacher même si la correspondance customer → user
 * n'existait pas encore.
 */
export async function createMonthlyPresenceCheckout(
  supabase: Client,
  { userId, email }: { userId: string; email: string }
): Promise<string> {
  const customerId = await ensureStripeCustomer(supabase, { userId, email });
  const metadata = { eklio_user_id: userId };
  const base = siteUrl();

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: monthlyPresencePriceId(), quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: `${base}/app/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/checkout/canceled`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    throw new Error("Stripe n'a pas rendu d'URL de checkout.");
  }
  return session.url;
}
