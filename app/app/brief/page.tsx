import { redirect } from "next/navigation";

import { BriefWizard } from "@/components/brief/brief-wizard";
import { loadBriefCatalog } from "@/lib/eklio/catalog";
import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";
import type { BriefPreview } from "@/lib/eklio/brief";

export default async function BriefPage() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  const [{ data: brief }, catalog, { data: preview }] = await Promise.all([
    supabase
      .from("project_briefs")
      .select("*")
      .eq("project_id", workspace.projectId)
      .maybeSingle(),
    loadBriefCatalog(),
    supabase.rpc("brief_preview", { p_brief_id: workspace.projectId }),
  ]);

  if (!brief) redirect("/app");

  return (
    <BriefWizard
      projectId={workspace.projectId}
      initialStep={brief.progress_step}
      initialPreview={(preview as BriefPreview | null) ?? null}
      catalog={catalog}
      initialAnswers={{
        practice_name: brief.practice_name,
        city: brief.city,
        state: brief.state,
        license_type_id: brief.license_type_id,
        specialty_ids: brief.specialty_ids,
        positioning: brief.positioning,
        client_persona_ids: brief.client_persona_ids,
        problem_card_ids: brief.problem_card_ids,
        gain_card_ids: brief.gain_card_ids,
        tone_card_id: brief.tone_card_id,
        palette_family_ids: brief.palette_family_ids,
        type_pairing_id: brief.type_pairing_id,
        site_goal_ids: brief.site_goal_ids,
        primary_action_id: brief.primary_action_id,
        builder_target_id: brief.builder_target_id,
      }}
    />
  );
}
