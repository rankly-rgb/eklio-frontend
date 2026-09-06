import { z } from "zod";
import { authenticate, badRequest, readJson, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import { PUBLISH_CHANNELS, markContentPosted } from "@/lib/data/content";

/*
 * POST /api/content-items/[id]/posted — "I posted this", and its undo.
 *
 * This is the only way a row reaches `content_publications`, and the database
 * makes it idempotent: marking an already-posted item posted again returns
 * `changed: false` and writes nothing. A double click, a retried request or a
 * flaky connection therefore cannot invent a publication that did not happen.
 *
 * Marking something posted is a claim about the world, not a generation:
 * nothing here spends a credit, and Eklio still never posts anything itself.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  posted: z.boolean(),
  channel: z.enum(PUBLISH_CHANNELS).nullable().optional(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/content-items/[id]/posted">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest("Say whether this went out or not.");
  }

  try {
    return contentResponse(
      await markContentPosted(
        auth.session.supabase,
        id,
        body.data.posted,
        body.data.channel ?? null
      )
    );
  } catch (error) {
    return serverError("POST /api/content-items/[id]/posted", error);
  }
}
