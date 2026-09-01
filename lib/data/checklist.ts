import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";

/*
 * La checklist de lancement.
 *
 * Les items sont SEMÉS par la base (`seed_launch_checklist`, SECURITY DEFINER,
 * idempotente) : la RLS refuse l'INSERT et le DELETE côté application. On ne
 * peut donc que LIRE les siens et COCHER les siens — ce qui est exactement le
 * périmètre de l'accueil.
 */

type Client = SupabaseClient<Database>;

export type ChecklistItem = {
  id: string;
  key: Tables<"launch_checklist_items">["key"];
  label: string;
  description: string | null;
  done: boolean;
  sortOrder: number;
};

export type Checklist = {
  items: ChecklistItem[];
  doneCount: number;
  total: number;
};

function toItem(row: Tables<"launch_checklist_items">): ChecklistItem {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    done: row.done_at !== null,
    sortOrder: row.sort_order,
  };
}

export async function loadChecklist(
  supabase: Client,
  brandKitId: string
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("launch_checklist_items")
    .select("*")
    .eq("brand_kit_id", brandKitId)
    .order("sort_order");

  if (error) {
    console.error("[checklist] lecture", error);
    return { items: [], doneCount: 0, total: 0 };
  }

  const items = (data ?? []).map(toItem);
  return {
    items,
    doneCount: items.filter((item) => item.done).length,
    total: items.length,
  };
}

export type ToggleOutcome =
  | { ok: true; item: ChecklistItem }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "write-failed"; detail: unknown };

/**
 * Coche ou décoche un item.
 *
 * L'UPDATE est cadré par `user_id` en plus de la RLS : une politique qui
 * changerait ne doit pas transformer cette route en levier sur la checklist
 * d'autrui. Un item absent ou d'autrui répond « not-found », donc 404.
 */
export async function toggleChecklistItem(
  supabase: Client,
  itemId: string,
  userId: string,
  done: boolean
): Promise<ToggleOutcome> {
  const { data, error } = await supabase
    .from("launch_checklist_items")
    .update({
      done_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, reason: "write-failed", detail: error };
  if (!data) return { ok: false, reason: "not-found" };

  return { ok: true, item: toItem(data) };
}
