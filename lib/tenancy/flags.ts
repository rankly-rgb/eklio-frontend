import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Lot D1 — the kill switch every practice-UI route reads before rendering
 * anything. app_settings has RLS on with zero policy and anon/authenticated
 * revoked (same lockdown as usp_similarity_threshold — see
 * lib/generation/usp-guardrails.ts, the pattern this mirrors), so this MUST
 * be called with the service-role client (createAdminClient()) and only
 * from server code: a Server Component, a route handler, or a server
 * action. Never from a client component — there is no anon/authenticated
 * grant to fall back to, and this function's whole job is to gate a route
 * before render, not to be a client-visible toggle.
 *
 * Fails closed: a missing row or a query error reads as disabled, not
 * enabled.
 */
export async function isPracticeUiEnabled(
  admin: SupabaseClient<Database>
): Promise<boolean> {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "practice_ui_enabled")
    .single();

  if (error || !data) return false;
  return data.value === true;
}
