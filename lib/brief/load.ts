import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { briefDraftSchema, type BriefDraft } from "@/lib/brief/schemas";
import type { Tables } from "@/types/supabase";

export type ProjectWithBrief = {
  project: Tables<"projects">;
  brief: Tables<"project_briefs">;
  draft: BriefDraft;
};

/*
 * Charge un projet et son brief pour l'utilisateur connecté. La RLS filtre
 * déjà par propriétaire : un projet d'un autre utilisateur est simplement
 * absent du résultat → 404, jamais de page d'erreur générique.
 */
export async function loadProjectWithBrief(
  projectId: string
): Promise<ProjectWithBrief> {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(projectId)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!brief) {
    notFound();
  }

  // Les données jsonb repassent par zod : on ne fait jamais confiance au
  // contenu stocké pour typer l'interface.
  const parsed = briefDraftSchema.safeParse(brief.data);

  return {
    project,
    brief,
    draft: parsed.success ? parsed.data : {},
  };
}
