import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * What bounds the Check rewrite — and it is not money.
 *
 * ⚠ THE ONE PLACE. The rewrite used to spend `consume_generation_credit`, the
 * DIRECTIONS meter: three to twelve regenerations of a whole brand, sold at 79
 * to 249 USD. A rewrite is a single text call costing a fraction of a cent.
 * Charging a brand regeneration for it meant she could exhaust the expensive
 * thing by using the cheap one — which is the wrong failure in every possible
 * way.
 *
 * The replacement is a per-user daily count, and the NUMBER lives in the
 * database (`app_settings.check_rewrites_per_user_per_day`, seeded at 20), not
 * here: twenty is far past any honest editing session on one piece of copy and
 * far short of a script, and it moves without a deploy when that turns out to
 * be wrong.
 *
 * ⚠ NOT `lib/api/rate-limit.ts`. That one is per-process by its own admission
 * — two serverless instances count separately and a redeploy clears it. It is
 * a slower, not a limit, and a DAILY ceiling a deploy resets is not a ceiling.
 * This one is a row.
 */

type Client = SupabaseClient<Database>;

export type CheckRewriteAllowance =
  | { ok: true; limit: number; used: number; remaining: number }
  | { ok: false; reason: "daily_limit" | "unauthenticated" | "rpc_error"; limit: number; retryAfterSeconds: number };

/** Seconds until the daily count rolls over, from an RPC's `resets_at`. */
function secondsUntil(resetsAt: unknown, now: number): number {
  const at = typeof resetsAt === "string" ? Date.parse(resetsAt) : Number.NaN;
  if (Number.isNaN(at)) return 3600;
  return Math.max(60, Math.ceil((at - now) / 1000));
}

/**
 * Counts one rewrite against the caller's day, atomically, and says whether it
 * was allowed.
 *
 * Check AND consume in one statement, database-side: two simultaneous rewrites
 * cannot both read an under-limit count and both increment it. That is
 * verify-then-consume collapsed into one step rather than abandoned — this
 * product still has no post-purchase refund primitive anywhere, so nothing may
 * consume before it has checked.
 */
export async function consumeCheckRewrite(supabase: Client): Promise<CheckRewriteAllowance> {
  const { data, error } = await supabase.rpc("consume_check_rewrite");
  if (error) {
    console.error("[check] consume_check_rewrite", error);
    return { ok: false, reason: "rpc_error", limit: 0, retryAfterSeconds: 60 };
  }

  const row = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    limit?: number;
    used?: number;
    remaining?: number;
    resets_at?: string;
  };

  if (row.ok === true) {
    return {
      ok: true,
      limit: row.limit ?? 0,
      used: row.used ?? 0,
      remaining: row.remaining ?? 0,
    };
  }

  return {
    ok: false,
    reason: row.reason === "unauthenticated" ? "unauthenticated" : "daily_limit",
    limit: row.limit ?? 0,
    retryAfterSeconds: secondsUntil(row.resets_at, Date.now()),
  };
}
