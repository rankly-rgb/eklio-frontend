"use server";

import { createClient } from "@/lib/supabase/server";
import type { BriefPatch, BriefPreview } from "@/lib/eklio/brief";

/**
 * Autosave d'une étape du brief.
 *
 * Toutes les colonnes de réponse sont nullables et peuvent être écrites
 * seules : un brief à moitié rempli est l'état normal de cette table. La RLS
 * (`project_briefs_update_own`) fait le cadrage — on n'ajoute pas un second
 * contrôle de propriété qui dériverait.
 *
 * Rend la preview fraîche dans la même réponse : `brief_preview()` résout les
 * sept catalogues en un aller-retour, donc un deuxième appel serait une
 * requête réseau pour rien.
 */
export async function saveBrief(
  projectId: string,
  patch: BriefPatch
): Promise<{ ok: boolean; preview: BriefPreview | null; message?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_briefs")
    .update(patch)
    .eq("project_id", projectId);

  if (error) return { ok: false, preview: null, message: error.message };

  const { data } = await supabase.rpc("brief_preview", { p_brief_id: projectId });
  return { ok: true, preview: (data as BriefPreview | null) ?? null };
}
