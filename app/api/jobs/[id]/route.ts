import type { NextRequest } from "next/server";
import { authenticate, json, notFound } from "@/lib/api/handler";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readJob, statusOf, GENERATION_STAGES } from "@/lib/generation/job";

/*
 * GET /api/jobs/[id] — l'avancement d'une génération. `[id]` est l'id du kit.
 *
 * Sondée toutes les 1,5 s par l'écran de génération. Le `done` vient des
 * DIRECTIONS présentes en base, jamais du job seul : une pipeline qui se
 * croirait finie sans avoir écrit enverrait l'utilisateur sur une révélation
 * vide.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/jobs/[id]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const kit = await loadBrandKit(auth.session.supabase, id, auth.session.userId);
  if (!kit) return notFound();

  const status = statusOf(readJob(kit.row.content), kit.directions !== null);

  if (!status) return notFound();

  return json({
    status: status.status,
    stageIndex: status.stageIndex,
    stages: GENERATION_STAGES.map((stage) => stage.label),
    startedAt: status.startedAt,
    brandKitId: kit.row.id,
  });
}
