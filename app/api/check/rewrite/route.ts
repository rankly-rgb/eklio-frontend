import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, badRequest, notFound, readJson, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readCatalog } from "@/lib/catalog/read";
import { CHECK_MAX_CHARS, CHECK_MIN_CHARS } from "@/lib/check/review";
import { rewriteAndRescan } from "@/lib/check/rewrite";
import { AnthropicNotConfiguredError } from "@/lib/ai/client";
import { track } from "@/lib/analytics";

/*
 * POST /api/check/rewrite — ask the model to fix what the scan found.
 *
 * ── THE MONEY, IN ORDER ─────────────────────────────────────────────────
 *
 * 1. Availability is checked BEFORE the call, advisorily, through
 *    `brand_kit_has_generation_credit`. Refusing after spending would be the
 *    worst of both.
 * 2. The credit is consumed AFTER, and only when the rewrite actually
 *    RESOLVED what it was asked to fix. A rewrite that still trips the rule is
 *    the model failing at the one job it was given; Eklio eats that call. She
 *    is not charged for being handed back the same problem in new words.
 * 3. There is no refund primitive after delivery (`release_generation_credit`
 *    only works pre-delivery), which is why the order is check-then-consume
 *    rather than consume-then-refund.
 *
 * The known, bounded race: two rewrites started at once can both pass the
 * advisory check and both consume. It costs at most one extra credit, never
 * money, and it is recorded in FINDINGS.md rather than papered over.
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

  // 1. Advisory, before the call.
  const { data: hasCredit, error: creditError } = await supabase.rpc(
    "brand_kit_has_generation_credit",
    { p_brand_kit_id: brandKitId }
  );
  if (creditError) return serverError("POST /api/check/rewrite", creditError);

  if (hasCredit === false) {
    return NextResponse.json(
      {
        error: "Your rewrites are used up for this plan.",
        checkoutUrl: `/app/checkout?project=${kit.projectId}`,
      },
      { status: 402 }
    );
  }

  try {
    const catalog = await readCatalog(supabase).catch(() => null);
    const outcome = await rewriteAndRescan(text, catalog?.ethicsRules ?? []);

    // 2. Consume only on a rewrite that did the job, and only when a model
    //    call was actually made.
    if (outcome.attempts > 0 && outcome.resolved && !outcome.unchanged) {
      const { error: spendError } = await supabase.rpc("consume_generation_credit", {
        p_brand_kit_id: brandKitId,
      });
      if (spendError) console.error("[check] consume_generation_credit", spendError);
    }

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
