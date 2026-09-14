import type { KitTier } from "@/lib/kit/tiers";

/*
 * ── LE CATALOGUE DE L'OFFRE DU 13 SEPTEMBRE ─────────────────────────────
 *
 * Six choses à vendre, et elles ne sont pas de la même nature. C'est le
 * MIROIR APPLICATIF de la table `plans` : une ligne ici par ligne là-bas,
 * les mêmes colonnes, les mêmes valeurs.
 *
 * ⚠ POURQUOI UN MODULE À PART, ET PAS `KIT_PLANS`. `KIT_PLANS` est typé
 * `Record<KitTier, KitPlan>`, et `KitTier` est le miroir exact de
 * `brand_kits.tier` : ce qui PRODUIT un kit. L'add-on identité, un siège de
 * clinicienne et les deux abonnements The Fill ne produisent pas de kit et
 * n'ont donc pas de `KitTier` — leur donner un palier en ferait des choses
 * qu'on peut comparer à Practice Suite, et `highestTier` les rangerait sur
 * l'échelle. Un add-on à 89 $ ne monte personne d'un palier.
 *
 * Les trois listes disent donc trois choses différentes, et chacune a son
 * miroir en base :
 *
 *   KIT_TIERS        ce qui produit un kit         `brand_kits.tier`
 *   PURCHASABLE_SKUS ce qui s'encaisse une fois    `purchases.tier`
 *   OFFER_SKUS       tout ce qui est au catalogue  `plans.tier`
 *
 * ⚠ CE MODULE NE FACTURE RIEN. Il décrit ce qui est vendu. La quantité
 * réellement facturée pour un abonnement au siège, la proration, le
 * changement de palier : rien de tout cela n'est ici, et `perSeat` est une
 * propriété du catalogue — « ce prix se multiplie » — pas un calcul.
 *
 * ⚠ ET IL NE CONTIENT AUCUN IDENTIFIANT DE PRIX STRIPE. Ils diffèrent entre
 * le mode test et le mode live, donc ils viennent de l'environnement. Ce
 * module nomme seulement la variable à lire ; `ENV_REQUIRED.md`, à la racine
 * du backend, les liste avec le SKU que chacune porte.
 */

/** Ce qu'une ligne du catalogue EST. Miroir de `plans.kind`. */
export const OFFER_KINDS = ["kit", "addon", "seat", "subscription"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

/** Miroir de `plans.billing_period`. */
export type BillingPeriod = "once" | "month";

export type OfferSku = {
  /** La valeur en base : `plans.tier`, et pour un achat `purchases.tier`. */
  sku: string;
  /** Le nom qu'une cliente lit. */
  label: string;
  kind: OfferKind;
  /** En centimes, comme Stripe les manipule. Miroir de `plans.price_cents`. */
  amountCents: number;
  billingPeriod: BillingPeriod;
  /** `true` quand `amountCents` se multiplie par le nombre de cliniciennes. */
  perSeat: boolean;
  /** Sièges compris dans le prix. `null` partout sauf The Roster. */
  includedSeats: number | null;
  /** La variable d'environnement portant l'identifiant de prix Stripe. */
  priceEnvVar: string;
  /**
   * Le palier de kit que cet achat livre, ou `null` quand il n'en livre pas.
   *
   * ⚠ C'est le seul pont entre ce module et `KitTier`, et il va dans un seul
   * sens : un SKU peut nommer un palier, un palier ne nomme pas de SKU.
   */
  kitTier: KitTier | null;
};

/*
 * ⚠ LES NOMBRES SONT LA DÉCISION, et ils sont écrits deux fois : ici et dans
 * `plans`, en base. La duplication existait déjà entre `plans.price_cents` et
 * `KIT_PLANS[t].amountCents` ; ce module ne l'invente pas. Ce qu'il ajoute est
 * le refus qu'elle dérive en silence : `offer-catalogue.test.ts` épingle les
 * deux listes l'une contre l'autre, et la moitié base est épinglée par
 * l'auto-contrôle de `20260914100000_the_new_offer_skus.sql`.
 */
export const OFFER_SKUS: readonly OfferSku[] = [
  {
    sku: "foundation",
    label: "The Foundation",
    kind: "kit",
    amountCents: 39000,
    billingPeriod: "once",
    perSeat: false,
    includedSeats: null,
    priceEnvVar: "STRIPE_PRICE_FOUNDATION",
    kitTier: "foundation",
  },
  {
    sku: "roster",
    label: "The Roster",
    kind: "kit",
    amountCents: 69000,
    billingPeriod: "once",
    perSeat: false,
    includedSeats: 5,
    priceEnvVar: "STRIPE_PRICE_ROSTER",
    kitTier: "roster",
  },
  {
    /*
     * L'actuel livrable de tête, devenu accessoire. Ce qui change est son
     * prix et sa place dans l'offre, pas ce qu'il produit.
     */
    sku: "identity_addon",
    label: "Visual identity",
    kind: "addon",
    amountCents: 8900,
    billingPeriod: "once",
    perSeat: false,
    includedSeats: null,
    priceEnvVar: "STRIPE_PRICE_IDENTITY_ADDON",
    kitTier: null,
  },
  {
    sku: "roster_seat",
    label: "Additional clinician",
    kind: "seat",
    amountCents: 12000,
    billingPeriod: "once",
    perSeat: true,
    includedSeats: null,
    priceEnvVar: "STRIPE_PRICE_ROSTER_SEAT",
    kitTier: null,
  },
  {
    sku: "fill_solo",
    label: "The Fill",
    kind: "subscription",
    amountCents: 5900,
    billingPeriod: "month",
    perSeat: false,
    includedSeats: null,
    priceEnvVar: "STRIPE_PRICE_FILL_SOLO",
    kitTier: null,
  },
  {
    sku: "fill_practice",
    label: "The Fill (practice)",
    kind: "subscription",
    amountCents: 6900,
    billingPeriod: "month",
    perSeat: true,
    includedSeats: null,
    priceEnvVar: "STRIPE_PRICE_FILL_PRACTICE",
    kitTier: null,
  },
];

/**
 * Ce qui s'encaisse une fois. Miroir de `purchases.tier` pour la part
 * nouvelle de l'offre.
 *
 * Un abonnement n'est pas un achat : il vit dans `subscriptions`, qui n'a pas
 * de colonne `tier` aujourd'hui. L'inscrire ici laisserait croire le
 * contraire.
 */
export const PURCHASABLE_SKUS: readonly OfferSku[] = OFFER_SKUS.filter(
  (entry) => entry.billingPeriod === "once"
);

export function offerSku(sku: string): OfferSku | null {
  return OFFER_SKUS.find((entry) => entry.sku === sku) ?? null;
}

/**
 * Le prix affiché. `$390`, `$59/month`, `$69 per clinician/month`.
 *
 * ⚠ LA PÉRIODE ET LE SIÈGE SE DISENT, ILS NE SE DEVINENT PAS. « $69 » tout
 * seul, pour un cabinet de six cliniciennes, est faux de 345 $ par mois — et
 * c'est le genre d'écart qui se découvre sur la première facture.
 */
export function offerPrice(entry: OfferSku): string {
  const dollars = entry.amountCents / 100;
  const amount = Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;

  if (entry.billingPeriod === "once") {
    return entry.perSeat ? `${amount} per clinician` : amount;
  }
  return entry.perSeat ? `${amount} per clinician/month` : `${amount}/month`;
}
