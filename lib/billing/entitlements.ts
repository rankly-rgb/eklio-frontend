import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TIERS, getTier, type Tier } from "@/lib/billing/plans";

/**
 * What a project has actually paid for.
 *
 * Reads only `paid` orders, so an abandoned checkout never unlocks anything.
 * When several tiers were bought over time the highest one wins — an upgrade
 * should never take a deliverable away.
 */

export type Entitlement = {
  tier: Tier | null;
  hasMonthlyPresence: boolean;
};

const TIER_RANK: Record<string, number> = Object.fromEntries(
  TIERS.map((tier, index) => [tier.id, index])
);

export async function getEntitlement(projectId: string): Promise<Entitlement> {
  const supabase = await createClient();

  const [{ data: orders }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("orders")
      .select("tier")
      .eq("project_id", projectId)
      .eq("status", "paid"),
    supabase
      .from("subscriptions")
      .select("status")
      // Stripe keeps a canceled subscription's row around; only these two
      // statuses mean the practitioner is currently entitled to content.
      .in("status", ["active", "trialing"]),
  ]);

  let best: Tier | null = null;
  for (const order of orders ?? []) {
    const tier = getTier(order.tier);
    if (!tier) continue;
    if (!best || TIER_RANK[tier.id] > TIER_RANK[best.id]) {
      best = tier;
    }
  }

  return {
    tier: best,
    hasMonthlyPresence: (subscriptions ?? []).length > 0,
  };
}
