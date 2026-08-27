import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrief, readPreview } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { STEP_COUNT, resumeStep, type StepDraft } from "@/lib/brief/flow";
import { BriefFlow } from "@/components/brief/brief-flow";

/**
 * `?step=3` — posé par les liens « Edit » du récapitulatif.
 *
 * C'est une AMORCE, pas une autorité : la page lit toujours `progress_step`,
 * et le paramètre ne fait que décider par quelle question on entre. Il ne
 * s'écrit nulle part, et une valeur aberrante retombe sur l'étape reprise.
 */
function seedStep(
  raw: string | string[] | undefined,
  brief: { progress_step: number }
): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value < 1 || value > STEP_COUNT) {
    return resumeStep(brief);
  }
  return value;
}

/*
 * Le brief (Écrans 1, 2 et 8).
 *
 * `[id]` est l'identifiant du PROJET : `project_briefs` a `project_id` pour
 * clé primaire. L'étape reprise vient de `progress_step`, canonique (§0.5) —
 * `projects.current_step` n'est ni lu ni écrit.
 */
export default async function BriefPage({
  params,
  searchParams,
}: PageProps<"/app/briefs/[id]">) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/briefs/${id}`);

  const bundle = await loadBrief(supabase, id, user.id);
  // Projet inexistant OU appartenant à quelqu'un d'autre : la même réponse.
  if (!bundle) notFound();

  const [catalog, preview] = await Promise.all([
    readCatalog(supabase),
    readPreview(supabase, id),
  ]);

  const draft: StepDraft = {
    practice_name: bundle.brief.practice_name,
    license_type_id: bundle.brief.license_type_id,
    specialty_ids: bundle.brief.specialty_ids,
    city: bundle.brief.city,
    state: bundle.brief.state,
    positioning: bundle.brief.positioning,
    problem_card_ids: bundle.brief.problem_card_ids,
    gain_card_ids: bundle.brief.gain_card_ids,
    client_persona_ids: bundle.brief.client_persona_ids,
    tone_card_id: bundle.brief.tone_card_id,
    palette_family_ids: bundle.brief.palette_family_ids,
    type_pairing_id: bundle.brief.type_pairing_id,
    primary_action_id: bundle.brief.primary_action_id,
    site_goal_ids: bundle.brief.site_goal_ids,
    data: bundle.data,
  };

  return (
    <main className="route-enter flex min-h-0 flex-1 flex-col">
      <BriefFlow
        projectId={id}
        catalog={catalog}
        initialDraft={draft}
        initialStep={seedStep(query.step, bundle.brief)}
        initialCompleted={bundle.brief.completed_steps}
        initialPreview={preview}
      />
    </main>
  );
}
