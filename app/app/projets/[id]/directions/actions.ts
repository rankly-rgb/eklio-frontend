"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateDirectionsFromBrief } from "@/lib/ai/directions";
import { briefDraftSchema } from "@/lib/brief/schemas";

export type GenerateDirectionsResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "La génération a échoué. Vérifiez votre connexion puis réessayez.";

/*
 * Génère (ou régénère) les 3 directions créatives d'un projet à partir de
 * son brief. Remplace intégralement les directions existantes. Aucune
 * limite de régénération pour l'instant — sera introduite avec Stripe.
 */
export async function generateDirections(
  projectId: string
): Promise<GenerateDirectionsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Votre session a expiré. Reconnectez-vous." };
  }

  if (!z.uuid().safeParse(projectId).success) {
    return { ok: false, error: "Ce projet est introuvable." };
  }

  const { data: project, error: projectSelectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (projectSelectError) {
    console.error("[generateDirections] lecture projet", projectSelectError);
  }
  if (!project) {
    return { ok: false, error: "Ce projet est introuvable." };
  }

  const { data: briefRow, error: briefSelectError } = await supabase
    .from("project_briefs")
    .select("data")
    .eq("project_id", projectId)
    .maybeSingle();

  if (briefSelectError) {
    console.error("[generateDirections] lecture brief", briefSelectError);
  }
  if (!briefRow) {
    return { ok: false, error: "Ce projet est introuvable." };
  }

  const parsedBrief = briefDraftSchema.safeParse(briefRow.data);
  const draft = parsedBrief.success ? parsedBrief.data : {};

  let result;
  try {
    result = await generateDirectionsFromBrief(project.name, draft);
  } catch (error) {
    console.error("[generateDirections] appel Anthropic", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Remplace intégralement les directions précédentes (régénération).
  const { error: deleteError } = await supabase
    .from("directions")
    .delete()
    .eq("project_id", projectId);
  if (deleteError) {
    console.error(
      "[generateDirections] suppression anciennes directions",
      deleteError
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const rows = result.directions.map((direction, index) => ({
    project_id: projectId,
    position: index + 1,
    name: direction.nom,
    description: direction.description,
    palette: direction.palette,
    typographie_titre: direction.typographie_titre,
    typographie_corps: direction.typographie_corps,
  }));

  const { error: insertError } = await supabase.from("directions").insert(rows);
  if (insertError) {
    console.error("[generateDirections] insertion directions", insertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status: "directions" })
    .eq("id", projectId);
  if (projectUpdateError) {
    console.error(
      "[generateDirections] mise à jour statut projet",
      projectUpdateError
    );
  }

  revalidatePath("/app");
  revalidatePath(`/app/projets/${projectId}/directions`);
  redirect(`/app/projets/${projectId}/directions`);
}

export type SelectDirectionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function selectDirection(
  projectId: string,
  directionId: string
): Promise<SelectDirectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Votre session a expiré. Reconnectez-vous." };
  }

  const parsedProjectId = z.uuid().safeParse(projectId);
  const parsedDirectionId = z.uuid().safeParse(directionId);
  if (!parsedProjectId.success || !parsedDirectionId.success) {
    return { ok: false, error: "Cette direction est introuvable." };
  }

  const { error: clearError } = await supabase
    .from("directions")
    .update({ is_selected: false })
    .eq("project_id", projectId);
  if (clearError) {
    console.error("[selectDirection] réinitialisation sélection", clearError);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: selectError } = await supabase
    .from("directions")
    .update({ is_selected: true })
    .eq("id", directionId)
    .eq("project_id", projectId);
  if (selectError) {
    console.error("[selectDirection] sélection", selectError);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/app/projets/${projectId}/directions`);
  return { ok: true };
}
