import { z } from "zod";
import { authenticate, badRequest, json, readJson, serverError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/server";
import { setEmailSubscribed } from "@/lib/email/state";

/*
 * POST /api/settings/email — the Settings page's email-preference toggle.
 * Email subscription state lives in auth.users.raw_user_meta_data (no
 * email_log table exists -- lib/email/state.ts's own header explains why),
 * so writing it needs the admin client; the caller's identity comes from
 * their own session, never from the request body.
 */

const bodySchema = z.object({ subscribed: z.boolean() });

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("That preference couldn't be saved.");

  try {
    const admin = createAdminClient();
    const { data: account } = await admin.auth.admin.getUserById(auth.session.userId);
    await setEmailSubscribed(
      admin,
      auth.session.userId,
      account?.user?.user_metadata,
      parsed.data.subscribed
    );
    return json({ ok: true });
  } catch (error) {
    return serverError("POST /api/settings/email", error);
  }
}
