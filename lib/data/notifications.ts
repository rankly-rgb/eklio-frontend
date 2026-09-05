import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Notifications — the bell's data. Thin wrappers over sync_notifications /
 * mark_notifications_read (eklio-backend, 20260905175222); no client-side
 * filtering or staleness logic lives here, the RPCs already did it.
 */

export type NotificationKind = "asset_rendered" | "site_stale" | "content_ready";

export type Notification = {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type Client = SupabaseClient<Database>;

function parseList(data: unknown): Notification[] {
  if (!Array.isArray(data)) return [];
  return data as Notification[];
}

export async function syncNotifications(
  supabase: Client,
  brandKitId: string
): Promise<Notification[]> {
  const { data, error } = await supabase.rpc("sync_notifications", {
    p_brand_kit_id: brandKitId,
  });
  if (error) return [];
  if (data && typeof data === "object" && "error" in (data as object)) return [];
  return parseList(data);
}

export async function markNotificationsRead(
  supabase: Client,
  brandKitId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_notifications_read", {
    p_brand_kit_id: brandKitId,
  });
  return !error && data === true;
}

/** One short, human line per notification kind — used by the bell's list. */
export function notificationLine(notification: Notification): string {
  switch (notification.kind) {
    case "asset_rendered": {
      const key = typeof notification.payload.key === "string" ? notification.payload.key : "An asset";
      return `${key.replace(/_/g, " ")} was rebuilt.`;
    }
    case "site_stale":
      return "Your site instructions are out of date with your latest edits.";
    case "content_ready": {
      const title =
        typeof notification.payload.title === "string" ? notification.payload.title : "A post";
      return `${title} is ready.`;
    }
    default:
      return "Something changed.";
  }
}
