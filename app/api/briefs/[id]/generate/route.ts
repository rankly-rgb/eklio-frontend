import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, json, notFound, serverError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBrief } from "@/lib/data/brief";
import {
  GenerationNotImplementedError,
  runGenerationPipeline,
} from "@/lib/generation/pipeline";
import {
  GENERATION_TIMEOUT_MS,
  readJob,
  startedJob,
  withJob,
} from "@/lib/generation/job";
import { rateLimit } from "@/lib/api/rate-limit";
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
 *
 * ── CE QUI BORNE LA GÉNÉRATION GRATUITE ──────────────────────────────────
 *
 * `consume_generation_credit`, appelée AVANT l'appel modèle, dans la même
 * requête. Elle est atomique et rend `false` quand l'allocation est épuisée.
 *
 * Ne PAS lire un compteur puis décider : deux POST concurrents liraient le
 * même nombre et passeraient tous les deux. C'est exactement le trou que la
 * mesure a trouvé, et un `SELECT` suivi d'un `if` le rouvrirait.
 *
 * C'est aussi ce qui rend sûr le fait que la réponse parte avant le travail :
 * ce qu'un script épuise, c'est le crédit, pas notre patience.
 */

/**
 * Ralentisseur, en plus du crédit.
 *
 * Il coupe la boucle serrée avant qu'elle n'atteigne la base ; il ne protège
 * pas le budget — le crédit s'en charge. Cf. `lib/api/rate-limit.ts` sur
 * pourquoi les deux existent.
 */
const GENERATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/generate">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id: projectId } = await ctx.params;
  const { supabase, userId } = auth.session;

  const verdict = rateLimit(`generate:${userId}`, GENERATE_LIMIT);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "That's a lot of tries in a short time. Give it a minute." },
      {
        status: 429,
        headers: { "retry-after": String(verdict.retryAfterSeconds) },
      }
    );
  }

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

  /*
   * Une génération DÉJÀ EN VOL rend le même job.
   *
   * L'ancienne condition portait `&& !existing.directions`, donc elle ne
   * couvrait que les kits qui n'avaient jamais abouti : sur un kit qui avait
   * déjà des directions, deux POST simultanés lançaient deux pipelines. Le
   * `directions` est retiré, et la fraîcheur du job le remplace — un job plus
   * vieux que le plafond a perdu son processus, et il faut pouvoir réessayer.
   *
   * Ce n'est PAS la garde de concurrence : deux requêtes vraiment simultanées
   * liraient toutes les deux « pas en cours ». La garde, c'est le crédit, qui
   * est atomique. Ceci évite de BRÛLER un crédit pour rien pendant qu'une
   * génération tourne.
   */
  const inFlight = readJob(existing?.content);
  if (
    inFlight?.status === "running" &&
    Date.now() - Date.parse(inFlight.started_at) < GENERATION_TIMEOUT_MS
  ) {
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

  /*
   * LE CRÉDIT, AVANT L'APPEL MODÈLE.
   *
   * Atomique, donc c'est lui qui tranche entre deux requêtes concurrentes :
   * la seconde reçoit `false` et repart au checkout. Le job vient d'être posé
   * en `running` — on le remet en échec avant de refuser, sinon l'écran
   * d'attente tournerait sur une génération qui n'a jamais démarré.
   */
  const { data: credited, error: creditError } = await supabase.rpc(
    "consume_generation_credit",
    { p_brand_kit_id: kit.id }
  );

  if (creditError) return serverError("POST /api/briefs/generate", creditError);

  if (credited === false) {
    await supabase
      .from("brand_kits")
      .update({
        content: withJob(existing?.content ?? {}, {
          ...job,
          status: "failed",
          finished_at: new Date().toISOString(),
          error: "payment_required",
        }) as never,
      })
      .eq("id", kit.id);

    return NextResponse.json(
      {
        error: "Your free directions are used up — the next set is ready when you are.",
        checkoutUrl: `/app/checkout?project=${projectId}`,
      },
      { status: 402 }
    );
  }

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
