/*
 * ── TODAY'S CEILING, RENDERED ───────────────────────────────────────────
 *
 * Split out of `scripts/funnel.ts` so the rendering can be tested against the
 * exact JSON `public.anon_spend_today()` returns in production, rather than
 * being believed. The script fetches; this formats; nothing here talks to a
 * database.
 *
 * ⚠ NOTHING IN `app/` MAY IMPORT THIS. It is Eklio's own spend, and the same
 * rule that keeps the funnel out of the product keeps this out of it —
 * `lib/funnel/__tests__/funnel.test.ts` enforces both.
 */

/**
 * A paid purchase that names no project.
 *
 * ⚠ SOMEBODY PAID AND GOT NOTHING. `grant_plan_allowance` returns false on a
 * null project, so no allowance was opened; `brand_kit_entitled` is scoped to
 * the project, so nothing unlocked either. It is fixable by hand in seconds —
 * one UPDATE naming the project — which is exactly why it needs to be visible:
 * a failure nobody can see is a failure nobody will fix.
 */
export type Orphans = {
  total: number;
  amount_cents: number;
  oldest: string | null;
  rows: Array<{
    id: string;
    user_id: string;
    tier: string;
    amount_cents: number;
    created_at: string;
    suggested_project_id: string | null;
  }>;
};

export type Glance = {
  day: string;
  enabled: boolean;
  reveals: { used: number; cap: number; left: number; pct: number | null };
  assists: { used: number; cap: number; left: number; pct: number | null };
  spend_usd: number;
  spend_usd_max: number;
  headroom_usd: number;
  rates: { reveal: number; assist: number; reveal_max: number; assist_max: number };
  distinct_ips: number;
  busiest_ip_reveals: number;
  refused: {
    total: number;
    ip_cap: number;
    global_cap: number;
    disabled: number;
    unreadable: number;
  };
};

/** A 24-cell gauge. The shape is what you read before the number. */
function gauge(pct: number | null): string {
  if (pct === null) return "";
  const filled = Math.max(0, Math.min(24, Math.round((pct / 100) * 24)));
  return "█".repeat(filled) + "·".repeat(24 - filled);
}


/**
 * The block printed above every funnel report, whatever window it covers.
 *
 * Returns lines rather than printing them: a function that writes to stdout
 * cannot be asserted on, and this is the one part of the report someone will
 * read at seven in the morning and act on.
 */
export function renderCeilingGlance(g: Glance, orphans?: Orphans): string[] {
  const out: string[] = [];
  const say = (line = "") => out.push(line);

  /*
   * ⚠ ONE MARK, AND IT HAS TO BE VISIBLE FROM ACROSS THE ROOM. The whole
   * point of this block is that a bad morning announces itself before you
   * have read a single number. 80% is the threshold because raising a ceiling
   * takes seconds but noticing takes a day.
   */
  const alarm =
    !g.enabled ||
    g.refused.total > 0 ||
    (g.reveals.pct ?? 0) >= 80 ||
    (g.assists.pct ?? 0) >= 80 ||
    (orphans?.total ?? 0) > 0;

  say();
  say(`  ${alarm ? "⚠ " : ""}TODAY — ${g.day} (UTC)`);
  say(`  ${"─".repeat(74)}`);

  if (!g.enabled) {
    say("  ⚠ ANONYMOUS GENERATION IS OFF. Every visitor is being refused.");
    say("    app_settings → anon_generation_enabled → true");
    say();
  }

  say(
    `  reveals   ${String(g.reveals.used).padStart(4)} / ${String(g.reveals.cap).padEnd(5)} ` +
      `${gauge(g.reveals.pct)}  ${String(g.reveals.pct ?? "—").padStart(5)}%   ${g.reveals.left} left`
  );
  say(
    `  assists   ${String(g.assists.used).padStart(4)} / ${String(g.assists.cap).padEnd(5)} ` +
      `${gauge(g.assists.pct)}  ${String(g.assists.pct ?? "—").padStart(5)}%   ${g.assists.left} left`
  );

  say();
  say(
    `  spent today   $${g.spend_usd.toFixed(2).padStart(7)}   ` +
      `(at worst $${g.spend_usd_max.toFixed(2)})`
  );
  say(
    `  headroom      $${g.headroom_usd.toFixed(2).padStart(7)}   ` +
      `what the rest of today's ceiling would cost`
  );
  say(
    `  visitors      ${String(g.distinct_ips).padStart(7)}   distinct addresses; ` +
      `busiest one used ${g.busiest_ip_reveals} of 3 reveals`
  );

  if (g.refused.total === 0) {
    say("  refusals            0   nobody has been turned away today");
  } else {
    const parts = [
      g.refused.ip_cap ? `${g.refused.ip_cap} per-IP` : null,
      g.refused.global_cap ? `${g.refused.global_cap} GLOBAL CAP` : null,
      g.refused.disabled ? `${g.refused.disabled} switch off` : null,
      g.refused.unreadable ? `${g.refused.unreadable} meter unreadable` : null,
    ].filter(Boolean);
    say(`  ⚠ refusals    ${String(g.refused.total).padStart(7)}   ${parts.join(", ")}`);

    /*
     * ⚠ THE TWO REFUSALS ARE NOT THE SAME EVENT, AND THE LINE SAYS WHICH.
     * A per-IP refusal is usually one person pressing again, or a script, and
     * it costs nothing. A GLOBAL refusal is a therapist who finished the whole
     * brief and got nothing — the single worst outcome this product can
     * produce, and the one thing here that is worth acting on immediately.
     */
    if (g.refused.global_cap > 0) {
      say("    A GLOBAL refusal is a real therapist who finished the brief and got");
      say("    nothing. Raise anon_generation_daily_global now — it takes effect on");
      say("    the next request, no deploy.");
    }
  }

  /*
   * ── ⚠ SOMEBODY PAID AND GOT NOTHING ──────────────────────────────────
   *
   * Beside the cap rather than in a report of its own, because it belongs to
   * the same glance: this is the other thing that, seen this morning, would
   * change what you do today. Zero every morning is the answer.
   *
   * `undefined` means the query was not run or failed — which is NOT zero, and
   * the line says which of the two it is rather than printing a comforting 0.
   */
  if (orphans === undefined) {
    say("  ⚠ orphaned      ?     paid purchases with no project — could not be read");
  } else if (orphans.total === 0) {
    say("  orphaned            0   every paid purchase names its project");
  } else {
    say(
      `  ⚠ orphaned    ${String(orphans.total).padStart(7)}   ` +
        `paid purchases with NO project — $${(orphans.amount_cents / 100).toFixed(2)} ` +
        `taken, nothing opened`
    );
    for (const row of orphans.rows.slice(0, 5)) {
      const when = row.created_at.slice(0, 10);
      say(
        `      ${when}  ${row.tier.padEnd(9)} $${(row.amount_cents / 100).toFixed(2).padStart(7)}  purchase ${row.id}`
      );
      /*
       * The suggestion, never the action. Printed as the exact statement to
       * run, because at seven in the morning the difference between a hint and
       * a command you can paste is whether it gets fixed today.
       */
      if (row.suggested_project_id) {
        say(
          `        update public.purchases set project_id = '${row.suggested_project_id}' where id = '${row.id}';`
        );
        say(
          `        then: select public.grant_plan_allowance('${row.suggested_project_id}', '${row.tier}', 'manual-${row.id}');`
        );
      } else {
        say("        no single obvious project — check this account by hand.");
      }
    }
    if (orphans.rows.length > 5) {
      say(`      … and ${orphans.rows.length - 5} more.`);
    }
  }

  /*
   * ⚠ THE RATES ARE ESTIMATES AND THE LINE SAYS SO EVERY TIME. Eklio never
   * displays a number it cannot measure; the counts here are exact and the
   * dollars are counts × a rate measured from the prompt builders, never a
   * billed amount. When the first invoice lands, correct the two app_settings
   * rows and every figure above corrects with them.
   */
  say();
  say(
    `  Dollars are ESTIMATES: $${g.rates.reveal} per reveal, ` +
      `$${g.rates.assist} per assist`
  );
  say(
    `  (worst case $${g.rates.reveal_max} / $${g.rates.assist_max}), ` +
      `from app_settings, not from an invoice.`
  );
  say(`  ${"─".repeat(74)}`);

  return out;
}

/** What to print when the ceiling cannot be read at all. */
export function unreadableCeiling(message: string): string[] {
  /*
   * ⚠ LOUD, AND NEVER A REASSURING ZERO. Not knowing what today has cost is
   * itself worth acting on; the funnel below is still worth reading.
   */
  return [
    "",
    `  ⚠ TODAY'S CEILING: could not be read — ${message}`,
    "    Treat this as unknown spend, not as no spend.",
    "",
  ];
}
