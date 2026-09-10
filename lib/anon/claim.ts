import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { hashAnonToken } from "@/lib/anon/token";

/*
 * ── SIGNING UP CLAIMS THE BRIEF, IT DOES NOT START ONE ──────────────────
 *
 * She has answered seven steps and is looking at three directions. The account
 * exists so she can keep THAT — so the first thing it must do is take
 * ownership of what is already on her screen.
 *
 * ⚠ THIS RUNS WITH THE SERVICE ROLE, and it has to. The policies deliberately
 * refuse a browser that tries to write `user_id` on a token-owned row: a token
 * holder who could do that could attach a stranger's brief to their own
 * account. Claiming is therefore a server act, and this is the only function
 * that performs it.
 */

export type ClaimOutcome =
  | { claimed: true; projectId: string }
  | { claimed: false; reason: "no_token" | "not_found" | "expired" | "failed" };

/**
 * Attach an anonymous brief to a user.
 *
 * ⚠ IT DOES NOT REQUIRE A SESSION. `supabase.auth.signUp` returns the new
 * user's id even when email confirmation is on and no session is issued — so
 * the brief is attached at the moment she signs up, and is waiting for her
 * whether she is let straight in or has to confirm first. That is what keeps
 * confirmation out of the critical path rather than merely shortening it.
 */
export async function claimAnonBrief(
  admin: SupabaseClient<Database>,
  input: { token: string | null; userId: string }
): Promise<ClaimOutcome> {
  if (!input.token) return { claimed: false, reason: "no_token" };

  const { data, error } = await admin
    .from("projects")
    .update({
      user_id: input.userId,
      /*
       * Both cleared together. A claimed row keeps no token — the cookie that
       * pointed at it is now worthless to anyone who copies it — and no
       * expiry, because the purge must never come for something she owns.
       *
       * `projects_anon_expiry_check` allows this pairing and forbids the other
       * one, so a half-claim cannot be written even by mistake.
       */
      anon_token_hash: null,
      anon_expires_at: null,
    })
    .eq("anon_token_hash", hashAnonToken(input.token))
    /*
     * ⚠ ONLY AN UNCLAIMED ROW, AND ONLY AN UNEXPIRED ONE. Without the first,
     * replaying an old cookie would move someone else's project between
     * accounts. Without the second, a cookie kept past the deadline would
     * resurrect a brief the purge is entitled to have deleted.
     */
    .is("user_id", null)
    .gt("anon_expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[claim] ${error.message}`);
    return { claimed: false, reason: "failed" };
  }
  if (!data) {
    /*
     * The row is gone, already claimed, or past its deadline. Told apart only
     * for the log — she gets the same screen either way, and it is never an
     * error she has to act on: her account exists, it is simply empty.
     */
    return { claimed: false, reason: "not_found" };
  }

  return { claimed: true, projectId: data.id };
}
