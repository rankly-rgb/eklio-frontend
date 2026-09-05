import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Ce dont l'en-tête a besoin, et rien de plus : les initiales de l'avatar et
 * l'identifiant du kit de marque vers lequel pointent « Brand kit » et
 * « Content ». Une seule requête, faite dans le layout de l'espace connecté.
 */

export type HeaderContext = {
  initials: string;
  /** Her full name, falling back to the email's local part -- shown in the account menu. */
  displayName: string;
  brandKitId: string | null;
};

/**
 * Initiales affichées dans l'avatar. Le nom complet quand on l'a, sinon la
 * partie locale de l'email — jamais plus de deux lettres.
 */
export function initialsFrom(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const source = (fullName ?? "").trim() || (email ?? "").split("@")[0] || "";
  const words = source.split(/[\s._-]+/).filter(Boolean);

  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export async function loadHeaderContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null | undefined
): Promise<HeaderContext> {
  const [{ data: profile }, { data: kit }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    /*
     * Le kit courant : celui du projet le plus récemment mis à jour. La RLS de
     * `brand_kits` passe par `projects.user_id`, donc cette lecture ne peut
     * remonter que les kits de l'utilisateur.
     */
    supabase
      .from("brand_kits")
      .select("id, projects!inner(user_id, updated_at)")
      .eq("projects.user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    initials: initialsFrom(profile?.full_name, email),
    displayName: (profile?.full_name ?? "").trim() || (email ?? "").split("@")[0] || "",
    brandKitId: kit?.id ?? null,
  };
}
