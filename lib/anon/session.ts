import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";
import { ANON_COOKIE, isPlausibleAnonToken } from "@/lib/anon/token";

/*
 * ── WHO IS ASKING: A USER, A TOKEN, OR NOBODY ───────────────────────────
 *
 * Every brief surface now has three possible callers, and exactly one place
 * that decides which it is. A route that worked this out for itself would
 * eventually get it wrong in the direction that matters.
 *
 * ⚠ THE TOKEN IS NEVER TRUSTED HERE. This attaches it to the request as a
 * header; the DATABASE decides whether it owns anything, through the policies
 * in `20260910192157_anonymous_briefs.sql`. Nothing in this file can grant
 * access, which is the point — a bug here fails closed, because a token that
 * matches no stored hash matches no row.
 */

export type BriefCaller =
  | { kind: "user"; supabase: SupabaseClient<Database>; userId: string; token: null }
  | { kind: "anon"; supabase: SupabaseClient<Database>; userId: null; token: string }
  | { kind: "none"; supabase: SupabaseClient<Database>; userId: null; token: null };

/**
 * A Supabase client that sends the anonymous token on every request.
 *
 * It still uses the ANON KEY and still goes through RLS — this is not an
 * escalation, it is the same client with one more header. `x-anon-token` is
 * what `public.anon_token_hash()` reads.
 */
function anonClient(token: string): SupabaseClient<Database> {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { "x-anon-token": token } },
      cookies: {
        // No session to carry: an anonymous caller has no Supabase auth
        // cookies, and writing any here would be inventing one.
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

/**
 * Who is asking, resolved once.
 *
 * A signed-in user wins over a token: someone who signed in on a device that
 * still carries an old cookie is looking at their account, not at whatever the
 * cookie points to.
 */
export async function resolveBriefCaller(): Promise<BriefCaller> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return { kind: "user", supabase, userId: user.id, token: null };

  const jar = await cookies();
  const token = jar.get(ANON_COOKIE)?.value;

  if (isPlausibleAnonToken(token)) {
    return { kind: "anon", supabase: anonClient(token), userId: null, token };
  }

  /*
   * No session and no usable cookie. The caller still gets a client, because
   * the alternative is every call site branching on null — and this one can
   * read exactly nothing, which is the correct amount.
   */
  return { kind: "none", supabase, userId: null, token: null };
}

/** The token on this request, if there is a usable one. */
export async function currentAnonToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ANON_COOKIE)?.value;
  return isPlausibleAnonToken(token) ? token : null;
}
