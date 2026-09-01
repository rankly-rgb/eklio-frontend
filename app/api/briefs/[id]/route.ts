import type { NextRequest } from "next/server";
import {
  authenticate,
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import {
  briefPatchSchema,
  loadBrief,
  patchBrief,
  readPreview,
} from "@/lib/data/brief";
import { track } from "@/lib/analytics";

/*
 * Le brief d'un projet.
 *
 * `[id]` est l'identifiant du PROJET : `project_briefs` a `project_id` pour
 * clé primaire, et `brief_preview(p_brief_id)` prend cette même valeur. Il n'y
 * a pas de table `briefs`, et il ne faut pas en créer une.
 *
 * Le PATCH renvoie le brief ET sa prévisualisation dans le même aller-retour :
 * le rail du brief n'a donc aucune seconde requête à faire, et pas de fenêtre
 * où il montrerait l'état d'avant.
 */

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/briefs/[id]">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { supabase, userId } = auth.session;

  const bundle = await loadBrief(supabase, id, userId);
  if (!bundle) return notFound();

  return json({
    brief: bundle.brief,
    data: bundle.data,
    project: bundle.project,
    preview: await readPreview(supabase, id),
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await readJson(request);
  const parsed = briefPatchSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(
      parsed.error.issues[0]?.message ?? "That change couldn't be saved."
    );
  }

  const outcome = await patchBrief(
    auth.session.supabase,
    id,
    auth.session.userId,
    parsed.data
  );

  if (outcome.ok) {
    if (parsed.data.completed_steps) {
      const last = Math.max(...parsed.data.completed_steps, 0);
      track("brief_step_completed", { step: last });
      if (last === 7) track("brief_reviewed", {});
    }
    return json({
      brief: outcome.brief,
      data: outcome.data,
      preview: outcome.preview,
    });
  }

  if (outcome.reason === "not-found") return notFound();
  if (outcome.reason === "unknown-id") {
    /*
     * Un id qui ne vient pas du catalogue n'est pas une faute de l'utilisateur
     * : c'est du code qui a fabriqué une valeur au lieu de la choisir. On le
     * refuse ici plutôt que de laisser `brief_preview()` retomber sur ses
     * replis, ce qui donnerait un rail figé sans dire pourquoi.
     */
    console.error(
      `[api] PATCH /api/briefs — id hors catalogue : ${outcome.field}=${outcome.id}`
    );
    return badRequest("That option is no longer available. Reload the page.");
  }

  return serverError("PATCH /api/briefs", outcome.detail);
}
