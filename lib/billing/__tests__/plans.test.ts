import { describe, expect, it } from "vitest";

import {
  MONTHLY_PRESENCE,
  TIERS,
  getTier,
  kitScopeForTier,
} from "@/lib/billing/plans";

const REQUESTED_PAGES = [
  "home",
  "about",
  "approach",
  "specialties",
  "fees",
  "faq",
  "contact",
];

describe("pricing", () => {
  it("prices the three tiers in USD at $79 / $149 / $249", () => {
    expect(TIERS.map((t) => t.amountCents)).toEqual([7900, 14900, 24900]);
    expect(TIERS.map((t) => t.priceLabel)).toEqual(["$79", "$149", "$249"]);
  });

  it("prices Monthly Presence at $39 a month", () => {
    expect(MONTHLY_PRESENCE.amountCents).toBe(3900);
    expect(MONTHLY_PRESENCE.priceLabelWithInterval).toBe("$39/mo");
    expect(MONTHLY_PRESENCE.interval).toBe("month");
  });

  it("uses no currency symbol other than the dollar", () => {
    const allCopy = [
      ...TIERS.flatMap((t) => [t.priceLabel, t.name, t.summary, ...t.includes]),
      MONTHLY_PRESENCE.priceLabel,
      MONTHLY_PRESENCE.priceLabelWithInterval,
      MONTHLY_PRESENCE.summary,
      MONTHLY_PRESENCE.addOnMicrocopy,
    ].join(" ");

    expect(allCopy).not.toMatch(/[€£¥]/);
    expect(allCopy).toContain("$");
  });

  it("tells the truth about the default-checked add-on", () => {
    expect(MONTHLY_PRESENCE.addOnMicrocopy).toMatch(/added by default/i);
    expect(MONTHLY_PRESENCE.addOnMicrocopy).toMatch(/cancel anytime/i);
  });

  it("resolves a tier by id and rejects an unknown one", () => {
    expect(getTier("practice")?.name).toBe("Practice");
    expect(getTier("enterprise")).toBeUndefined();
  });
});

describe("kitScopeForTier", () => {
  it("caps Starter at three pages, keeping the brief's own order", () => {
    const scope = kitScopeForTier(getTier("starter")!, REQUESTED_PAGES);
    expect(scope.pages).toEqual(["home", "about", "approach"]);
  });

  it("excludes social templates on Starter", () => {
    expect(
      kitScopeForTier(getTier("starter")!, REQUESTED_PAGES).includeSocialTemplates
    ).toBe(false);
  });

  it("gives Practice every requested page and social templates", () => {
    const scope = kitScopeForTier(getTier("practice")!, REQUESTED_PAGES);
    expect(scope.pages).toEqual(REQUESTED_PAGES);
    expect(scope.includeSocialTemplates).toBe(true);
  });

  it("gives Signature the same deliverable scope as Practice", () => {
    const practice = kitScopeForTier(getTier("practice")!, REQUESTED_PAGES);
    const signature = kitScopeForTier(getTier("signature")!, REQUESTED_PAGES);
    expect(signature).toEqual(practice);
  });

  it("never invents pages the practitioner did not ask for", () => {
    const scope = kitScopeForTier(getTier("starter")!, ["home"]);
    expect(scope.pages).toEqual(["home"]);
  });

  it("marks human review as a Signature-only promise", () => {
    expect(getTier("starter")!.scope.humanReview).toBe(false);
    expect(getTier("practice")!.scope.humanReview).toBe(false);
    expect(getTier("signature")!.scope.humanReview).toBe(true);
  });
});
