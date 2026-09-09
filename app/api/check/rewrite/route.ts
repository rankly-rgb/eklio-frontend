import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, badRequest, notFound, readJson, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readCatalog } from "@/lib/catalog/read";
import { CHECK_MAX_CHARS, CHECK_MIN_CHARS } from "@/lib/check/review";
import { rewriteAndRescan } from "@/lib/check/rewrite";
import { consumeCheckRewrite } from "@/lib/check/allowance";
import { AnthropicNotConfiguredError } from "@/lib/ai/client";
import { track } from "@/lib/analytics";

/*
 * POST /api/check/rewrite — ask the model to fix what the scan found.
 *
 * ── WHAT THIS COSTS, AND WHAT BOUNDS IT ─────────────────────────────────
 *
 * ⚠ IT SPENDS NEITHER METER. It used to call `consume_generation_credit`,
 * which is the DIRECTIONS ladder: three to twelve regenerations of a whole
 * brand, sold at 79 to 249 USD. A rewrite is one text call costing a fraction
 * of a cent. Charging a brand regeneration for it was absurd in the only
 * direction that matters — she would run out of the expensive thing by using
 * the cheap one. It does not touch `plans.image_budget_cents` either: no
 * pixels are made here.
 *
 * What bounds it instead is a per-user DAILY COUNT, `consume_check_rewrite`,
 * twenty a day by default and configurable in `app_settings` without a
 * deploy. Not money — a bound on the tight loop, which is the only real risk
 * a cheap endpoint carries.
 *
 * ⚠ COUNTED BEFORE THE CALL, NOT AFTER, and deliberately not "only when the
 * rewrite worked". A bound that only counts successes does not bound
 * anything: a script whose rewrites all fail is exactly the loop this is here
 * to stop. The cost of that choice is that a failed rewrite still spends one
 * of twenty — which is a rounding error at that ceiling, and the honest price
 * of a limit that actually limits.
 *
 * VERIFY-THEN-CONSUME, in one statement. `consume_check_rewrite` checks and
 * increments inside a single `on conflict … do update … where`, so two
 * simultaneous rewrites cannot both pass an under-limit read. There is still
 * no post-purchase refund primitive anywhere in this product, which is why no
 * path is allowed to consume before it has checked.
 *
 * ⚠ HER TEXT IS NEVER STORED, here either — not the input, not the rewrite.
 * The rewrite is returned to her and forgotten.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  brandKitId: z.string().uuid(),
  text: z.string().trim().min(CHECK_MIN_CHARS).max(CHECK_MAX_CHARS),
});

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("Paste the text you want rewritten.");

  const { supabase, userId } = auth.session;
  const { brandKitId, text } = parsed.data;

  const kit = await loadBrandKit(supabase, brandKitId, userId);
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    return NextResponse.json(
      {
        error: lockedMessage(reversed),
        checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
      },
      { status: 402 }
    );
  }

  /*
   * The bound, atomically, before the model call. A refusal here is 429 and
   * not 402: nothing is for sale that would lift it, and offering a checkout
   * for something a night's sleep fixes would be a lie.
   */
  const allowance = await consumeCheckRewrite(supabase);
  if (!allowance.ok) {
    if (allowance.reason === "rpc_error") {
      return serverError("POST /api/check/rewrite", new Error("consume_check_rewrite failed"));
    }
    return NextResponse.json(
      {
        error: `You have used today's ${allowance.limit} rewrites. The scan itself is unlimited, and rewrites come back tomorrow.`,
        retryAfterSeconds: allowance.retryAfterSeconds,
      },
      { status: 429, headers: { "retry-after": String(allowance.retryAfterSeconds) } }
    );
  }

  try {
    const catalog = await readCatalog(supabase).catch(() => null);
    const outcome = await rewriteAndRescan(text, catalog?.ethicsRules ?? []);

    track("check_rewritten", {
      attempts: outcome.attempts,
      resolved: outcome.resolved,
      rules: outcome.before.map((finding) => finding.ruleId).join(","),
    });

    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof AnthropicNotConfiguredError) {
      return NextResponse.json(
        { error: "Rewrites are unavailable right now. Your own text is untouched." },
        { status: 503 }
      );
    }
    return serverError("POST /api/check/rewrite", error);
  }
}
