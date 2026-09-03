import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type OwnedOrganization = {
  id: string;
  name: string;
  defaultSupervisorName: string | null;
};

/**
 * The organization the current user owns. Every account owns exactly one
 * (handle_new_user auto-creates it — lot 1), so this is the natural
 * owner-only gate for lot D2/D3: a clinician who was only invited into
 * someone else's practice still owns her own organization-of-one, and
 * that is the one this returns and the practice dashboard shows.
 */
export async function loadOwnedOrganization(
  supabase: Client,
  userId: string
): Promise<OwnedOrganization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, default_supervisor_name")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    defaultSupervisorName: data.default_supervisor_name,
  };
}
