import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { contentGenerationArmed } from "./armed";

type Admin = SupabaseClient<Database>;

/*
 * ── "A MONTH IS COMING" IS A ROW, NOT A PROMISE ─────────────────────────
 *
 * She subscribes, and the first month should arrive without her asking. The
 * webhook cannot write it: generating a month takes minutes and Stripe gives a
 * webhook seconds. So the purchase QUEUES it, and the monthly cron picks it up.
 *
 * The queue is a `content_months` row in `generating`. No new table, and
 * idempotence for free: `content_months_kit_month_key` is unique on
 * `(brand_kit_id, month)`, so a Stripe replay is refused by the database
 * rather than by a flag someone remembered to check.
 *
 * ⚠ AND IT DOES NOTHING WHILE THE GENERATOR IS DISARMED. A `generating` row
 * whose generator never runs is a screen that says "Eklio is writing your
 * month" forever — a state the product cannot deliver, promised to someone who
 * has just paid. Queueing behind the same switch that arms the cron means the
 * two cannot disagree.
 */

export type QueueOutcome =
  | { queued: true; month: string }
  | { queued: false; reason: "disarmed" | "no_kit" | "already_queued" | "failed" };

/** The first of next month, in UTC. Calendar dates, never local instants. */
export function nextMonthKey(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

export async function queueFirstContentMonth(
  admin: Admin,
  input: { userId: string; now?: Date }
): Promise<QueueOutcome> {
  if (!contentGenerationArmed()) return { queued: false, reason: "disarmed" };

  const month = nextMonthKey(input.now);

  /*
   * Her kit, through her project. Read here rather than passed in because the
   * webhook knows about users and Stripe, and has no business knowing how a
   * kit hangs off a project.
   */
  const { data: kits, error: kitError } = await admin
    .from("brand_kits")
    .select("id, projects!inner(user_id)")
    .eq("projects.user_id", input.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (kitError) {
    console.error(`[content/queue] could not resolve a kit: ${kitError.message}`);
    return { queued: false, reason: "failed" };
  }

  const brandKitId = kits?.[0]?.id;
  if (!brandKitId) return { queued: false, reason: "no_kit" };

  const { error } = await admin
    .from("content_months")
    .insert({ brand_kit_id: brandKitId, month, themes: [], status: "generating" });

  if (error) {
    /*
     * 23505 is the unique key doing its job: the month is already queued, or
     * already written. That is the idempotent outcome, not a failure — and
     * reporting it as one would make a Stripe replay look like an incident.
     */
    if (error.code === "23505") return { queued: false, reason: "already_queued" };
    console.error(`[content/queue] could not queue the month: ${error.message}`);
    return { queued: false, reason: "failed" };
  }

  return { queued: true, month };
}
