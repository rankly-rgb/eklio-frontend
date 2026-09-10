import { KIT_TIERS, type KitTier } from "@/lib/kit/tiers";
import { SOLD_TIER_NAME } from "@/lib/billing/tier-names";

/*
 * Le catalogue : ce qui est vendu, à quel prix, et ce que ça contient.
 *
 * Module PUR — aucun I/O, aucun SDK Stripe, aucune clé. Il est importé par la
 * page `/pricing` (rendu), par la création de session Checkout (montants et
 * ids de prix) et par le webhook (contrôle du montant encaissé). Une seule
 * définition, donc : un prix affiché qui diverge du prix facturé est le bug
 * que ce module existe pour rendre impossible.
 *
 * Les MONTANTS vivent ici, en centimes. Les IDENTIFIANTS de prix Stripe
 * (`price_…`) n'y vivent PAS : ils diffèrent entre le mode test et le mode
 * live, donc ils viennent de l'environnement (cf. `.env.example`). Ce module
 * nomme seulement la variable à lire.
 *
 * Le NOM vendu vient de `lib/billing/tier-names.ts`, un seul endroit, parce
 * que « Practice » est une décision commerciale et pas une valeur d'enum —
 * cf. l'en-tête de ce fichier-là.
 *
 * Le périmètre du livrable n'est pas redécrit ici non plus : il est dérivé de
 * `KIT_TIER_RULES` (`lib/kit/tiers.ts`), qui pilote la génération. Une carte
 * de pricing qui promet 6 pages pendant que la génération en livre 3 serait
 * une promesse commerciale non tenue par le code.
 */

/** Devise unique du produit. Le marché est américain, la facturation aussi. */
export const CURRENCY = "usd" as const;

export type KitPlan = {
  tier: KitTier;
  label: string;
  /** Une phrase : à qui s'adresse ce tier. Anglais, ton posé. */
  tagline: string;
  /** Paiement unique, en centimes — l'unité que Stripe manipule. */
  amountCents: number;
  /** Variable d'environnement portant l'id de prix Stripe de ce tier. */
  priceEnvVar: string;
  /** Ce que ce tier ajoute aux précédents. Rendu tel quel sur `/pricing`. */
  highlights: string[];
};

/*
 * Ordre croissant, et c'est un contrat : `highestTier()` s'en sert pour
 * décider quel achat prime quand un praticien monte en gamme.
 */
export const KIT_PLANS: Record<KitTier, KitPlan> = {
  starter: {
    tier: "starter",
    label: SOLD_TIER_NAME.starter,
    tagline:
      "For a first practice website. The three pages a new client actually reads before reaching out.",
    amountCents: 7900,
    priceEnvVar: "STRIPE_PRICE_STARTER",
    highlights: [
      "Three creative directions to choose from",
      "Palette, typefaces and positioning statement",
      "Brand story and voice guide",
      "Website copy for 3 pages",
      "One multi-platform website prompt",
    ],
  },
  practice: {
    tier: "practice",
    label: SOLD_TIER_NAME.practice,
    tagline:
      "For an established practice. Room for your specialties, your fees and the questions people ask first.",
    amountCents: 14900,
    priceEnvVar: "STRIPE_PRICE_PRACTICE",
    highlights: [
      `Everything in ${SOLD_TIER_NAME.starter}`,
      "Website copy for 6 pages",
      "Branded social template specs",
    ],
  },
  signature: {
    tier: "signature",
    label: SOLD_TIER_NAME.signature,
    tagline:
      "For a practice that writes. Every page you asked for in the brief, including the blog.",
    amountCents: 24900,
    priceEnvVar: "STRIPE_PRICE_SIGNATURE",
    highlights: [
      `Everything in ${SOLD_TIER_NAME.practice}`,
      "Website copy for every page you asked for, up to 8",
      "Blog and FAQ copy included",
    ],
  },
};

/** Les plans dans l'ordre d'affichage, du plus petit au plus complet. */
export const ORDERED_PLANS: KitPlan[] = KIT_TIERS.map(
  (tier) => KIT_PLANS[tier]
);

/*
 * Le tier mis en avant sur `/pricing`. Practice, pas Signature : c'est celui
 * qui correspond à la majorité des cabinets, et pousser le plus cher par
 * défaut contredirait le ton du produit.
 */
export const RECOMMENDED_TIER: KitTier = "practice";

/*
 * ── Monthly Presence ──────────────────────────────────────────────────────
 *
 * L'abonnement. Coché par défaut au checkout, résiliable à tout moment.
 *
 * TODO(retention): LE RISQUE CENTRAL DU MODÈLE ÉCONOMIQUE EST ICI.
 * Un abonnement de contenu à ce prix churne typiquement de 10 à 15 % par mois :
 * à ce rythme, une cohorte est à moitié partie avant la fin de l'année, et
 * l'acquisition ne fait que remplir un seau percé. Trois coutures sont
 * identifiées, DOCUMENTÉES ET NON CONSTRUITES dans ce lot — elles demandent un
 * ordonnanceur (cron), donc une décision d'infrastructure qui n'appartient pas
 * au front :
 *
 *   1. CALENDRIER LIVRÉ, pas seulement généré. Le livrable existe (12 posts,
 *      4 stories, un calendrier éditorial) mais il attend que le praticien
 *      revienne le chercher. Un abonnement qu'on doit aller consulter se
 *      résilie ; un abonnement qui arrive se garde. Couture : un envoi mensuel
 *      au moment où le contenu du mois est prêt.
 *   2. RAPPELS DE PUBLICATION. Le calendrier date chaque post ; personne ne le
 *      rappelle le jour dit. Le praticien qui ne publie pas ne voit aucune
 *      valeur au mois suivant et part. Couture : une notification par entrée
 *      de calendrier, avec le texte prêt à copier.
 *   3. PUBLICATION FACILITÉE. Copier-coller douze fois dans Instagram est le
 *      vrai coût du produit pour l'utilisateur. Couture : au minimum un export
 *      programmable, au mieux une connexion aux plateformes.
 *
 * Aucun ordonnanceur n'est écrit ici. Ce bloc existe pour que le prochain lot
 * sache où brancher, et pourquoi c'est prioritaire.
 */
export const MONTHLY_PRESENCE = {
  label: "Monthly Presence",
  /** Abonnement mensuel, en centimes. */
  amountCents: 3900,
  interval: "month" as const,
  priceEnvVar: "STRIPE_PRICE_MONTHLY_PRESENCE",
  tagline:
    "A month of content in your brand's voice, ready to publish. Cancel anytime.",
  highlights: [
    "12 social posts written in your voice",
    "4 story prompts",
    "A dated editorial calendar for the month",
  ],
  /*
   * Microcopy de la case cochée par défaut au checkout. Elle est ici parce
   * qu'elle est une PROMESSE COMMERCIALE, pas une décoration : cocher par
   * défaut sans dire qu'on peut décocher est un dark pattern, et ce produit
   * s'adresse à des cliniciens tenus à leur propre déontologie publicitaire.
   */
  addOnMicrocopy:
    "Off unless you add it. Tick it at checkout if you want it; cancel anytime.",
} as const;

/*
 * ── LES TROIS MOIS INCLUS DANS PRACTICE SUITE ─────────────────────────────
 *
 * Practice Suite (`signature`) comprend trois mois de Monthly Presence. Ce
 * n'est PAS un crédit, pas un booléen, pas une colonne de date posée à côté :
 * l'achat crée un VRAI abonnement Stripe avec une période d'essai de 90 jours,
 * et l'abonnement est la seule source de vérité. `subscriptions.status` vaut
 * `trialing`, `subscriptions.active` (colonne générée) est déjà vraie pour
 * `trialing` depuis la migration 20260827106000, et
 * `isEntitledToMonthlyPresence` répond oui sans apprendre une seconde façon
 * d'être vraie. Même principe que le journal de publication qui EST l'état de
 * publication : un seul exemplaire du fait, donc rien ne peut diverger.
 *
 * ⚠ 90 JOURS, PAS « 3 MOIS ». Stripe compte des JOURS (`trial_period_days`),
 * pas des mois de calendrier. Écrire « trois mois » quelque part dans le code
 * obligerait à choisir entre 89, 90, 91 et 92 jours selon le mois d'achat, et
 * la date annoncée dans l'e-mail de préavis finirait par ne plus être la date
 * de prélèvement. Le produit VEND « trois mois » ; le code COMPTE 90 jours, et
 * c'est la même durée à un jour près pour tout le monde plutôt qu'une durée
 * différente pour chacune.
 */
export const INCLUDED_MONTHLY_PRESENCE_TRIAL_DAYS = 90;

/**
 * Ce tier comprend-il Monthly Presence ?
 *
 * Une FONCTION plutôt qu'une comparaison `tier === "signature"` recopiée : le
 * checkout, le webhook, la page de tarifs et l'écran de paiement posent tous
 * la même question, et le jour où un deuxième tier l'inclut, il y a un seul
 * endroit à changer plutôt que quatre à retrouver.
 */
export function includesMonthlyPresence(tier: KitTier): boolean {
  return tier === "signature";
}

/*
 * La phrase qui dit ce qui est inclus, et ce qui se passe ensuite.
 *
 * ⚠ CONSTRUITE DEPUIS LE CATALOGUE, jamais recopiée à la main. Elle nomme un
 * montant, et un montant écrit en dur sur une page de tarifs est exactement le
 * bug que ce module existe pour rendre impossible — sauf qu'ici il serait pire
 * qu'ailleurs : c'est la phrase qui tient lieu d'information précontractuelle
 * sur une reconduction automatique.
 *
 * TROIS FAITS, ET ILS SONT TOUS LES TROIS OBLIGATOIRES :
 *   1. ce qui est inclus et pour combien de temps ;
 *   2. ce qu'il advient après — le montant ET la périodicité ;
 *   3. qu'on peut arrêter avant le premier prélèvement.
 *
 * Le troisième est celui qu'une page de vente « oublie » d'habitude, et c'est
 * précisément celui qui rend les deux premiers honnêtes.
 */
export const INCLUDED_MONTHLY_PRESENCE_COPY = `Includes three months of ${MONTHLY_PRESENCE.label}. After that it renews at ${formatUsd(MONTHLY_PRESENCE.amountCents)}/${MONTHLY_PRESENCE.interval}. Cancel any time before the first charge and you are not billed for it.`;

/** Quantités du livrable mensuel. Consommées par le prompt de génération. */
export const MONTHLY_PRESENCE_POSTS = 12;
export const MONTHLY_PRESENCE_STORIES = 4;

/** "$79", "$149"… Les prix du catalogue sont ronds : jamais de décimales. */
export function formatUsd(amountCents: number): string {
  const dollars = amountCents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

/** Rang du tier dans l'échelle produit. Croissant, `starter` = 0. */
export function tierRank(tier: KitTier): number {
  return KIT_TIERS.indexOf(tier);
}

/**
 * Le plus généreux de plusieurs tiers.
 *
 * Sert à décider ce à quoi un praticien a droit quand il a payé plusieurs
 * fois : `purchases` est un journal d'ÉVÉNEMENTS (un upgrade ajoute une
 * ligne, il n'en remplace aucune), donc le droit courant est le maximum, pas
 * le dernier achat. Sans ça, un Signature suivi d'un Starter dégraderait
 * silencieusement un client qui vient de payer davantage.
 */
export function highestTier(tiers: KitTier[]): KitTier | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((best, tier) =>
    tierRank(tier) > tierRank(best) ? tier : best
  );
}
