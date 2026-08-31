import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Workspace = {
  projectId: string;
  brandKitId: string | null;
};

/**
 * Récupère — ou crée — le projet de l'utilisatrice connectée.
 *
 * Un compte = un projet en V1. L'insertion d'un projet déclenche
 * `handle_new_project`, qui pose la ligne `generation_credits` : c'est ce qui
 * met le compteur du plan `free` en place. Ne jamais créer la ligne de crédits
 * à la main.
 *
 * La ligne `project_briefs` est posée en même temps, vide : un brief à moitié
 * rempli est l'état NORMAL de cette table, pas une erreur.
 */
export async function getOrCreateWorkspace(): Promise<Workspace | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("projects")
    .select("id, brand_kits(id)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const kits = existing.brand_kits as unknown as { id: string }[] | { id: string } | null;
    const brandKitId = Array.isArray(kits) ? kits[0]?.id ?? null : kits?.id ?? null;
    return { projectId: existing.id, brandKitId };
  }

  const { data: created, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: "Mon identité de marque" })
    .select("id")
    .single();

  if (error || !created) return null;

  await supabase
    .from("project_briefs")
    .insert({ project_id: created.id })
    .select("project_id")
    .maybeSingle();

  return { projectId: created.id, brandKitId: null };
}

/**
 * Le kit est créé au moment de la première génération, pas avant : c'est lui
 * qui porte `directions`, et `projects.id` y est unique.
 */
export async function getOrCreateBrandKit(projectId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("brand_kits")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("brand_kits")
    .insert({ project_id: projectId })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}
