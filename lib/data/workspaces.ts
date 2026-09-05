import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * The account menu's workspace switcher. Reads `workspaces`
 * (eklio-backend, 20260905175222) -- one row today, always hers, filtered
 * by auth.uid() in the view itself. The Practice offer adds rows later
 * without this function, or the switcher, needing to change.
 */

export type Workspace = {
  id: string;
  name: string;
  ownerName: string;
  isCurrent: boolean;
};

export async function loadWorkspaces(
  supabase: SupabaseClient<Database>
): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, owner_name, is_current");

  if (error || !data) return [];

  return data
    .filter((row): row is typeof row & { id: string } => row.id !== null)
    .map((row) => ({
      id: row.id,
      name: row.name ?? "Your workspace",
      ownerName: row.owner_name ?? "",
      isCurrent: row.is_current ?? true,
    }));
}
