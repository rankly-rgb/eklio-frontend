"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProjectFormState = { error: string } | null;

const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Donnez un nom à votre projet pour le retrouver facilement.")
  .max(80, "Choisissez un nom de 80 caractères au maximum.");

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/projets/nouveau");
  }

  const parsed = projectNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: parsed.data })
    .select("id")
    .single();

  if (error || !project) {
    console.error("[createProject] création projet", error);
    return {
      error:
        "Le projet n'a pas pu être créé. Vérifiez votre connexion puis réessayez.",
    };
  }

  const { error: briefError } = await supabase
    .from("project_briefs")
    .insert({ project_id: project.id });

  if (briefError) {
    console.error("[createProject] création brief", briefError);
    // On supprime le projet orphelin pour ne pas laisser un état incohérent.
    const { error: cleanupError } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);
    if (cleanupError) {
      console.error(
        "[createProject] échec du nettoyage du projet orphelin",
        project.id,
        cleanupError
      );
    }
    return {
      error:
        "Le projet n'a pas pu être initialisé. Vérifiez votre connexion puis réessayez.",
    };
  }

  revalidatePath("/app");
  redirect(`/app/projets/${project.id}/brief/1`);
}

export type DeleteProjectState = { error: string } | null;

export async function deleteProject(
  _prevState: DeleteProjectState,
  formData: FormData
): Promise<DeleteProjectState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const projectId = z.uuid().safeParse(formData.get("projectId"));
  if (!projectId.success) {
    return { error: "Ce projet est introuvable." };
  }

  // La RLS garantit qu'on ne peut supprimer que ses propres projets.
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId.data);

  if (error) {
    console.error("[deleteProject] suppression", error);
    return {
      error:
        "La suppression a échoué. Vérifiez votre connexion puis réessayez.",
    };
  }

  revalidatePath("/app");
  return null;
}
