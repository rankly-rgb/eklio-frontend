import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readJob, statusOf } from "@/lib/generation/job";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { GenerationScreen } from "@/components/reveal/generation-screen";
import { RevealView } from "@/components/reveal/reveal-view";

/*
 * Génération (Écran 3) puis révélation (Écran 4) — la même route, deux états.
 *
 * `maxDuration` : cette page n'appelle pas le modèle (la génération vit dans
 * `POST /api/briefs/[id]/generate`, qui porte son propre plafond), mais elle
 * est l'écran où le praticien attend. Le plafond ci-dessous couvre le rendu et
 * les lectures, pas la génération.
 */
export const maxDuration = 300;

export default async function RevealPage({
  params,
}: PageProps<"/app/brand-kits/[id]/reveal">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/reveal`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  const status = statusOf(readJob(kit.row.content), kit.directions !== null);

  if (!kit.directions) {
    return (
      <GenerationScreen
        brandKitId={id}
        projectId={kit.projectId}
        initialStageIndex={status?.stageIndex ?? 0}
      />
    );
  }

  const [tier, credits] = await Promise.all([
    resolveEntitledTier(supabase, kit.projectId),
    supabase
      .from("generation_credits")
      .select("regenerations_used, regenerations_limit")
      .eq("project_id", kit.projectId)
      .maybeSingle(),
  ]);

  const left = credits.data
    ? Math.max(
        0,
        credits.data.regenerations_limit - credits.data.regenerations_used
      )
    : null;

  return (
    <RevealView
      brandKitId={id}
      projectId={kit.projectId}
      directions={kit.directions}
      practiceName={kit.practiceName}
      paid={tier !== null}
      regenerationsLeft={left}
    />
  );
}
