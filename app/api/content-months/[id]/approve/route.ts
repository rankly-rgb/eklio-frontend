import { authenticate, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import { approveContentMonth } from "@/lib/data/content";

/*
 * Taking the month: every proposal becomes a draft, in one statement.
 *
 * ── WHY THERE IS NO OWNERSHIP CHECK HERE ────────────────────────────────
 *
 * `approve_content_month` performs it, and it is the only place that should.
 * It resolves the month's kit and calls `content_kit_access`, which answers
 * `not_found` for a stranger's month BEFORE `payment_required` for an unpaid
 * one — a 402 to a stranger would confirm the month exists. A second check
 * here would be a second place to get that ordering wrong.
 *
 * ── AND WHY IT IS A POST WITH NO BODY ───────────────────────────────────
 *
 * There is nothing to choose. She is not approving twelve things individually;
 * she is accepting a plan, which is one decision. Idempotent on replay: a
 * second call moves nothing and reports `moved: 0` rather than repeating the
 * first answer to look busy.
 */
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/content-months/[id]/approve">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    return contentResponse(await approveContentMonth(auth.session.supabase, id));
  } catch (error) {
    return serverError("POST /api/content-months/[id]/approve", error);
  }
}
