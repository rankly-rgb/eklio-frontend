import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ANON_COOKIE,
  anonCookieOptions,
  hashAnonToken,
  isPlausibleAnonToken,
} from "@/lib/anon/token";
import { siteUrl } from "@/lib/site-url";

/*
 * ── THE WAY BACK, WHEN THE COOKIE IS GONE ───────────────────────────────
 *
 * She asked us to email her a link. This is where it lands: the token comes in
 * on the query string, the cookie is written, and she is put back on her brief
 * at the step she reached.
 *
 * ⚠ THE TOKEN NEVER STAYS IN THE URL. It redirects immediately to a clean
 * path, so the secret does not sit in her history, in a screenshot, or in the
 * `Referer` any third-party asset on the next page would send. That single
 * redirect is most of the security of a magic link.
 *
 * ⚠ AND IT DOES NOT EXTEND THE DEADLINE. Opening the link does not push
 * `anon_expires_at` out: thirty days is thirty days from when the brief was
 * started, and a link that quietly renewed itself would be the row that never
 * expires.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(path: string) {
  return NextResponse.redirect(new URL(path, siteUrl()));
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");

  if (!isPlausibleAnonToken(token)) {
    return back("/brief/resume/expired");
  }

  /*
   * Read with the service role, and read ONLY what is needed to decide: the id
   * and the step. This runs before any cookie exists, so there is no anonymous
   * session for RLS to match on yet — the token in hand is the credential, and
   * it is checked against the stored hash right here.
   */
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, project_briefs(progress_step)")
    .eq("anon_token_hash", hashAnonToken(token))
    .is("user_id", null)
    .gt("anon_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error(`[resume] ${error.message}`);
    return back("/brief/resume/expired");
  }

  /*
   * No row: expired, purged, or already claimed by an account. She gets one
   * screen for all three, because the difference is not something she can act
   * on differently — and naming which it was would tell whoever holds the link
   * something about a brief that is not theirs.
   */
  if (!project) return back("/brief/resume/expired");

  const jar = await cookies();
  jar.set(ANON_COOKIE, token, anonCookieOptions());

  /*
   * `project_briefs` is one-to-one on `project_id`, so PostgREST embeds it as
   * an object rather than an array. Typed here rather than indexed, because
   * `[0]` on an object is `undefined` and would silently send everyone back to
   * step 1 — the exact failure the abandoned-brief email was written to avoid.
   */
  const brief = project.project_briefs as { progress_step: number } | null;
  const step = brief?.progress_step ?? 1;
  return back(`/app/briefs/${project.id}?step=${step}`);
}
