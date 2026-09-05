import { z } from "zod";
import { authenticate, badRequest, json, readJson, serverError } from "@/lib/api/handler";
import { syncNotifications } from "@/lib/data/notifications";

/*
 * POST /api/notifications/sync — the bell's data source. Calls
 * sync_notifications (eklio-backend, 20260905175222), which arms/advances
 * its own baseline and returns the current unread rows. Called once when
 * the header mounts and again whenever the bell opens; the RPC's own
 * idempotency (per-kind dedup indexes) makes repeated calls harmless.
 */

const bodySchema = z.object({ brandKitId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("A brand kit id is required.");

  try {
    const notifications = await syncNotifications(auth.session.supabase, parsed.data.brandKitId);
    return json({ notifications });
  } catch (error) {
    return serverError("POST /api/notifications/sync", error);
  }
}
