import { authenticate, badRequest, readJson, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import {
  contentPatchSchema,
  deleteContentItem,
  getContentItem,
  updateContentItem,
} from "@/lib/data/content";

/*
 * One content item: read it, autosave it, delete it.
 *
 * ── WHY THIS IS NOT UNDER /api/brand-kits/[id] ──────────────────────────
 *
 * `/api/content/[id]/unlock` already exists and takes a
 * `monthly_presence_content` id. Hanging a second, different id space off the
 * same path would make `/api/content/<uuid>` mean two things depending on
 * which table the uuid happens to live in. `content-items` is its own word.
 *
 * The entitlement check is the database's: every RPC here calls
 * `content_kit_access`, which answers `not_found` for a stranger's item
 * BEFORE it answers `payment_required` for an unpaid one — so a refusal code
 * never confirms that someone else's item exists.
 */
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: RouteContext<"/api/content-items/[id]">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    return contentResponse(await getContentItem(auth.session.supabase, id));
  } catch (error) {
    return serverError("GET /api/content-items/[id]", error);
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/content-items/[id]">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = contentPatchSchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "That change could not be saved.");
  }

  // An empty patch is a no-op the database should never be asked about.
  if (Object.keys(body.data).length === 0) {
    return badRequest("Nothing to save.");
  }

  try {
    return contentResponse(await updateContentItem(auth.session.supabase, id, body.data));
  } catch (error) {
    return serverError("PATCH /api/content-items/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/content-items/[id]">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    return contentResponse(await deleteContentItem(auth.session.supabase, id));
  } catch (error) {
    return serverError("DELETE /api/content-items/[id]", error);
  }
}
