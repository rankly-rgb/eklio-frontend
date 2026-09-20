import { authenticate, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import { swapContentItem } from "@/lib/data/content";

/*
 * POST /api/content-items/[id]/swap — « pas celui-là ».
 *
 * ⚠ RIEN N'EST GÉNÉRÉ ICI, ET C'EST TOUT L'INTÉRÊT. `swap_content_item` tire
 * le sujet suivant de la banque et recopie ce qui y est déjà écrit : la
 * caption, la ligne d'image, le diagramme, la justification. Aucun appel de
 * modèle, donc instantané et gratuit.
 *
 * Le journal enregistre quand même, avec `delta = 0`. « Elle a swappé onze
 * fois ce mois-ci » est le signal que le scoring de la banque est mauvais, et
 * un acte gratuit qui ne laisse aucune trace ne se mesure pas.
 *
 * ⚠ `bank_exhausted` SE DIT, IL NE SE RÉESSAIE PAS. Réessayer tirera le même
 * rien. C'est aussi le signal, en production, que la banque est
 * sous-dimensionnée pour ce segment.
 */
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/content-items/[id]/swap">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    return contentResponse(await swapContentItem(auth.session.supabase, id));
  } catch (error) {
    return serverError("POST /api/content-items/[id]/swap", error);
  }
}
