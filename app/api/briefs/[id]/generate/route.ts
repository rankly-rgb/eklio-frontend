import { after } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, json, notFound, serverError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBrief } from "@/lib/data/brief";
import {
  GenerationNotImplementedError,
  runGenerationPipeline,
} from "@/lib/generation/pipeline";
import { readJob, startedJob, withJob } from "@/lib/generation/job";
import { track } from "@/lib/analytics";

/*
 * POST /api/briefs/[id]/generate — démarre la génération, rend un id de job.
 *
 * L'id de job EST l'id du kit de marque : le statut se lit sur la ligne
 * `brand_kits`, et `done` ne peut donc jamais être rapporté avant que les
 * directions ne soient réellement écrites.
 *
 * La pipeline tourne dans `after()` : elle survit à la réponse, donc l'écran
 * de révélation reçoit son id tout de suite et se met à sonder, au lieu de
 * tenir une requête HTTP ouverte pendant une minute.
 *
 * `maxDuration` s'applique « à toutes les Server Actions utilisées sur la
 * page » ET au travail d'une route ; le plafond est ici, sur la route qui
 * porte réellement l'appel au modèle.
 */
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/generate">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id: projectId } = await ctx.params;
  const { supabase, userId } = auth.session;

  const bundle = await loadBrief(supabase, projectId, userId);
  if (!bundle) return notFound();

  /*
   * Un kit par projet (`brand_kits.project_id` est unique). On réutilise donc
   * la ligne existante — une régénération n'en crée pas une seconde — et on y
   * pose un nouveau job.
   */
  const { data: existing } = await supabase
    .from("brand_kits")
    .select("id, content, directions")
    .eq("project_id", projectId)
    .maybeSingle();

  const running = readJob(existing?.content)?.status === "running";
  if (running && !existing?.directions) {
    // Déjà en cours : on rend le même job plutôt que d'en lancer un second.
    return json({ jobId: existing!.id });
  }

  const job = startedJob();

  const { data: kit, error } = existing
    ? await supabase
        .from("brand_kits")
        .update({
          content: withJob(existing.content, job) as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase
        .from("brand_kits")
        .insert({
          project_id: projectId,
          content: withJob({}, job) as never,
        })
        .select("id")
        .single();

  if (error || !kit) return serverError("POST /api/briefs/generate", error);

  track("generation_started", { brandKitId: kit.id });

  after(async () => {
    try {
      await runGenerationPipeline({
        supabase,
        admin: createAdminClient(),
        projectId,
        brandKitId: kit.id,
        userId,
      });
      track("generation_succeeded", { brandKitId: kit.id });
    } catch (pipelineError) {
      track("generation_failed", {
        brandKitId: kit.id,
        // Le NOM de l'erreur, jamais son message : il peut citer de la copy.
        reason:
          pipelineError instanceof Error ? pipelineError.name : "unknown",
      });
      if (!(pipelineError instanceof GenerationNotImplementedError)) {
        console.error("[generate] pipeline", pipelineError);
      }
      await createAdminClient()
        .from("brand_kits")
        .update({
          content: withJob(existing?.content ?? {}, {
            ...job,
            status: "failed",
            finished_at: new Date().toISOString(),
            error:
              pipelineError instanceof Error
                ? pipelineError.message
                : "unknown",
          }) as never,
        })
        .eq("id", kit.id);
    }
  });

  return json({ jobId: kit.id });
}
