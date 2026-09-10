import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { resolveBriefCaller } from "@/lib/anon/session";

/*
 * ── THE FOUR BRIEF SCREENS, FOR A USER OR A TOKEN ───────────────────────
 *
 * The brief, its review, its positioning screen and the reveal all began with
 * the same three lines: get the user, and bounce to `/login` if there isn't
 * one. That was the wall, and one shared replacement is how it stays down on
 * all four rather than three.
 *
 * ⚠ IT GRANTS NOTHING. It decides which client to hand back; the client then
 * reads through RLS, where an anonymous request without a matching token reads
 * nothing at all. A caller who reaches a page and cannot read its brief gets
 * `notFound()` from the page itself, exactly as a signed-in stranger always
 * did.
 *
 * The redirect stays for the one case that is genuinely stuck: no session and
 * no usable cookie. There is nothing to show that person, and `/login` is
 * where their brief would be if they have an account.
 */
export type BriefAccess = {
  supabase: SupabaseClient<Database>;
  /** Null for an anonymous caller — `loadBrief` reads that as "let RLS decide". */
  userId: string | null;
  /** True when the brief is held by a cookie rather than an account. */
  anonymous: boolean;
};

export async function requireBriefAccess(nextPath: string): Promise<BriefAccess> {
  const caller = await resolveBriefCaller();

  if (caller.kind === "none") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return {
    supabase: caller.supabase,
    userId: caller.userId,
    anonymous: caller.kind === "anon",
  };
}
