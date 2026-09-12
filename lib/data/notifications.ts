import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Notifications — the bell's data. Thin wrappers over sync_notifications /
 * mark_notifications_read (eklio-backend, 20260905175222); no client-side
 * filtering or staleness logic lives here, the RPCs already did it.
 */

/*
 * ⚠ DEUX GENRES, PAS TROIS. `content_ready` est parti avec la table morte
 * (20260910082539) : la contrainte CHECK en base ne l'admet plus, et
 * `sync_notifications` ne l'écrit plus. Le nouveau système notifiera depuis
 * `content_items` quand il aura quelque chose de vrai à dire — il n'héritera
 * pas de ce genre-ci, dont le payload portait un id d'une table disparue.
 */
export type NotificationKind = "asset_rendered" | "site_stale";

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

/**
 * A notification as the home screen's "recent updates" rows draw it: a title
 * and the line under it.
 *
 * ⚠ ADDITIVE, NOT A REPLACEMENT. `notificationLine` below still serves the
 * bell, which has room for one sentence and no second line. Changing it to
 * return a pair would have re-shaped the bell to suit a different screen.
 */
export type NotificationRow = { title: string; detail: string | null };

export function notificationRow(notification: Notification): NotificationRow {
  switch (notification.kind) {
    case "asset_rendered": {
      const key = typeof notification.payload.key === "string" ? notification.payload.key : null;
      return {
        title: key ? `${key.replace(/_/g, " ")} was rebuilt` : "An asset was rebuilt",
        detail: "Rendered again under your current brand",
      };
    }
    case "site_stale":
      return {
        title: "Your site instructions changed",
        detail: "Since you last copied them",
      };
    default:
      return { title: "Something changed", detail: null };
  }
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
    default:
      return "Something changed.";
  }
}
