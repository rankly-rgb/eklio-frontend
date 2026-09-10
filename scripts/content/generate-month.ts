/*
 * ── THE GATE ────────────────────────────────────────────────────────────
 *
 * One kit, one month, with a hard ceiling checked BEFORE each call, and the
 * whole output printed for `WEEKEND_REVIEW.md`.
 *
 *   npx tsx scripts/content/generate-month.ts \
 *     --kit <uuid> --month 2026-10 \
 *     --themes "going back to a routine,rest,asking for help" \
 *     --confirm
 *
 * ── WHY IT ASKS FOR THE THEMES ──────────────────────────────────────────
 *
 * Because nothing in this codebase can honestly choose them yet. Three themes
 * is the ruled shape; WHICH three is the judgement that has to be made once by
 * a person who has read a real month, and the monthly cron says the same thing
 * (it answers 501 rather than guessing). A script that invented them here
 * would put the guess behind a command line instead of behind a flag, which is
 * not an improvement.
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────
 *
 *   * no `--confirm`               — this spends money on someone's behalf
 *   * a month that already exists  — one month, ever, until it has been read
 *   * a missing ANTHROPIC_API_KEY  — before anything, not on the first call
 *   * the ceiling                  — checked in front of every call, never after
 *
 * ── WHY IT NEEDS service_role, WHEN THE BRAND-IMAGE SCRIPTS REFUSE IT ───
 *
 * Those upload through the caller's own session, and the storage policies are
 * what authorize them; a service key there would bypass the very check being
 * relied on. Here the opposite is true by design: `reserve_content_image` and
 * `settle_content_image` are granted to `service_role` ALONE (spending is
 * revoked from `authenticated` entirely), and `content_months`, `content_items`
 * and `content_grounds` all deny client writes in their policies. A session key
 * cannot write a month, and that is the point of the permissions, not a gap.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { runMonthForKit, persistGeneratedMonth, GROUND_COST_CENTS } from "../../lib/content/generate/run";
import { withCallCeiling, CeilingReachedError } from "../../lib/content/generate/ceiling";
import { anthropicContentModel } from "../../lib/content/generate/model";
import { ARCHETYPE_FLOOR } from "../../lib/content/generate/capacity";
import {
  contentCheckinSchema,
  contentPreferencesSchema,
  type ContentRegister,
} from "../../lib/data/content";

/* ── Arguments ─────────────────────────────────────────────────────────── */

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}
const has = (name: string) => process.argv.includes(`--${name}`);

/**
 * ⚠ CALLS, NOT TOKENS. Token spend is only known once a response comes back,
 * so a token ceiling can only be checked afterwards — which is a receipt, not
 * a ceiling. Twelve posts need 12 lines + 12 captions + 12 alt texts = 36, and
 * the slack above that is the Ethics Guard's rewrites and refits.
 */
const DEFAULT_MAX_CALLS = 60;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  const kitId = arg("kit");
  const monthArg = arg("month");
  const themesArg = arg("themes");
  const maxCalls = Number(arg("max-calls") ?? DEFAULT_MAX_CALLS);

  if (!kitId) fail("--kit <uuid> is required.");
  if (!monthArg || !/^\d{4}-\d{2}$/.test(monthArg)) fail("--month YYYY-MM is required.");
  const month = `${monthArg}-01`;

  const themes = (themesArg ?? "")
    .split(",")
    .map((theme) => theme.trim())
    .filter(Boolean);
  if (themes.length !== 3) {
    fail(
      "--themes needs exactly three, comma separated.\n" +
        "  Three is the ruled shape; which three is a judgement nothing here can\n" +
        "  make yet. Read the kit's check-in for this month and choose from it."
    );
  }

  if (!has("confirm")) {
    fail(
      "Refusing without --confirm.\n" +
        `  This writes a month for kit ${kitId}: up to ${maxCalls} model calls and\n` +
        `  three photographs at ${GROUND_COST_CENTS}c each against her monthly allowance.`
    );
  }

  /* ── Keys, checked before anything, not on the first call ────────────── */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (!process.env.ANTHROPIC_API_KEY) {
    fail("ANTHROPIC_API_KEY is not set. Text is Anthropic; images are OpenAI. See CHANTIER_LOG.md.");
  }
  const drawGrounds = Boolean(process.env.OPENAI_API_KEY);

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  /* ── One month, ever, until it has been read ─────────────────────────── */
  const { data: existing } = await admin
    .from("content_months")
    .select("id, status, created_at")
    .eq("brand_kit_id", kitId)
    .eq("month", month)
    .maybeSingle();

  if (existing) {
    fail(
      `Kit ${kitId} already has a ${month} month (${existing.status}, ` +
        `written ${existing.created_at}).\n` +
        "  One month, ever, until it has been read. Delete it deliberately if you\n" +
        "  mean to replace it — this script will not."
    );
  }

  /* ── What the month is written from ──────────────────────────────────── */
  const { data: preferencesRow } = await admin
    .from("content_preferences")
    .select("brand_kit_id, cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", kitId)
    .maybeSingle();
  if (!preferencesRow) fail(`Kit ${kitId} has no content preferences. She has not been asked yet.`);

  /*
   * ⚠ PARSED, NOT CAST. `gen types` renders these `text`-under-CHECK columns as
   * `string`, and a cast would let a value the six registers do not cover reach
   * the generator, which would then look up a safety rule that does not exist
   * and prompt with `undefined`. Parsing turns that into a refusal here.
   */
  const parsedPreferences = contentPreferencesSchema.safeParse(preferencesRow);
  if (!parsedPreferences.success) {
    fail(`Kit ${kitId}'s preferences do not parse: ${parsedPreferences.error.message}`);
  }
  const preferences = parsedPreferences.data;

  const { data: checkinRow } = await admin
    .from("content_checkins")
    .select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", kitId)
    .eq("month", month)
    .maybeSingle();

  /*
   * A check-in that does not parse is treated as no check-in — never as a
   * default. `taking_clients` governs whether a post may ask anyone to get in
   * touch, and `null` is the strictest reading (no post asks), so falling back
   * to it is safe in the direction that matters.
   */
  const parsedCheckin = checkinRow ? contentCheckinSchema.safeParse(checkinRow) : null;
  if (checkinRow && !parsedCheckin?.success) {
    console.error("▸ the check-in row does not parse; writing from the brief alone.");
  }
  const checkin = parsedCheckin?.success ? parsedCheckin.data : null;

  const { data: registers } = await admin
    .from("content_registers")
    .select("id, safety_rule");
  const safetyRules = Object.fromEntries(
    (registers ?? []).map((row) => [row.id, row.safety_rule])
  ) as Record<ContentRegister, string>;

  const { data: rules } = await admin.from("ethics_rules").select("*");

  const context = [
    checkin?.sessions_theme ? `IN HER SESSIONS THIS MONTH: ${checkin.sessions_theme}` : "",
    checkin?.happening ? `HAPPENING THIS MONTH: ${checkin.happening}` : "",
    preferences.off_limits ? `NEVER WRITE ABOUT: ${preferences.off_limits}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  /* ── The ceiling goes on before the first call ───────────────────────── */
  const { model, ledger } = withCallCeiling(
    anthropicContentModel(rules ?? []),
    maxCalls
  );

  console.error(`\n▸ kit ${kitId} · ${month} · cadence ${preferences.cadence_per_week}`);
  console.error(`▸ themes: ${themes.join(" / ")}`);
  console.error(`▸ ceiling: ${maxCalls} model calls`);
  console.error(`▸ grounds: ${drawGrounds ? "yes" : "SKIPPED (no OPENAI_API_KEY)"}\n`);

  let generated;
  try {
    generated = await runMonthForKit({
      admin,
      brandKitId: kitId,
      month,
      themes,
      preferences,
      checkin,
      safetyRules,
      rules: rules ?? [],
      context,
      model,
      drawGrounds,
    });
  } catch (error) {
    if (error instanceof CeilingReachedError) {
      console.error(`\n✗ ${error.message}`);
      console.error(`  Calls made: ${ledger.calls.join(", ")}\n`);
      process.exit(1);
    }
    throw error;
  }

  const persisted = await persistGeneratedMonth(admin, kitId, month, generated);

  /* ── The report, in the order the review asks for it ─────────────────── */
  const { data: allowance } = await admin.rpc("get_content_image_allowance", {
    p_brand_kit_id: kitId,
    p_month: month,
  } as never);

  const out: string[] = [];
  out.push(`## THE GATE — ${month}, kit \`${kitId}\``);
  out.push("");
  out.push(`Written by \`${generated.generatedBy}\`. ${ledger.calls.length} model calls of ${maxCalls}.`);
  out.push("");

  out.push("### 1. The twelve on-image lines");
  out.push("");
  out.push("| # | Register | Archetype | Chars | Floor | Line |");
  out.push("|---|---|---|---|---|---|");
  for (const post of generated.posts) {
    out.push(
      `| ${post.index + 1} | ${post.register} | ${post.archetype} | ` +
        `${post.onImageText.length} | ${ARCHETYPE_FLOOR[post.archetype]} | ` +
        `${post.onImageText.replace(/\|/g, "\\|")} |`
    );
  }
  out.push("");

  out.push("### 2. The captions");
  out.push("");
  for (const post of generated.posts) {
    out.push(`**${post.index + 1} · ${post.theme} · ${post.scheduledFor}**`);
    out.push("");
    out.push(post.caption);
    out.push("");
  }

  out.push("### 3. Alt text");
  out.push("");
  for (const theme of generated.themes) {
    const post = generated.posts.find((entry) => entry.theme === theme);
    if (post) out.push(`- **${theme}** — ${post.altText}`);
  }
  out.push("");

  out.push("### 4. Grounds and composed posts, by storage path");
  out.push("");
  for (const ground of generated.grounds) {
    out.push(`- **${ground.theme}** — \`${ground.storagePath ?? "(none)"}\` · ${ground.state} · ${ground.costCents}c`);
  }
  for (const post of generated.posts) {
    out.push(`- post ${post.index + 1} → \`${post.groundPath ?? "(typographic, no photograph)"}\``);
  }
  out.push("");

  out.push("### 5. The allowance ledger");
  out.push("");
  out.push("```json");
  out.push(JSON.stringify(allowance, null, 2));
  out.push("```");
  out.push("");

  out.push("### 6. What the Ethics Guard caught, and what it rewrote");
  out.push("");
  if (generated.ethicsCheck.flagged.length === 0) {
    out.push("Nothing was flagged. Not a claim that nothing was risky — a fact about the scan.");
  } else {
    for (const entry of generated.ethicsCheck.flagged) {
      out.push(`- \`${entry.field}\` · **${entry.rule_id}** · "${entry.excerpt}"`);
    }
  }
  out.push("");
  if (generated.retries.length > 0) {
    out.push("Refits and rewrites:");
    out.push("");
    for (const note of generated.retries) {
      out.push(`- post ${note.index + 1} · ${note.field} · attempt ${note.attempt} · ${note.because}`);
    }
    out.push("");
  }

  out.push(`Persisted as month \`${persisted.monthId}\`, ${persisted.items} posts, all \`proposed\`.`);
  out.push("");

  console.log(out.join("\n"));
  console.error(`\n✓ ${persisted.items} posts written as proposed. Paste the block above into WEEKEND_REVIEW.md.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
