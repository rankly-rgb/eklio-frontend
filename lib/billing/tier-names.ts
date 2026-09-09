import type { KitTier } from "@/lib/kit/tiers";

/*
 * ── WHAT EACH TIER IS CALLED WHEN A CUSTOMER READS IT ───────────────────
 *
 * ⚠ ONE PLACE, AND THIS IS IT. `starter`, `practice` and `signature` are
 * enum values: they live in `purchases.tier`, in `plans.tier`, in a CHECK
 * constraint and in Stripe metadata, and they are not what anybody bought.
 * She bought a thing with a name on a pricing page — "Brand Kit",
 * "Brand Kit Plus", "Practice Suite" — and has never seen the other three
 * words in her life.
 *
 * This file existed for a day holding the enum values capitalised, which was
 * wrong and looked right. That is the failure it is for: a name that is
 * plausible is not a name that is correct, and nothing else in the codebase
 * would have caught it. Renaming a sold offer is one line here.
 *
 * The enum is NOT renamed with it. `purchases.tier` is history — what was
 * charged, under what name at the time — and rewriting it to match a
 * marketing change would falsify a record of money.
 *
 * ⚠ THE NAMES ARE NOUNS, AND THE COPY AROUND THEM HAS TO KNOW IT. "The site
 * editor is part of Practice" reads as a category; "…is part of Brand Kit
 * Plus" reads as a spec line in a table. The product says "comes with"
 * instead — see `components/billing/tier-upgrade-prompt.tsx` and
 * `lib/api/surface-guard.ts`, which are the only two places that build a
 * sentence out of one of these.
 */

export const SOLD_TIER_NAME: Record<KitTier, string> = {
  starter: "Brand Kit",
  practice: "Brand Kit Plus",
  signature: "Practice Suite",
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
