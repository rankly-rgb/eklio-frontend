import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/cron";
import { ARMED_ENV_VAR, contentGenerationArmed } from "@/lib/content/generate/armed";

/*
 * ── THE MONTHLY FILL, SHIPPED DISARMED ──────────────────────────────────
 *
 * Written now so that arming it is one line of configuration rather than a
 * lot of work under time pressure at the end of a billing month. It does not
 * run: `vercel.json` has no entry for this path, and `CONTENT_GENERATION_ARMED`
 * is not set. See `lib/content/generate/armed.ts` for both locks and why there
 * are two.
 *
 * ── WHAT IT WILL DO WHEN IT IS ARMED ────────────────────────────────────
 *
 * For each kit with a live Monthly Presence subscription and saved content
 * preferences, and no `content_months` row for the coming month: pick three
 * themes, run `runMonthForKit`, persist the result as `proposed`, and notify
 * her that a month is waiting. `content_months_kit_month_key` is unique on
 * `(brand_kit_id, month)`, so a double fire cannot produce two months — the
 * second insert is refused by the database rather than by a flag someone
 * remembered to check.
 *
 * ── WHY IT ANSWERS 503 AND NOT 404 ──────────────────────────────────────
 *
 * A 404 would say the route does not exist, and whoever set `CRON_SECRET`
 * correctly and got nothing would go looking for a deployment problem. 503
 * with the variable's name says what is actually true: this exists, it is
 * switched off, and here is the switch.
 *
 * The `authorizeCron` check comes FIRST regardless — an unauthorised caller
 * learns nothing about what is or is not armed here.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  if (!contentGenerationArmed()) {
    return NextResponse.json(
      {
        armed: false,
        generated: 0,
        reason: `${ARMED_ENV_VAR} is not set to "true". Nothing was generated and nothing was spent.`,
      },
      { status: 503 }
    );
  }

  /*
   * ⚠ DELIBERATELY NOT IMPLEMENTED BEHIND AN ARMED FLAG.
   *
   * The enumeration — who is subscribed, who has preferences, who is missing a
   * month — is the easy half. The half that is NOT written is the one that
   * decides the three themes, and it cannot be written honestly until a real
   * month has been generated and read (the Session 3 gate, still blocked on a
   * model key). Shipping a guess at it behind a flag someone might flip is
   * worse than shipping nothing: the flag would then be the only thing between
   * a customer and twelve posts nobody has ever seen the like of.
   *
   * So the flag exists, the locks exist, the route exists — and arming it
   * today gets an honest 501 rather than a month written blind.
   */
  return NextResponse.json(
    {
      armed: true,
      generated: 0,
      reason:
        "Theme selection is not written yet. It waits on the first generated " +
        "month being read. Nothing was generated and nothing was spent.",
    },
    { status: 501 }
  );
}
