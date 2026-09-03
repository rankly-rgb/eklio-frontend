"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadOwnedOrganization } from "@/lib/data/organization";
import { createOrgInvite } from "@/lib/tenancy/rpc";

/*
 * Same server-action shape as app/app/checkout/actions.ts: a plain-object
 * arg "use server" function, called via useTransition() from a client
 * component, no <form>, no useActionState.
 */

export type SendInviteResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "That invite couldn't be sent. Please try again.";

const inputSchema = z.object({ email: z.string().email() });

export async function sendInvite(input: { email: string }): Promise<SendInviteResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };

  const org = await loadOwnedOrganization(supabase, user.id);
  if (!org) return { ok: false, error: GENERIC_ERROR };

  const result = await createOrgInvite(supabase, {
    orgId: org.id,
    email: parsed.data.email,
  });

  if (!result.ok) {
    return { ok: false, error: result.error.message || GENERIC_ERROR };
  }
  return { ok: true, token: result.data };
}
