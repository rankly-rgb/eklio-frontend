"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadBriefAnswers } from "@/lib/actions/brief";
import { generateDirections } from "@/lib/ai/directions";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { isBriefComplete } from "@/lib/brief/steps";

export type DirectionsActionState = { error: string } | null;

async function requireProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, status")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  return { supabase, project };
}

/**
 * Generates three directions and replaces whatever was there before.
 *
 * Replace-not-append is deliberate: a project has exactly three directions at
 * any time, so regenerating never leaves a half-old, half-new set for the
 * practitioner to choose between.
 */
export async function generateProjectDirections(
  projectId: string,
  _prevState: DirectionsActionState,
  _formData: FormData
): Promise<DirectionsActionState> {
  const { supabase, project } = await requireProject(projectId);

  const answers = await loadBriefAnswers(projectId);
  if (!isBriefComplete(answers)) {
    return { error: "Finish the brief before generating directions." };
  }

  // TODO(Lot 5): regeneration gate. The paywall attaches here — check the
  // project's plan and remaining regenerations before spending a model call,
  // and return a { error, upgradeRequired } state the UI can route on. Free
  // tier limited, paid unlimited within reason. Until then, unlimited.

  let directions;
  try {
    directions = await generateDirections(answers);
  } catch (error) {
    if (error instanceof EthicsComplianceError) {
      // Nothing was persisted. Point at the brief, since the usual cause is a
      // practitioner having written a promise into their own answers.
      return {
        error:
          "We could not produce copy that clears the advertising-ethics rules for your license. This usually means the brief itself promises a result — check “What the client gains” and describe the direction of the work instead.",
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Generation failed. Nothing was saved — try again.",
    };
  }

  // Replace-not-append, and only after generation fully succeeded.
  const { error: deleteError } = await supabase
    .from("directions")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    return { error: "Could not clear the previous directions. Nothing changed." };
  }

  const { error: insertError } = await supabase.from("directions").insert(
    directions.map((direction, index) => ({
      project_id: projectId,
      position: index + 1,
      name: direction.name,
      description: direction.description,
      palette: direction.palette,
      typography: direction.typography,
    }))
  );

  if (insertError) {
    return { error: "Could not save the new directions. Try generating again." };
  }

  if (project.status === "brief" || project.status === "brief_complete") {
    await supabase
      .from("projects")
      .update({ status: "directions" })
      .eq("id", projectId);
  }

  revalidatePath(`/app/projects/${projectId}/directions`);
  revalidatePath("/app");
  return null;
}

/** Marks one direction as the chosen one; exactly one stays selected. */
export async function selectDirection(
  projectId: string,
  directionId: string
): Promise<void> {
  const { supabase } = await requireProject(projectId);

  await supabase
    .from("directions")
    .update({ is_selected: false })
    .eq("project_id", projectId);

  await supabase
    .from("directions")
    .update({ is_selected: true })
    .eq("project_id", projectId)
    .eq("id", directionId);

  revalidatePath(`/app/projects/${projectId}/directions`);
}
