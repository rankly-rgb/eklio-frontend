import { authenticate, json, notFound, serverError } from "@/lib/api/handler";
import { restoreBrandKit } from "@/lib/data/brand-kit";

/*
 * POST /api/brand-kits/[id]/restore — undoes a soft delete (Lot 9), from
 * home's "Recently deleted" section. Free, not paid — same reasoning as
 * the delete route (see its own header comment).
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/restore">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const outcome = await restoreBrandKit(auth.session.supabase, id);

  if (outcome.ok) return json({ ok: true });
  if (outcome.reason === "not-found") return notFound();
  return serverError("POST /api/brand-kits/[id]/restore", null);
}
