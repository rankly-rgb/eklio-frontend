import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Ce dont l'en-tête a besoin, et rien de plus : les initiales de l'avatar, le
 * nom affiché, et l'identifiant du kit de marque vers lequel pointent « Brand
 * kit » et « Content ».
 */

export type HeaderContext = {
  initials: string;
  /** Her name, her practice's name, or -- last -- the email's local part. */
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

/**
 * Le nom que porte la pastille de compte, dans l'ordre.
 *
 * ⚠ CE QUE CE CLASSEMENT CORRIGE. Il n'y en avait que deux, `full_name` puis
 * la partie locale de l'email — et `full_name` est vide pour toute personne
 * inscrite sans le renseigner. La pastille affichait donc
 * « contactnsocialmediaonline » à l'endroit exact où un nom est attendu, sur
 * tous les écrans de l'application. Ce n'est pas un défaut d'affichage : la
 * donnée existait, elle n'était simplement pas demandée.
 *
 * Le nom de la practice passe avant le prénom de la praticienne, et c'est
 * voulu : elle a choisi ce nom, il est écrit sur son site, et c'est
 * l'identité que l'application encadre. La partie locale de l'email reste,
 * en dernier — ce n'est pas un nom, c'est mieux que rien.
 */
export function displayNameFrom(sources: {
  fullName?: string | null;
  practiceName?: string | null;
  practitionerName?: string | null;
  email?: string | null;
}): string {
  const fullName = (sources.fullName ?? "").trim();
  if (fullName) return fullName;

  const practiceName = (sources.practiceName ?? "").trim();
  if (practiceName) return practiceName;

  // Le PRÉNOM, pas la ligne complète : « Dana », pas « Dana Whitfield, LCSW ».
  const firstName = (sources.practitionerName ?? "").trim().split(/\s+/)[0] ?? "";
  if (firstName) return firstName;

  return (sources.email ?? "").split("@")[0] || "";
}

/** `project_briefs.data` est du jsonb : on le lit, on ne le caste pas. */
function practitionerNameFrom(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const value = (data as Record<string, unknown>).practitioner_name;
  return typeof value === "string" ? value : null;
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
      .select("id, project_id, projects!inner(user_id, updated_at)")
      .eq("projects.user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  /*
   * Le brief n'est lu QUE si `full_name` est vide — c'est-à-dire dans le seul
   * cas où sa réponse change quelque chose. Un appel de plus sur chaque écran
   * de l'application pour une donnée déjà connue serait un coût pour rien.
   */
  let practiceName: string | null = null;
  let practitionerName: string | null = null;

  if (!(profile?.full_name ?? "").trim() && kit?.project_id) {
    const { data: brief } = await supabase
      .from("project_briefs")
      .select("practice_name, data")
      .eq("project_id", kit.project_id)
      .maybeSingle();
    practiceName = brief?.practice_name ?? null;
    practitionerName = practitionerNameFrom(brief?.data);
  }

  const displayName = displayNameFrom({
    fullName: profile?.full_name,
    practiceName,
    practitionerName,
    email,
  });

  return {
    // Les initiales suivent le nom résolu : un avatar « CO » à côté de
    // « Elm & Ember Therapy » se lirait comme deux comptes différents.
    initials: initialsFrom(displayName, email),
    displayName,
    brandKitId: kit?.id ?? null,
  };
}
