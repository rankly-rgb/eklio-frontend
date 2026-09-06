import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  DAILY_CAP_CENTS,
  IMAGE_CONTENT_TYPE,
  IMAGE_MODEL,
  IMAGE_SLOTS,
  MAX_ATTEMPTS,
  priceCents,
  type ImageQuality,
  type ImageSlot,
} from "@/lib/images/config";
import {
  ImageModerationError,
  ImageNotConfiguredError,
  ImageTransientError,
  type ImageModelClient,
} from "@/lib/images/client";
import { computeImageFingerprint, type ImageFingerprintInput } from "@/lib/images/fingerprint";
import { buildImagePrompt } from "@/lib/images/prompt";
import {
  brandImagesPath,
  claimBrandImage,
  markBrandImageFailed,
  markBrandImageReady,
  reserveImageRegeneration,
  settleImageRegeneration,
} from "@/lib/images/rpc";
import { variationClause, type ImageVariation } from "@/lib/images/variations";

/*
 * ── ONE SLOT, END TO END ────────────────────────────────────────────────
 *
 *   fingerprint → claim → prompt → model (one retry, transient only) →
 *   upload with the caller's own session → mark_ready → signed URL
 *
 * The model client is injected, so every step above is exercised by tests
 * against a stub and spends nothing. There is no branch here that only the
 * real API can reach.
 *
 * MONEY. `cost_cents` comes from the price table in config.ts, never from the
 * response's `usage` block. The daily ceiling is reserved at claim time and
 * reconciled at settle time by the database, which clamps whatever this file
 * asks for against its own bound.
 *
 * BUDGET. The initial seven are part of what she bought and draw on nothing.
 * A REGENERATION draws on `plans.image_budget_cents` — never on
 * `consume_generation_credit`, whose meter is the DIRECTIONS ladder and has
 * nothing to do with pixels. The reservation is booked BEFORE the model call
 * and released on failure, so she is never charged for a photograph she did
 * not receive, and two concurrent regenerations cannot both pass an
 * under-budget check.
 */

type Client = SupabaseClient<Database>;

export type GenerateOutcome =
  | {
      ok: true;
      slot: ImageSlot;
      imageFingerprint: string;
      storagePath: string;
      byteSize: number;
      costCents: number;
      prompt: string;
      /** Recorded for the operator; never used to compute money. */
      usage: unknown;
    }
  | {
      ok: false;
      slot: ImageSlot;
      reason:
        | "disabled"
        | "slot_disabled"
        | "payment_required"
        | "no_credit"
        | "busy"
        | "budget_exceeded"
        | "already_ready"
        | "already_moderated"
        | "moderated"
        | "not_configured"
        | "failed"
        | "upload_failed"
        | "stale_claim";
      message: string;
    };

export type GenerateInput = {
  supabase: Client;
  client: ImageModelClient;
  brandKitId: string;
  slot: ImageSlot;
  fingerprintInput: ImageFingerprintInput;
  /** Passed to the model as `user`. Her Eklio id, never her email. */
  userId: string;
  /** True only when she asked for a NEW image of a slot she already has. */
  isRegeneration: boolean;
  /**
   * Which of the four bounded nudges she picked. Null on a first generation.
   * There is no free-text alternative, here or anywhere in the paid space.
   */
  variation?: ImageVariation | null;
  /**
   * Renders at a quality other than the slot's configured one. FOR ITERATING
   * ON ART DIRECTION ONLY: judging exposure, light direction and colour
   * placement does not need `high`, and 1536x1024 at `medium` is 6.3c against
   * 25c. Three medium tries cost less than one high one.
   *
   * The route never passes this — only `scripts/brand-image/generate-one.ts`
   * does, from `--quality`. The reserved and recorded cost follow the
   * EFFECTIVE quality, so a cheap try books a cheap reservation and records a
   * cheap `cost_cents`; a ceiling fed the wrong price is not a ceiling.
   */
  qualityOverride?: ImageQuality;
};

type Classified = {
  status: "failed" | "moderated";
  reason: "moderated" | "not_configured" | "failed";
  message: string;
};

/**
 * The one distinction that matters: a refused PROMPT is terminal, everything
 * else is a failure a later call may retry. A missing or rejected key is
 * neither her fault nor a prompt defect, so it is recorded as a plain failure
 * with a reason an operator can read.
 */
function classify(err: unknown): Classified {
  if (err instanceof ImageModerationError) {
    return { status: "moderated", reason: "moderated", message: err.message };
  }
  if (err instanceof ImageNotConfiguredError) {
    return { status: "failed", reason: "not_configured", message: err.message };
  }
  return { status: "failed", reason: "failed", message: (err as Error)?.message ?? "unknown failure" };
}

export async function generateBrandImage(input: GenerateInput): Promise<GenerateOutcome> {
  const { supabase, client, brandKitId, slot, fingerprintInput, userId, isRegeneration } = input;
  const config = IMAGE_SLOTS[slot];
  const quality = input.qualityOverride ?? config.quality;

  // A slot that is off cannot be claimed, so it cannot be spent on by
  // accident. Six of the seven are off in this session, deliberately.
  if (!config.enabled) {
    return { ok: false, slot, reason: "slot_disabled", message: `The ${slot} slot is not enabled.` };
  }

  const imageFingerprint = computeImageFingerprint(fingerprintInput);
  // Priced on the EFFECTIVE quality, never on the configured one.
  const costCents = priceCents(IMAGE_MODEL, quality, config.size);

  // Reserved BEFORE the call, and released below on any failure.
  if (isRegeneration) {
    const reserved = await reserveImageRegeneration(supabase, brandKitId, costCents);
    if (!reserved.ok) {
      return {
        ok: false,
        slot,
        reason: "no_credit",
        message:
          reserved.reason === "budget_exhausted"
            ? "You have used the photograph budget included with this kit."
            : "That regeneration could not be started.",
      };
    }
  }

  /** Releases a regeneration reservation on any path that does not deliver an image. */
  const release = async (): Promise<void> => {
    if (isRegeneration) await settleImageRegeneration(supabase, brandKitId, costCents, false);
  };

  const claim = await claimBrandImage(
    supabase,
    brandKitId,
    slot,
    imageFingerprint,
    costCents,
    DAILY_CAP_CENTS
  );

  if (!claim.claimed || !claim.image_id || !claim.claim_token) {
    await release();
    // A refusal that reports "claimed" or "reclaimed" without an id or token
    // is a contradiction, and `invalid_field` is our bug rather than a state
    // she can be in. Both are reported as a plain failure rather than leaking
    // a schema word into the product.
    const reason =
      claim.reason === "invalid_field" || claim.reason === "claimed" || claim.reason === "reclaimed"
        ? "failed"
        : claim.reason;
    return { ok: false, slot, reason, message: refusalMessage(claim.reason) };
  }

  const imageId = claim.image_id;
  const claimToken = claim.claim_token;
  const prompt = buildImagePrompt(slot, fingerprintInput, variationClause(input.variation ?? null));

  // One retry, transient only. Never a loop: MAX_ATTEMPTS is 2 and the loop
  // breaks on anything that is not transient.
  let generated: Awaited<ReturnType<ImageModelClient["generate"]>> | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      generated = await client.generate({
        prompt,
        size: config.size,
        quality,
        user: userId,
      });
      break;
    } catch (err) {
      lastError = err;
      if (!(err instanceof ImageTransientError)) break;
    }
  }

  if (!generated) {
    const { status, reason, message } = classify(lastError);
    await markBrandImageFailed(supabase, imageId, claimToken, status, message);
    await release();
    return { ok: false, slot, reason, message };
  }

  const storagePath = await brandImagesPath(supabase, brandKitId, imageFingerprint, slot);
  if (!storagePath) {
    await markBrandImageFailed(supabase, imageId, claimToken, "failed", "could not resolve a storage path");
    await release();
    return { ok: false, slot, reason: "failed", message: "Could not resolve a storage path." };
  }

  // The caller's own session. The storage.objects policies are what authorize
  // this — owned AND entitled — not this function.
  const upload = await supabase.storage.from("brand-assets").upload(storagePath, generated.bytes, {
    contentType: IMAGE_CONTENT_TYPE,
    upsert: true,
  });
  if (upload.error) {
    await markBrandImageFailed(supabase, imageId, claimToken, "failed", `upload failed: ${upload.error.message}`);
    await release();
    return { ok: false, slot, reason: "upload_failed", message: upload.error.message };
  }

  const settled = await markBrandImageReady(
    supabase,
    imageId,
    claimToken,
    storagePath,
    generated.bytes.byteLength,
    costCents,
    IMAGE_MODEL,
    quality,
    config.size
  );
  if (!settled.ok) {
    // A reclaim beat us. The winner's row stands; ours is not an error to her.
    await release();
    return { ok: false, slot, reason: "stale_claim", message: "Another run finished this image first." };
  }

  // Only now, and only for a regeneration: the image exists, so the
  // reservation becomes real spend.
  if (isRegeneration) {
    await settleImageRegeneration(supabase, brandKitId, costCents, true);
  }

  return {
    ok: true,
    slot,
    imageFingerprint,
    storagePath,
    byteSize: generated.bytes.byteLength,
    costCents,
    prompt,
    usage: generated.usage,
  };
}

function refusalMessage(reason: string): string {
  switch (reason) {
    case "disabled":
      return "Image generation is turned off right now.";
    case "payment_required":
      return "This brand kit is not yet paid for.";
    case "busy":
      return "This image is already being made.";
    case "budget_exceeded":
      return "Today's image budget is used up. This will be available again tomorrow.";
    case "already_ready":
      return "This image is already current.";
    case "already_moderated":
      return "This image could not be made from the current brand. Changing a color or a direction will let it try again.";
    default:
      return "That image could not be started.";
  }
}
