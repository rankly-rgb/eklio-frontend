import type { KitTier } from "@/lib/kit/tiers";

/*
 * ── WHAT EACH TIER IS CALLED WHEN A CUSTOMER READS IT ───────────────────
 *
 * ⚠ ONE PLACE, AND THIS IS IT. `starter`, `practice` and `signature` are
 * enum values: they live in `purchases.tier`, in `plans.tier`, in a CHECK
 * constraint and in Stripe metadata, and they are not what anybody bought.
 * She bought a thing with a name on a pricing page.
 *
 * Today the two happen to coincide — the sold names ARE "Starter",
 * "Practice" and "Signature". That coincidence is exactly why this file has
 * to exist before it is needed: the day the middle one is renamed to
 * something like "Brand Kit Plus" on the site, every screen that quietly
 * capitalised the enum would start telling a customer she is on "Practice",
 * a word she has never seen. Renaming a sold offer must be one line here,
 * never a migration and never a search-and-replace.
 *
 * The enum is not renamed with it. `purchases.tier` is history — what was
 * charged, under what name at the time — and rewriting it to match a new
 * marketing name would falsify records of money.
 */

export const SOLD_TIER_NAME: Record<KitTier, string> = {
  starter: "Starter",
  practice: "Practice",
  signature: "Signature",
};

/**
 * The name to put in front of a customer for a tier.
 *
 * Takes `null` because that is what `resolveEntitledTier` answers when a
 * purchase cannot be read, and a card that has to say "you're on —" is
 * better than one that crashes or that guesses the cheapest tier.
 */
export function soldTierName(tier: KitTier | null): string | null {
  return tier === null ? null : SOLD_TIER_NAME[tier];
}
