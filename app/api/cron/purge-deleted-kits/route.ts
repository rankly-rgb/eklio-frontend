import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";

/*
 * The other half of soft delete (Lot 9) — kits `delete_brand_kit` marked 30+
 * days ago get their storage objects removed, then the row itself, which
 * cascades to `brand_assets`/`direction_assets`/`site_specs`/
 * `launch_checklist_items`/`monthly_presence_content` (see
 * `20260903280000_delete_brand_kit.sql`'s own header for the FK shape).
 *
 * NEVER TOUCHES `purchases`/`subscriptions` — deletion doesn't refund, and
 * this cron is the actual data cleanup, not a billing action.
 *
 * IDEMPOTENT, same discipline as `cron/monthly`: storage removal on a path
 * that's already gone is a no-op, not an error, so a re-run after a partial
 * failure (storage cleared but the row-delete didn't reach, or the reverse)
 * is safe.
 *
 * Runs as `service_role` because it must: `storage.objects` has no client-
 * reachable DELETE policy for this bucket (`20260903090000_brand_asset_
 * storage.sql`'s own comment says so), and `brand_kits` DELETE isn't opened
 * to `authenticated` either — this is the one place in the product a kit is
 * actually, irreversibly removed, and it only ever runs on a schedule this
 * session never triggers directly.
 */

export const maxDuration = 300;

const PURGE_AFTER_DAYS = 30;
const STORAGE_BUCKET = "brand-assets";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();

  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: candidatesError } = await admin
    .from("brand_kits")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const results: { brand_kit_id: string; assets_removed: number; purged: boolean }[] = [];

  for (const kit of candidates ?? []) {
    const { data: assets } = await admin
      .from("brand_assets")
      .select("storage_path")
      .eq("brand_kit_id", kit.id);

    const paths = (assets ?? []).map((row) => row.storage_path);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
      if (removeError) {
        console.error("[cron/purge-deleted-kits] storage.remove", kit.id, removeError);
        results.push({ brand_kit_id: kit.id, assets_removed: 0, purged: false });
        continue;
      }
    }

    const { error: deleteError } = await admin.from("brand_kits").delete().eq("id", kit.id);
    if (deleteError) {
      console.error("[cron/purge-deleted-kits] brand_kits delete", kit.id, deleteError);
      results.push({ brand_kit_id: kit.id, assets_removed: paths.length, purged: false });
      continue;
    }

    results.push({ brand_kit_id: kit.id, assets_removed: paths.length, purged: true });
  }

  return NextResponse.json({ candidates: candidates?.length ?? 0, results });
}
