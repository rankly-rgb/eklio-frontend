/*
 * ── THE SWITCH, IN ONE PLACE ────────────────────────────────────────────
 *
 * Generating a month spends real money on someone else's behalf: a model call
 * per post, twice, plus three photographs. It ships DISARMED, and arming it is
 * a deliberate act with a name.
 *
 * THERE ARE TWO LOCKS, AND BOTH MUST BE OPENED:
 *
 *   1. `vercel.json` does not list `/api/cron/content-month`. Nothing calls it
 *      on a schedule. Adding the entry is lock one.
 *   2. `CONTENT_GENERATION_ARMED` must be exactly `"true"` in the environment.
 *      Without it the route answers 503 even to a caller holding `CRON_SECRET`.
 *
 * Two rather than one because they fail differently. A schedule can be added
 * by someone reading `vercel.json` as configuration; an environment variable
 * has to be set by someone who went looking for this comment. Either alone is
 * a slip; both together is a decision.
 *
 * ⚠ ANY VALUE BUT THE EXACT STRING IS OFF. Not "truthy": `"false"`, `"0"` and
 * `"no"` are all off, and so is an unset variable. A flag that read `"false"`
 * as armed would be the most expensive typo in this product.
 */
export const ARMED_ENV_VAR = "CONTENT_GENERATION_ARMED";

export function contentGenerationArmed(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[ARMED_ENV_VAR] === "true";
}
