import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * "Your first week" — the seven-step launch checklist.
 *
 * Reads and writes go through `get_launch_progress`/`set_launch_step`
 * (SECURITY DEFINER RPCs, 20260903260000_launch_checklist_first_week.sql),
 * never a direct table read: the RPCs already exclude the legacy
 * `choose_direction` row and shape the tri-state status, so there is only
 * one place that logic lives.
 */

type Client = SupabaseClient<Database>;

export const LAUNCH_STEP_KEYS = [
  "site_setup",
  "update_directory",
  "google_profile",
  "social_setup",
  "email_signature",
  "booking_link",
  "first_post",
] as const;

export type LaunchStepKey = (typeof LAUNCH_STEP_KEYS)[number];
export type LaunchStepStatus = "todo" | "done" | "skipped";

export type LaunchStep = {
  key: LaunchStepKey;
  label: string;
  description: string | null;
  status: LaunchStepStatus;
};

export type LaunchProgress = {
  items: LaunchStep[];
  resolvedCount: number;
  total: number;
};

const EMPTY_PROGRESS: LaunchProgress = { items: [], resolvedCount: 0, total: 0 };

export async function loadLaunchProgress(
  supabase: Client,
  brandKitId: string
): Promise<LaunchProgress> {
  const { data, error } = await supabase.rpc("get_launch_progress", {
    p_brand_kit_id: brandKitId,
  });

  if (error) {
    console.error("[checklist] get_launch_progress", error);
    return EMPTY_PROGRESS;
  }

  const result = data as
    | { items: LaunchStep[]; resolved_count: number; total: number }
    | { error: { code: string; message: string } };

  if ("error" in result) {
    console.error("[checklist] get_launch_progress", result.error);
    return EMPTY_PROGRESS;
  }

  return {
    items: result.items,
    resolvedCount: result.resolved_count,
    total: result.total,
  };
}

export type SetStepOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "write-failed"; detail: unknown };

export async function setLaunchStep(
  supabase: Client,
  brandKitId: string,
  key: LaunchStepKey,
  status: LaunchStepStatus
): Promise<SetStepOutcome> {
  const { data, error } = await supabase.rpc("set_launch_step", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_status: status,
  });

  if (error) return { ok: false, reason: "write-failed", detail: error };

  const result = data as { ok: true } | { error: { code: string; message: string } };
  if ("error" in result) {
    if (result.error.code === "not_found") return { ok: false, reason: "not-found" };
    return { ok: false, reason: "write-failed", detail: result.error };
  }

  return { ok: true };
}
