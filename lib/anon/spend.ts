import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { clientIp, ipBucket } from "@/lib/anon/token";
import { track } from "@/lib/analytics";

/*
 * ── THE WALL, IN ONE PLACE ──────────────────────────────────────────────
 *
 * Anonymous callers are the only people in this product who can spend money
 * without an account, and there are three routes through which they can:
 *
 *   POST /api/briefs/[id]/generate      three directions   $0.4280
 *   POST /api/briefs/[id]/tone-cards    step 5             $0.0558
 *   POST /api/briefs/[id]/usp-options   positioning        $0.0575
 *
 * The first shipped with a ceiling; the other two shipped without one, because
 * the ceiling lived inline in the route that had it. Hence this file: the
 * check is written once, and a fourth model-calling route added later has one
 * obvious thing to call rather than a paragraph to reproduce.
 *
 * ⚠ CALL IT BEFORE THE MODEL, AND ONLY WHEN THE MODEL WILL ACTUALLY BE
 * CALLED. Both `tone-cards` and `usp-options` return a cached batch without
 * spending anything; a count taken above that check would charge her for
 * re-entering a screen she already paid for.
 */

/**
 * Which ceiling this call spends.
 *
 * `reveal` is the one the budget is really about; `assist` is the two small
 * calls, which have their own pair of settings four times as high because one
 * honest brief makes several of them. Mirrors `p_kind` in
 * `public.consume_anon_generation` (20260910210435_anon_assist_ceiling.sql).
 */
export type AnonSpendKind = "reveal" | "assist";

/**
 * What a caller with no session and no usable cookie reads.
 *
 * Not an error to explain away: her brief is genuinely unreachable from this
 * browser, and the only honest thing is to say so and offer the way back.
 */
export function noBriefResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "We can't find your brief on this device. If you asked us to email you a link, open that; otherwise you can start again.",
    },
    { status: 401 }
  );
}

/**
 * Take one count against the anonymous ceilings, atomically.
 *
 * Returns `null` when the call may proceed, or the response to send back when
 * it may not — so a call site reads:
 *
 *     const refusal = await consumeAnonSpend("assist", request);
 *     if (refusal) return refusal;
 */
export async function consumeAnonSpend(
  kind: AnonSpendKind,
  request: Request
): Promise<NextResponse | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_anon_generation", {
    p_ip_hash: ipBucket(clientIp(request)),
    p_kind: kind,
  });

  if (error) {
    // A meter that cannot be read is "we could not tell", never "go ahead".
    console.error(`[anon-spend] consume_anon_generation: ${error.message}`);
    track("generation_refused", { kind, reason: "unreadable" });
    return NextResponse.json(
      { error: "We couldn't start that just now. Try again in a moment." },
      { status: 503 }
    );
  }

  const outcome = data as unknown as { ok?: boolean; reason?: string } | null;
  if (outcome?.ok === true) return null;

  /*
   * ⚠ THE ONLY TRACE A REFUSAL LEAVES. `consume_anon_generation` refuses and
   * writes nothing — by design, it is a counter, not a log. Without this line
   * the first sign of the daily ceiling is a therapist seven screens into her
   * evening getting nothing, and nobody finds out until she writes in.
   *
   * The machine reason, never the sentence she read, and never her address:
   * the hashed bucket is already in the counters table if you need it.
   */
  track("generation_refused", { kind, reason: outcome?.reason ?? "unknown" });

  return NextResponse.json(
    { error: anonCapMessage(outcome?.reason) },
    { status: 429, headers: { "retry-after": String(secondsUntilReset()) } }
  );
}

/**
 * Seconds until the ceilings reset.
 *
 * ⚠ THE COUNTERS ARE KEYED ON THE UTC DATE, so the reset is midnight UTC and
 * nothing else. The header used to say a flat 3600 — an hour — which is wrong
 * by up to twenty-three of them, and wrong in the direction that invites a
 * retry that will also fail.
 */
export function secondsUntilReset(now: Date = new Date()): number {
  const midnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(1, Math.ceil((midnightUtc - now.getTime()) / 1000));
}

/*
 * What a stranger reads when a ceiling closes.
 *
 * ⚠ NEVER "you have used your 3 of 3". She has no account, so a number about
 * her is a number about a device — and telling her the global ceiling is full
 * would be telling her the product is popular, which is not her problem. Both
 * refusals say the same true thing: not now, come back.
 *
 * ⚠ AND NEVER "IN A LITTLE WHILE", WHICH IS WHAT THIS USED TO SAY. The
 * ceilings reset at midnight UTC; a therapist in California reading this at
 * eight in the evening is nine hours from "a little while". She has just
 * answered seven screens, and a small lie at that exact moment is the most
 * expensive one this product can tell. It names the day, and it names the way
 * not to lose the work — the email offer is on the same screen.
 */
export function anonCapMessage(reason: string | undefined): string {
  switch (reason) {
    case "ip_cap":
      return "You've built a few of these today. Come back tomorrow, or make an account to keep going.";
    case "global_cap":
    case "disabled":
    default:
      return "We're at capacity for new brands today — your answers are saved. Come back tomorrow, or have us email you a link so you don't lose them.";
  }
}
