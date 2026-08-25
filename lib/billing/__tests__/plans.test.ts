import { describe, expect, it } from "vitest";
import {
  formatUsd,
  highestTier,
  KIT_PLANS,
  MONTHLY_PRESENCE,
  ORDERED_PLANS,
  tierRank,
} from "@/lib/billing/plans";
import {
  FALLBACK_KIT_TIER,
  KIT_TIERS,
  KIT_TIER_RULES,
  parseKitTier,
  resolveKitScope,
} from "@/lib/kit/tiers";

/*
 * Le catalogue et le gating partagent une seule source. Ces tests figent ce
 * qui, s'il dérivait, se paierait en argent ou en promesse non tenue :
 * un prix affiché différent du prix facturé, ou une carte qui promet plus de
 * pages que la génération n'en livre.
 */

describe("catalogue", () => {
  it("porte les trois tiers en dollars, dans l'ordre croissant", () => {
    expect(ORDERED_PLANS.map((plan) => plan.tier)).toEqual([
      "starter",
      "practice",
      "signature",
    ]);
    expect(ORDERED_PLANS.map((plan) => plan.amountCents)).toEqual([
      7900, 14900, 24900,
    ]);
    expect(ORDERED_PLANS.map((plan) => formatUsd(plan.amountCents))).toEqual([
      "$79",
      "$149",
      "$249",
    ]);
  });

  it("porte l'abonnement Monthly Presence à $39/mois", () => {
    expect(MONTHLY_PRESENCE.amountCents).toBe(3900);
    expect(formatUsd(MONTHLY_PRESENCE.amountCents)).toBe("$39");
    expect(MONTHLY_PRESENCE.interval).toBe("month");
  });

  it("dit que l'add-on est coché par défaut ET résiliable", () => {
    // Cocher par défaut sans le dire est un dark pattern ; la microcopy est
    // donc une contrainte produit, pas une décoration.
    const microcopy = MONTHLY_PRESENCE.defaultOnMicrocopy.toLowerCase();
    expect(microcopy).toContain("added by default");
    expect(microcopy).toContain("cancel anytime");
  });

  it("nomme une variable d'environnement par prix, jamais un id en dur", () => {
    const envVars = [
      ...ORDERED_PLANS.map((plan) => plan.priceEnvVar),
      MONTHLY_PRESENCE.priceEnvVar,
    ];

    expect(new Set(envVars).size).toBe(envVars.length);
    for (const envVar of envVars) {
      expect(envVar).toMatch(/^STRIPE_PRICE_[A-Z_]+$/);
      // Un `price_…` figé dans le repo casserait au passage test → live.
      expect(envVar).not.toMatch(/^price_/);
    }
  });

  it("couvre exactement les tiers du gating, sans en inventer un", () => {
    expect(Object.keys(KIT_PLANS).sort()).toEqual([...KIT_TIERS].sort());
    for (const tier of KIT_TIERS) {
      expect(KIT_PLANS[tier].label).toBe(KIT_TIER_RULES[tier].label);
    }
  });
});

describe("highestTier — le droit courant est le plus généreux des achats", () => {
  it("rend le plus haut, quel que soit l'ordre des achats", () => {
    // `purchases` est un journal d'ÉVÉNEMENTS : un upgrade AJOUTE une ligne.
    // Prendre le dernier achat dégraderait un client qui vient de payer plus.
    expect(highestTier(["starter", "signature"])).toBe("signature");
    expect(highestTier(["signature", "starter"])).toBe("signature");
    expect(highestTier(["practice", "starter", "practice"])).toBe("practice");
  });

  it("rend null sans aucun achat", () => {
    expect(highestTier([])).toBeNull();
  });

  it("classe les tiers dans l'ordre du produit", () => {
    expect(tierRank("starter")).toBeLessThan(tierRank("practice"));
    expect(tierRank("practice")).toBeLessThan(tierRank("signature"));
  });
});

describe("gating — le périmètre suit le tier lu sur brand_kits.tier", () => {
  const ALL_PAGES = [
    "home",
    "about",
    "approach",
    "specialties",
    "fees",
    "faq",
    "contact",
    "blog",
  ];

  /* Ce que la page de kit fait de la colonne : relire, puis résoudre. */
  function scopeFromColumn(stored: string) {
    return resolveKitScope(parseKitTier(stored) ?? FALLBACK_KIT_TIER, ALL_PAGES);
  }

  it("livre un périmètre différent selon la valeur stockée en colonne", () => {
    expect(scopeFromColumn("starter").pages).toHaveLength(3);
    expect(scopeFromColumn("practice").pages).toHaveLength(6);
    expect(scopeFromColumn("signature").pages).toHaveLength(8);
  });

  it("réserve les specs sociales à Practice et au-dessus", () => {
    expect(scopeFromColumn("starter").includeSocialTemplates).toBe(false);
    expect(scopeFromColumn("practice").includeSocialTemplates).toBe(true);
    expect(scopeFromColumn("signature").includeSocialTemplates).toBe(true);
  });

  it("retombe sur le PLUS PETIT tier devant une valeur inconnue", () => {
    // Le sens du repli a changé au Lot 4 : depuis que le paiement existe, une
    // valeur inattendue ne doit jamais ouvrir le livrable le plus complet.
    expect(FALLBACK_KIT_TIER).toBe("starter");
    for (const unknown of ["", "premium", "SIGNATURE", "enterprise"]) {
      expect(parseKitTier(unknown)).toBeNull();
      expect(scopeFromColumn(unknown).pages).toHaveLength(3);
    }
  });

  it("relit les trois valeurs autorisées par le CHECK en base", () => {
    for (const tier of KIT_TIERS) {
      expect(parseKitTier(tier)).toBe(tier);
    }
    expect(parseKitTier(null)).toBeNull();
    expect(parseKitTier(undefined)).toBeNull();
  });
});
