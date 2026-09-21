import { z } from "zod";
import { authenticate, badRequest, readJson, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import { suggestTopics } from "@/lib/data/on-demand";

/*
 * POST /api/brand-kits/[id]/suggest-topics — trois sujets, gratuitement.
 *
 * ⚠ RIEN N'EST CONSOMMÉ ET RIEN N'EST ASSIGNÉ. `suggest_topics_for_kit`
 * REGARDE la banque ; `assign_topic_to_kit` est ce qui brûle un sujet à vie,
 * et il n'est appelé qu'au moment où elle en garde un. « Show three others »
 * peut donc tourner autant de fois qu'elle veut.
 *
 * ⚠ POST PLUTÔT QUE GET, pour une raison et une seule : `exclude` est une
 * liste d'identifiants qui grandit à chaque « show three others », et une
 * URL qui s'allonge à chaque clic finit par être tronquée par un proxy.
 *
 * Le droit est celui de la base : `suggest_topics_for_kit` est SECURITY
 * DEFINER et lit le kit par `auth.uid()`. La route ne décide rien.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/).nullable().default(null),
  limit: z.number().int().min(1).max(6).default(3),
  /** Ceux qu'elle a déjà vus. Bornés : au-delà, la banque est le problème. */
  exclude: z.array(z.string().uuid()).max(60).default([]),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/suggest-topics">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "That request could not be read.");
  }

  try {
    const result = await suggestTopics(auth.session.supabase, id, {
      month: body.data.month,
      limit: body.data.limit,
      exclude: body.data.exclude,
    });
    if (!result.ok) return contentResponse(result);
    return Response.json({ topics: result.data });
  } catch (error) {
    return serverError("POST /api/brand-kits/[id]/suggest-topics", error);
  }
}
