import { NextResponse } from "next/server";
import { KIT_PLANS } from "@/lib/billing/plans";
import { soldTierName } from "@/lib/billing/tier-names";
import { surfaceAccess, type Surface } from "@/lib/billing/surface-access";
import type { KitTier } from "@/lib/kit/tiers";

/*
 * The API side of the tier guard — the same decision as `<TierGate>`, in the
 * shape a route answers with.
 *
 * ⚠ THE ROUTE MUST CHECK TOO, not just the screen. A control she cannot see
 * is not a control she cannot call: the URL is right there, and every one of
 * these endpoints is a plain POST or GET against her own kit. Gating only the
 * UI would make the distribution a suggestion.
 *
 * ⚠ AND IT ANSWERS 402, NOT 403. There IS something for sale that lifts it,
 * which is the whole difference between "you may not" and "not on this plan"
 * — so the body carries the checkout for the tier that includes it, the same
 * shape `lockedMessage` uses for an unpaid kit.
 */
export function surfaceRefusal(
  surface: Surface,
  tier: KitTier | null,
  projectId: string
): NextResponse | null {
  const access = surfaceAccess(surface, tier);
  if (access.ok) return null;

  // An unknown surface name is a caller's bug, and it answers 404 for the
  // same reason `requireKitPage` does: never confirm that a thing exists.
  if (access.reason === "not_found") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const requiredName = soldTierName(access.requiredTier);
  const price = `$${Math.round(KIT_PLANS[access.requiredTier].amountCents / 100)}`;

  return NextResponse.json(
    {
      error: `${access.label} comes with ${requiredName}.`,
      requiredTier: access.requiredTier,
      // The name she has seen, never the enum — see `lib/billing/tier-names.ts`.
      requiredTierName: requiredName,
      upgradePrice: price,
      checkoutUrl: `/app/checkout?plan=${access.requiredTier}&project=${projectId}`,
    },
    { status: 402 }
  );
}
