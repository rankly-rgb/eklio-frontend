import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";

/*
 * ── THE OTHER HALF OF THE FUNNEL ────────────────────────────────────────
 *
 * `funnel_events` grows with traffic and nothing else ever deletes from it.
 * A table nobody planned to bound is the shape of the dead monthly-content
 * table this project spent two sessions killing, so the purge ships WITH the
 * instrument rather than after someone notices in March.
 *
 * ⚠ 180 DAYS, AND IT LIVES IN `app_settings`. Long enough to compare one
 * campaign against the next; short enough that nothing here becomes a
 * permanent record of anybody's traffic. `funnel_retention_days`, editable
 * without a deploy like every other ceiling in this product.
 *
 * ⚠ AND IT FAILS OPEN. `purge_funnel_events` returns 0 rather than deleting
 * when the setting is missing or unreadable — the OPPOSITE of the spend
 * ceilings, and for the same reason: fail towards the outcome you can still
 * undo. A day of unpurged rows costs storage; a day of wrongly purged rows
 * costs the only copy.
 */

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const { data, error } = await createAdminClient().rpc("purge_funnel_events");

  if (error) {
    console.error(`[cron/purge-events] ${error.message}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const deleted = typeof data === "number" ? data : 0;
  console.info(`[cron/purge-events] ${deleted} row(s) past retention`);
  return NextResponse.json({ ok: true, deleted });
}
