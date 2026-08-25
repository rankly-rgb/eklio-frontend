"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateDirectionsFromBrief } from "@/lib/ai/directions";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { parseStoredBriefDraft } from "@/lib/brief/schemas";

export type GenerateDirectionsResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/*
 * Échec déontologique : le modèle n'a pas produit de copy conforme, même après
 * régénération. On le dit sans citer les extraits fautifs — ils restent dans
 * les logs serveur (cf. lib/ethics/enforce.ts).
 */
const ETHICS_ERROR =
  "We couldn't generate compliant directions this time. Please try again.";

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
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  if (!z.uuid().safeParse(projectId).success) {
    return { ok: false, error: "This project could not be found." };
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
    return { ok: false, error: "This project could not be found." };
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
    return { ok: false, error: "This project could not be found." };
  }

  // Même lecture tolérante que le formulaire : les briefs enregistrés avant le
  // Lot 2 portent les anciennes clés françaises, traduites par
  // normalizeBriefDraft() — sans quoi la génération partirait sur un brief vide.
  const draft = parseStoredBriefDraft(briefRow.data);

  let result;
  try {
    result = await generateDirectionsFromBrief(project.name, draft);
  } catch (error) {
    console.error("[generateDirections] appel Anthropic", error);
    // Échec structurel comme échec déontologique : rien n'est persisté, la
    // génération s'arrête avant la moindre écriture.
    return {
      ok: false,
      error:
        error instanceof EthicsComplianceError ? ETHICS_ERROR : GENERIC_ERROR,
    };
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
    name: direction.name,
    description: direction.description,
    palette: direction.palette,
    // `typographie_titre` / `typographie_corps` sont les noms des COLONNES en
    // base : le Lot 2 renomme la forme générée, pas le schéma backend.
    typographie_titre: direction.heading_font,
    typographie_corps: direction.body_font,
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
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  const parsedProjectId = z.uuid().safeParse(projectId);
  const parsedDirectionId = z.uuid().safeParse(directionId);
  if (!parsedProjectId.success || !parsedDirectionId.success) {
    return { ok: false, error: "This direction could not be found." };
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
