import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { isImageSlot } from "@/lib/images/config";
import { loadImageContext } from "@/lib/images/context";
import { generateBrandImage } from "@/lib/images/generate";
import { ImageNotConfiguredError, openAiImageClientFromEnv } from "@/lib/images/client";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/images/[slot] — make one generated photograph, or
 * say plainly why not.
 *
 * `runtime = "nodejs"` is load-bearing, not decorative: this route holds
 * OPENAI_API_KEY and handles image bytes. The key is read from the
 * environment inside `openAiImageClientFromEnv()`, is never returned, never
 * logged, and never reaches an error message — a missing key surfaces as
 * "not configured", which is a state, not a value.
 *
 * `maxDuration` is generous because a high-quality 1536x1024 generation is a
 * real wait, and because a timeout here abandons a claim that costs money to
 * abandon: the claim is reclaimable after ten minutes, but only after.
 *
 * NO service_role. The claim, the upload and the settle all run as the
 * therapist's own session, so `brand_kit_entitled()` and the storage.objects
 * policies are what authorize them.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

const SIGNED_URL_TTL_SECONDS = 300;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/images/[slot]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id, slot } = await ctx.params;
  if (!isImageSlot(slot)) return notFound();

  const { supabase, userId } = auth.session;

  const kit = await loadBrandKit(supabase, id, userId);
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    return NextResponse.json(
      {
        error: lockedMessage(reversed),
        checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
      },
      { status: 402 }
    );
  }

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) {
    if (context.reason === "no-direction") return notFound();
    return NextResponse.json(
      { error: "Your brand is still being set up. Try again in a moment." },
      { status: 409 }
    );
  }

  /*
   * The initial seven are part of what she bought. A regeneration is the one
   * that costs a credit — and "regeneration" means she already HAS this exact
   * image and asked for a different one, not that the fingerprint moved. A
   * moved fingerprint is a new photograph of a changed brand, which the daily
   * ceiling bounds rather than her allowance.
   */
  const fingerprint = computeImageFingerprint(context.input);
  const existing = await getBrandImages(supabase, id, fingerprint);
  const isRegeneration = existing.some((row) => row.slot === slot && row.current);

  let client;
  try {
    client = openAiImageClientFromEnv();
  } catch (err) {
    if (err instanceof ImageNotConfiguredError) {
      // Never the key, never part of it: only the fact that there isn't one.
      return NextResponse.json(
        { error: "Photography is not configured on this server yet." },
        { status: 503 }
      );
    }
    return serverError("images:client", err);
  }

  const outcome = await generateBrandImage({
    supabase,
    client,
    brandKitId: id,
    slot,
    fingerprintInput: context.input,
    userId,
    isRegeneration,
  });

  if (!outcome.ok) {
    track("brand_image_refused", { slot, reason: outcome.reason });
    const status =
      outcome.reason === "no_credit" || outcome.reason === "payment_required"
        ? 402
        : outcome.reason === "budget_exceeded" || outcome.reason === "disabled"
          ? 503
          : outcome.reason === "busy"
            ? 409
            : outcome.reason === "already_ready"
              ? 200
              : 502;
    return NextResponse.json({ error: outcome.message, reason: outcome.reason }, { status });
  }

  const signed = await supabase.storage
    .from("brand-assets")
    .createSignedUrl(outcome.storagePath, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data) {
    return serverError("images:sign", signed.error);
  }

  track("brand_image_generated", {
    slot,
    cost_cents: outcome.costCents,
    byte_size: outcome.byteSize,
  });

  return NextResponse.json({
    url: signed.data.signedUrl,
    slot,
    // The prompt is derived, never typed, so showing it back is safe and is
    // how an operator checks what was actually asked for.
    costCents: outcome.costCents,
    byteSize: outcome.byteSize,
  });
}
