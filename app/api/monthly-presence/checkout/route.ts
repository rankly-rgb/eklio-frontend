import { authenticate, json, serverError } from "@/lib/api/handler";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
} from "@/lib/billing/entitlements";
import { createMonthlyPresenceCheckout } from "@/lib/stripe/checkout";
import { track } from "@/lib/analytics";

/*
 * POST /api/monthly-presence/checkout — opens the Monthly Presence checkout
 * for a subscription-card CTA that isn't attached to a locked content tile.
 *
 * `POST /api/content/[id]/unlock` already does exactly this, but only from a
 * tile that exists — a kit with zero content rows this month (the honest
 * empty state, Lot 8) has nothing to hang that route's `[id]` off. The
 * underlying checkout (`createMonthlyPresenceCheckout`) never needed the
 * item in the first place; this route is that same call without the item
 * lookup its sibling only used for ownership-checking a tile.
 */
export async function POST() {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId, email } = auth.session;

  const subscription = await getSubscription(supabase, userId);
  if (isEntitledToMonthlyPresence(subscription)) {
    return json({ entitled: true, checkoutUrl: null });
  }

  if (!email) return serverError("POST /api/monthly-presence/checkout", "no email on session");

  try {
    const checkoutUrl = await createMonthlyPresenceCheckout(supabase, { userId, email });
    track("unlock_opened", {});
    return json({ entitled: false, checkoutUrl });
  } catch (error) {
    return serverError("POST /api/monthly-presence/checkout", error);
  }
}
