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
 * organization via getOrCreateOwnProject(), which goes through the
 * provision_clinician_project RPC (E1/E2,
 * 20260903150000_clinician_project_provisioning.sql). That RPC applies
 * the organization's charter internally after its own membership check —
 * the clinician never needs to be, or act as, the organization's owner.
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
    organizationId: result.data,
  });
  if (!project) {
    // The membership is active either way — a profile can still be filled
    // in from /app/profile, which retries project provisioning itself.
    return { ok: true };
  }

  return { ok: true };
}
