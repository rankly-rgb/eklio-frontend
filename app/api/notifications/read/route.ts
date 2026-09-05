import { z } from "zod";
import { authenticate, badRequest, json, readJson, serverError } from "@/lib/api/handler";
import { markNotificationsRead } from "@/lib/data/notifications";

/*
 * POST /api/notifications/read — opening the bell clears it. Calls
 * mark_notifications_read (eklio-backend, 20260905175222).
 */

const bodySchema = z.object({ brandKitId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("A brand kit id is required.");

  try {
    const ok = await markNotificationsRead(auth.session.supabase, parsed.data.brandKitId);
    return json({ ok });
  } catch (error) {
    return serverError("POST /api/notifications/read", error);
  }
}
