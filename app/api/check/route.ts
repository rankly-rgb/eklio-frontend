import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, badRequest, notFound, readJson, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readCatalog } from "@/lib/catalog/read";
import { CHECK_MAX_CHARS, CHECK_MIN_CHARS, reviewText } from "@/lib/check/review";
import { track } from "@/lib/analytics";

/*
 * POST /api/check — scan text she wrote against the six advertising rules.
 *
 * Deterministic, free, and it calls no model: this is six regular expressions
 * over her words. Nothing here consumes a credit, and the sibling route that
 * does is a separate POST for exactly that reason.
 *
 * ⚠ HER TEXT IS NEVER STORED. It is read from the request, scanned in memory,
 * and answered. It is not written to a table, not logged, and not put in an
 * analytics property — what is tracked is which rule ids fired, six fixed
 * strings, and how many.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  brandKitId: z.string().uuid(),
  text: z.string().trim().min(CHECK_MIN_CHARS).max(CHECK_MAX_CHARS),
});

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return badRequest(
      `Paste between ${CHECK_MIN_CHARS} and ${CHECK_MAX_CHARS.toLocaleString("en-US")} characters.`
    );
  }

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

  try {
    const catalog = await readCatalog(supabase).catch(() => null);
    const review = reviewText(text, catalog?.ethicsRules ?? []);

    // Rule ids only. Never the text, never an excerpt.
    track("check_scanned", {
      findings: review.findings.length,
      rules: review.findings.map((finding) => finding.ruleId).join(","),
    });

    return NextResponse.json(review);
  } catch (error) {
    return serverError("POST /api/check", error);
  }
}
