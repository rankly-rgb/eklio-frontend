import { describe, expect, it } from "vitest";
import {
  OFFER_SKUS,
  PURCHASABLE_SKUS,
  offerPrice,
  offerSku,
  type OfferSku,
} from "@/lib/billing/offer";
import { KIT_PLANS } from "@/lib/billing/plans";
import { KIT_TIERS, LEGACY_KIT_TIERS, type KitTier } from "@/lib/kit/tiers";
import { SOLD_TIER_NAME } from "@/lib/billing/tier-names";

/*
 * ── L'OFFRE DU 13 SEPTEMBRE, ÉPINGLÉE ───────────────────────────────────
 *
 * Ce fichier tient trois promesses, et la troisième est celle qui compte le
 * jour du déploiement :
 *
 *   1. les six SKU sont ceux de l'offre, aux prix de l'offre ;
 *   2. les listes TypeScript disent la même chose que les trois CHECK en base ;
 *   3. TOUT CE QUI EST VENDABLE A UNE VARIABLE D'ENVIRONNEMENT DÉCLARÉE.
 *
 * ⚠ La troisième existe parce qu'un SKU sans identifiant de prix Stripe ne
 * lève pas à l'écriture : il lève au CHECKOUT, sur une cliente qui vient de
 * cliquer « payer », et seulement en production, puisque les identifiants
 * diffèrent entre le mode test et le mode live.
 */

/** L'offre, telle qu'elle a été arrêtée. Écrite à la main : c'est l'épingle. */
const THE_OFFER = [
  { sku: "foundation", cents: 39000, period: "once", perSeat: false },
  { sku: "roster", cents: 69000, period: "once", perSeat: false },
  { sku: "identity_addon", cents: 8900, period: "once", perSeat: false },
  { sku: "roster_seat", cents: 12000, period: "once", perSeat: true },
  { sku: "fill_solo", cents: 5900, period: "month", perSeat: false },
  { sku: "fill_practice", cents: 6900, period: "month", perSeat: true },
] as const;

/*
 * Les trois CHECK, recopiés depuis `20260914100000_the_new_offer_skus.sql`.
 * L'auto-contrôle de cette migration épingle la moitié base ; ceci épingle la
 * moitié application, et les deux nomment les mêmes littéraux.
 */
const BRAND_KITS_TIER_CHECK = [
  "starter",
  "practice",
  "signature",
  "foundation",
  "roster",
];
const PURCHASES_TIER_CHECK = [
  "starter",
  "practice",
  "signature",
  "foundation",
  "roster",
  "identity_addon",
  "roster_seat",
];

describe("les six SKU sont ceux de l'offre", () => {
  it("ni un de plus, ni un de moins", () => {
    expect(OFFER_SKUS.map((entry) => entry.sku)).toEqual(
      THE_OFFER.map((entry) => entry.sku)
    );
  });

  it.each(THE_OFFER)("$sku coûte le prix décidé", (expected) => {
    const entry = offerSku(expected.sku) as OfferSku;
    expect(entry).not.toBeNull();
    expect(entry.amountCents).toBe(expected.cents);
    expect(entry.billingPeriod).toBe(expected.period);
    expect(entry.perSeat).toBe(expected.perSeat);
  });

  it("The Roster comprend cinq cliniciennes, et lui seul en comprend", () => {
    expect(offerSku("roster")?.includedSeats).toBe(5);
    expect(
      OFFER_SKUS.filter((entry) => entry.includedSeats !== null).map((e) => e.sku)
    ).toEqual(["roster"]);
  });

  it("un montant est toujours un entier de centimes positif", () => {
    // Un prix en dollars glissé dans une colonne en centimes est une erreur
    // silencieuse de facteur 100, dans le sens qui fait perdre de l'argent.
    for (const entry of OFFER_SKUS) {
      expect(Number.isInteger(entry.amountCents)).toBe(true);
      expect(entry.amountCents).toBeGreaterThan(0);
    }
  });
});

describe("chaque palier vendable a une variable d'environnement", () => {
  it("les six en déclarent une", () => {
    for (const entry of OFFER_SKUS) {
      expect(entry.priceEnvVar, `${entry.sku} n'a pas de variable`).toMatch(
        /^STRIPE_PRICE_[A-Z0-9_]+$/
      );
    }
  });

  it("deux SKU ne partagent jamais la même variable", () => {
    /*
     * ⚠ Deux SKU sur un même identifiant de prix, c'est le mauvais montant
     * encaissé sans qu'aucune erreur ne se produise : Stripe facture ce que
     * l'identifiant dit, pas ce que la page affichait.
     */
    const vars = OFFER_SKUS.map((entry) => entry.priceEnvVar);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("les paliers de kit de l'offre précédente en déclarent une aussi", () => {
    // Ils sont encore vendus tant que le lot de retrait n'a pas eu lieu.
    for (const tier of LEGACY_KIT_TIERS) {
      expect(KIT_PLANS[tier].priceEnvVar).toMatch(/^STRIPE_PRICE_[A-Z0-9_]+$/);
    }
  });

  it("aucune variable n'est partagée entre l'offre précédente et la nouvelle", () => {
    const legacy = LEGACY_KIT_TIERS.map((tier) => KIT_PLANS[tier].priceEnvVar);
    const current = OFFER_SKUS.map((entry) => entry.priceEnvVar);
    expect(legacy.filter((name) => current.includes(name))).toEqual([]);
  });
});

describe("les listes disent ce que les CHECK disent", () => {
  it("KIT_TIERS est brand_kits.tier", () => {
    expect([...KIT_TIERS]).toEqual(BRAND_KITS_TIER_CHECK);
  });

  it("tout SKU qui livre un kit nomme un KitTier réel", () => {
    for (const entry of OFFER_SKUS) {
      if (entry.kitTier === null) continue;
      expect(KIT_TIERS as readonly string[]).toContain(entry.kitTier);
    }
  });

  it("ce qui ne produit pas de kit ne nomme aucun palier", () => {
    /*
     * ⚠ LE POINT DE TOUT CE MODULE. Un add-on à 89 $ ne monte personne d'un
     * palier : lui donner un `kitTier` le ferait entrer dans `highestTier`,
     * et un achat accessoire déciderait alors ce qu'une cliente peut ouvrir.
     */
    for (const entry of OFFER_SKUS) {
      if (entry.kind === "kit") continue;
      expect(entry.kitTier, `${entry.sku} nomme un palier`).toBeNull();
    }
  });

  it("ce qui s'encaisse une fois est exactement ce que purchases.tier accepte", () => {
    const once = PURCHASABLE_SKUS.map((entry) => entry.sku);
    const legacy = [...LEGACY_KIT_TIERS];
    expect([...legacy, ...once].sort()).toEqual([...PURCHASES_TIER_CHECK].sort());
  });

  it("un abonnement n'est jamais encaissable comme un achat", () => {
    // `subscriptions` n'a pas de colonne `tier` : un loyer mensuel écrit dans
    // `purchases` serait facturé une fois et jamais renouvelé.
    for (const entry of PURCHASABLE_SKUS) {
      expect(entry.kind).not.toBe("subscription");
      expect(PURCHASES_TIER_CHECK).toContain(entry.sku);
    }
    for (const entry of OFFER_SKUS.filter((e) => e.kind === "subscription")) {
      expect(PURCHASES_TIER_CHECK).not.toContain(entry.sku);
    }
  });
});

describe("les deux catalogues de kit s'accordent", () => {
  it.each(["foundation", "roster"] as const)(
    "%s a le même prix dans OFFER_SKUS et dans KIT_PLANS",
    (tier: KitTier) => {
      expect(KIT_PLANS[tier].amountCents).toBe(offerSku(tier)?.amountCents);
      expect(KIT_PLANS[tier].priceEnvVar).toBe(offerSku(tier)?.priceEnvVar);
      expect(KIT_PLANS[tier].label).toBe(SOLD_TIER_NAME[tier]);
    }
  );

  it("l'offre précédente reste vendue et gardée intacte", () => {
    // Des gens l'ont achetée ; `purchases` est un registre d'argent encaissé.
    expect([...LEGACY_KIT_TIERS]).toEqual(["starter", "practice", "signature"]);
    expect(KIT_PLANS.starter.amountCents).toBe(7900);
    expect(KIT_PLANS.practice.amountCents).toBe(14900);
    expect(KIT_PLANS.signature.amountCents).toBe(24900);
  });
});

describe("le prix affiché dit la période et le siège", () => {
  it("un achat unique s'affiche nu", () => {
    expect(offerPrice(offerSku("foundation") as OfferSku)).toBe("$390");
  });

  it("un abonnement dit /month", () => {
    expect(offerPrice(offerSku("fill_solo") as OfferSku)).toBe("$59/month");
  });

  it("un abonnement au siège le dit aussi", () => {
    /*
     * ⚠ « $69 » tout seul, pour un cabinet de six cliniciennes, est faux de
     * 345 $ par mois. La période et le siège se disent, ils ne se devinent
     * pas.
     */
    expect(offerPrice(offerSku("fill_practice") as OfferSku)).toBe(
      "$69 per clinician/month"
    );
  });

  it("un achat unique au siège le dit", () => {
    expect(offerPrice(offerSku("roster_seat") as OfferSku)).toBe(
      "$120 per clinician"
    );
  });
});
