"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { acceptOrgInvite } from "@/lib/tenancy/rpc";
import { getOrCreateOwnProject } from "@/lib/data/clinician-brief";

/*
 * Accepting an invite creates no project on its own — accept_org_invite's
 * own comment says so explicitly ("Does not create a project — that stays
 * in the app flow"). This action IS that app flow: accept, then
 * self-provision the accepted clinician's own project in the joined
 * organization (getOrCreateOwnProject — see its comment for why this is
 * the self-service path and organization_members.project_id is not).
 *
 * ⚠ What this action does NOT do, and why: the brief for this lot says to
 * call apply_charter_to_project after accepting, then route into the
 * brief pre-filled. apply_charter_to_project requires the CALLER to be the
 * organization's active owner (is_org_owner(auth.uid()) — lot B1,
 * 20260903120000_field_source_locks.sql) — but the caller here is the
 * newly-accepted CLINICIAN, never the owner. No admin/service-role client
 * changes this: that function reads auth.uid() from the caller's own JWT,
 * which a service-role connection does not carry. This is the stop-clause
 * condition "a fact in the brief contradicts the repo" — flagged in the
 * final report rather than worked around with a new bypass function.
 * Charter application stays something only the owner can trigger; nothing
 * in lot D currently gives her a button for it (also noted in the report).
 */

export type AcceptInviteResult =
  | { ok: true }
  | { ok: false; error: string };

const inputSchema = z.object({ token: z.string().min(1) });

export async function acceptInvite(input: { token: string }): Promise<AcceptInviteResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That invite link is invalid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first, then use the invite link again." };

  const result = await acceptOrgInvite(supabase, { token: parsed.data.token });
  if (!result.ok) {
    return { ok: false, error: result.error.message || "That invite link isn't valid." };
  }

  const project = await getOrCreateOwnProject(supabase, {
    userId: user.id,
    organizationId: result.data,
  });
  if (!project) {
    // The membership is active either way — a profile can still be filled
    // in from /app/profile, which retries project provisioning itself.
    return { ok: true };
  }

  return { ok: true };
}
