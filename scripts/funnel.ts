/*
 * ── THE FUNNEL, WITHOUT WRITING SQL AT MIDNIGHT ─────────────────────────
 *
 *   npx tsx scripts/funnel.ts                 # the last 7 days
 *   npx tsx scripts/funnel.ts --days 1        # today so far
 *   npx tsx scripts/funnel.ts --days 30
 *   npx tsx scripts/funnel.ts --from 2026-10-01 --to 2026-10-08
 *
 * One command, one table, and every number labelled with what it actually
 * counts. The arithmetic lives in `public.funnel_report` and
 * `public.anon_spend_today` (eklio-backend), never here: two definitions of
 * "conversion" would eventually disagree, and the one you were not reading
 * would be the one you believed.
 *
 * ── WHAT IS AT THE TOP, AND WHY ─────────────────────────────────────────
 *
 * TODAY'S CEILING, whatever window the funnel below covers. This is the thing
 * that would make you act on the morning of a campaign, and until it existed
 * the first sign of the daily cap was a real therapist being refused seven
 * screens into her evening. Headroom is the warning; a non-zero refusal count
 * is the confirmation that it is already too late to be early.
 *
 * ── WHAT IT NEEDS ───────────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SUPABASE_URL     the project URL
 *   SUPABASE_SERVICE_ROLE_KEY    `funnel_report` is service-role only, because
 *                                `funnel_events` refuses every browser
 *
 * Both from `.env.local` at the repo root (already covered by `.gitignore`) or
 * from the environment. Neither is ever printed.
 *
 * ── WHY THERE IS NO SCREEN FOR THIS ─────────────────────────────────────
 *
 * ⚠ BECAUSE IT IS NOT HER DATA. It is Eklio's, about Eklio's own funnel, and
 * the moment a number from it appears in the product it stops being
 * measurement and becomes a claim about other people. `app/api/briefs/
 * __tests__/funnel-stays-out-of-the-product.test.ts` keeps it that way.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import {
  renderCeilingGlance,
  unreadableCeiling,
  type Glance,
} from "../lib/funnel/glance";

/* ── .env.local, without a dependency ──────────────────────────────────── */
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key!]) continue;
    process.env[key!] = rawValue!.replace(/^["']|["']$/g, "");
  }
}

/* ── Arguments ─────────────────────────────────────────────────────────── */
function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function window(): { from: Date; to: Date; label: string } {
  const rawFrom = arg("from");
  const rawTo = arg("to");
  if (rawFrom) {
    const from = new Date(`${rawFrom}T00:00:00Z`);
    const to = rawTo ? new Date(`${rawTo}T00:00:00Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("--from/--to want YYYY-MM-DD.");
    }
    return { from, to, label: `${rawFrom} → ${rawTo ?? "now"}` };
  }

  const days = Number(arg("days") ?? 7);
  if (!Number.isFinite(days) || days < 1) throw new Error("--days wants a positive number.");
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, label: `the last ${days} day${days === 1 ? "" : "s"}` };
}

/* ── Rendering ─────────────────────────────────────────────────────────── */
const PHASE_RULE: Record<string, string> = {
  reach: "REACH",
  brief: "THE BRIEF",
  reveal: "THE REVEAL",
  account: "THE ACCOUNT",
  paid: "THE MONEY",
};

function pad(value: string | number | null, width: number, right = true): string {
  const text = value === null ? "—" : String(value);
  return right ? text.padStart(width) : text.padEnd(width);
}

/** A 20-cell bar. Proportion of the first step, so the shape is the story. */
function bar(pct: number | null): string {
  if (pct === null) return "";
  const filled = Math.max(0, Math.min(20, Math.round((pct / 100) * 20)));
  return "█".repeat(filled) + "·".repeat(20 - filled);
}


/* ── Today's ceiling ───────────────────────────────────────────────────── */

async function printCeilingGlance(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<void> {
  const { data, error } = await supabase.rpc("anon_spend_today");
  const lines = error
    ? unreadableCeiling(error.message)
    : renderCeilingGlance(data as unknown as Glance);
  for (const line of lines) console.log(line);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Put both in .env.local at the repo root, or in the environment."
    );
    process.exit(1);
  }

  const { from, to, label } = window();

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  await printCeilingGlance(supabase);

  const { data, error } = await supabase.rpc("funnel_report", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) {
    console.error(`funnel_report: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as Array<{
    step_no: number;
    step_key: string;
    label: string;
    phase: string;
    events: number;
    visitors: number;
    projects: number;
    pct_of_first: number | null;
    pct_of_previous: number | null;
  }>;

  console.log(`\n  EKLIO — the funnel, ${label}`);
  console.log(`  ${from.toISOString()} → ${to.toISOString()}\n`);

  let phase = "";
  console.log(
    `  ${pad("step", 28, false)} ${pad("events", 7)} ${pad("visitors", 9)} ${pad("projects", 9)}  ${pad("of 1st", 7)} ${pad("of prev", 8)}`
  );
  console.log(`  ${"─".repeat(28)} ${"─".repeat(7)} ${"─".repeat(9)} ${"─".repeat(9)}  ${"─".repeat(7)} ${"─".repeat(8)}`);

  for (const row of rows) {
    if (row.phase !== phase) {
      phase = row.phase;
      console.log(`\n  ${PHASE_RULE[phase] ?? phase.toUpperCase()}`);
    }
    const pctFirst = row.pct_of_first === null ? null : Number(row.pct_of_first);
    console.log(
      `  ${pad(row.label, 28, false)} ${pad(row.events, 7)} ${pad(row.visitors, 9)} ${pad(row.projects, 9)}  ` +
        `${pad(pctFirst === null ? null : `${pctFirst}%`, 7)} ` +
        `${pad(row.pct_of_previous === null ? null : `${Number(row.pct_of_previous)}%`, 8)}  ${bar(pctFirst)}`
    );
  }

  /*
   * ⚠ THE FOOTNOTE IS NOT DECORATION. Every one of these limits is real, and
   * a funnel read without them will be over-read. Eklio never displays a
   * number it cannot measure, and that rule applies hardest to the numbers it
   * shows its own author at two in the morning.
   */
  console.log(`
  ─────────────────────────────────────────────────────────────────────────
  events    exact. Every recorded occurrence, re-presses and reloads included.
  visitors  AN ESTIMATE. A daily-salted hash of the IP address: one office
            router is one visitor, one phone that switches to wifi is two,
            and a walk that crosses midnight UTC is two. Only the first two
            steps have nothing better.
  projects  exact from "Started the brief" onward, and it survives signup —
            this is the column that follows one person end to end.
  of 1st    share of the widest count the FIRST step had.
  of prev   share of the widest count the PREVIOUS step had. Blank where the
            previous step was zero, because a percentage of nothing is not a
            number.

  Nothing here is a claim about a person. No word she wrote is in this table;
  the column that would hold one refuses anything over 64 characters.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
