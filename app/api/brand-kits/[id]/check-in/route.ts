import { authenticate, badRequest, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import { setContentCheckin, TAKING_CLIENTS, type TakingClients } from "@/lib/data/content";
import { z } from "zod";

/*
 * POST /api/brand-kits/[id]/check-in?month=YYYY-MM-01
 *
 * Her sixty seconds. All three answers are optional and stay optional: the
 * generator reads an unanswered check-in as "write from the brief alone", so
 * this route never refuses an empty body.
 *
 * ⚠ NOTHING HERE GENERATES OR SPENDS. It writes three text fields through
 * `set_content_checkin`, which is the only door the table has — its INSERT and
 * UPDATE policies are `false`. Ownership and the payment gate are decided
 * inside that RPC by `content_kit_access`, not re-decided here.
 */

const bodySchema = z.object({
  sessions_theme: z.string().max(600).nullable(),
  taking_clients: z.enum(TAKING_CLIENTS).nullable(),
  happening: z.string().max(600).nullable(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/brand-kits/[id]/check-in">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const month = new URL(request.url).searchParams.get("month");

  /*
   * The month is normalised to the first again inside the RPC. Validated here
   * anyway: a malformed value would otherwise reach `date_trunc` as a cast
   * error and surface as a 500 rather than as the caller's mistake.
   */
  if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return badRequest("A month is required, as YYYY-MM-DD.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("That check-in could not be read.");

  try {
    const result = await setContentCheckin(auth.session.supabase, {
      brandKitId: id,
      month,
      sessionsTheme: parsed.data.sessions_theme,
      takingClients: parsed.data.taking_clients as TakingClients | null,
      happening: parsed.data.happening,
    });

    /*
     * ⚠ THROUGH `contentResponse`, NOT A HAND-ROLLED JSON. It is the one place
     * a content refusal becomes a status: `not_found` is 404 and never 403,
     * and `payment_required` is 402 rather than a swallowed 500. A refusal
     * avalé en 500 is a dead end; a 402 is an offer.
     */
    return contentResponse(result);
  } catch (error) {
    return serverError("POST /api/brand-kits/[id]/check-in", error);
  }
}
