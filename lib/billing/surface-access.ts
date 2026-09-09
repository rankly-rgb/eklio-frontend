import { KIT_TIERS, type KitTier } from "@/lib/kit/tiers";
import {
  SURFACE_LABEL,
  SURFACE_MIN_TIER,
  isSurface,
  type Surface,
} from "@/lib/billing/surfaces";

/*
 * ── THE ONE GUARD ───────────────────────────────────────────────────────
 *
 * A surface and a tier in, yes or no out. Every surface consults this and
 * nothing re-derives it: nineteen surfaces each deciding for themselves is
 * nineteen chances to invert the comparison, and an inverted comparison on a
 * paywall fails open.
 *
 * ⚠ 404 BEFORE `payment_required`, the same order as `requireKitPage`. An
 * unknown surface name is `not_found`, not "above your tier" — answering the
 * second would tell a caller that a surface exists when it does not, which is
 * the same leak as answering 402 for someone else's kit.
 *
 * ⚠ AN UNREADABLE TIER FAILS CLOSED. `null` — no purchase found, or a tier
 * string the frontend does not know — is not "the lowest tier", it is "we
 * could not tell". The worst outcome of refusing wrongly is a customer who
 * paid seeing an upgrade card, which is visible, reported and fixed in
 * minutes. The worst outcome of allowing wrongly is silent, permanent and
 * free.
 */

export type SurfaceAccess =
  | { ok: true; surface: Surface }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "payment_required";
      surface: Surface;
      /** What she has, or null when it could not be read. */
      currentTier: KitTier | null;
      /** The lowest tier that includes this surface. */
      requiredTier: KitTier;
      /** Her own words for it, for the upgrade card. */
      label: string;
    };

/** Position on the ladder. `KIT_TIERS` is ordered, and that order is a contract. */
function rank(tier: KitTier): number {
  return KIT_TIERS.indexOf(tier);
}

/**
 * May a customer on `tier` see `surface`?
 *
 * `surface` is typed as `string` on purpose: callers include route params and
 * catalogue rows, and the point of the `not_found` branch is to handle a name
 * that is not a surface rather than to make it a type error at the call site
 * and a crash at runtime.
 */
export function surfaceAccess(surface: string, tier: KitTier | null): SurfaceAccess {
  if (!isSurface(surface)) return { ok: false, reason: "not_found" };

  const requiredTier = SURFACE_MIN_TIER[surface];
  if (tier !== null && rank(tier) >= rank(requiredTier)) {
    return { ok: true, surface };
  }

  return {
    ok: false,
    reason: "payment_required",
    surface,
    currentTier: tier,
    requiredTier,
    label: SURFACE_LABEL[surface],
  };
}
