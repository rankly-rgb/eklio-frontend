import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";

/*
 * ── THE OTHER HALF OF ANONYMOUS BRIEFS ──────────────────────────────────
 *
 * Every bounced cold-email click leaves an ownerless row: a project, its
 * brief, and eventually a brand kit nobody will ever claim. A table nobody
 * planned to grow is exactly the shape of the dead monthly-content table this
 * project spent two sessions killing — so the purge ships WITH the feature,
 * not after someone notices in November.
 *
 * ⚠ THIRTY DAYS, AND THE SAME THIRTY AS `purge-deleted-kits`. One number for
 * "how long does Eklio keep something nobody claimed" is easier to reason
 * about, easier to state in a privacy notice, and harder to get wrong than
 * two. It is also the life of the cookie that points at the row, so nothing
 * survives that could still be reached, and nothing reachable is deleted.
 *
 * ⚠ THE DEADLINE IS NOT ENFORCED HERE. `projects_select_own` already refuses
 * an expired row, so a run that fails, or a schedule someone forgets, cannot
 * quietly extend anyone's access. This is housekeeping, and housekeeping is
 * allowed to be late.
 *
 * ⚠ IT NEVER TOUCHES A CLAIMED ROW. `user_id is null` is the whole filter
 * beside the deadline, and a claimed brief has both a user and a null expiry —
 * so it cannot match even if a clock is wrong.
 *
 * Deleting the project cascades to `project_briefs`, `brand_kits` and
 * everything under them, the same cascade `delete_brand_kit` documents.
 */

export const maxDuration = 300;

/** A bound, so one run cannot spend five minutes deleting. */
const BATCH = 500;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();

  const { data: expired, error } = await admin
    .from("projects")
    .select("id")
    .is("user_id", null)
    .lt("anon_expires_at", new Date().toISOString())
    .limit(BATCH);

  if (error) {
    console.error(`[cron/anon-briefs] ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (expired ?? []).map((row) => row.id);
  if (ids.length === 0) return NextResponse.json({ purged: 0 });

  const { error: deleteError } = await admin
    .from("projects")
    .delete()
    .in("id", ids)
    /*
     * ⚠ THE FILTER IS REPEATED ON THE DELETE. Between the select and the
     * delete, one of these could have been claimed by someone signing up — and
     * deleting the brief of a person who just made an account is the worst
     * thing this route could do. Re-stating the condition makes that race
     * impossible rather than unlikely.
     */
    .is("user_id", null)
    .lt("anon_expires_at", new Date().toISOString());

  if (deleteError) {
    console.error(`[cron/anon-briefs] delete: ${deleteError.message}`);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ purged: ids.length, more: ids.length === BATCH });
}
