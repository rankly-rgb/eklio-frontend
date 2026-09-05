import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  DAILY_CAP_CENTS,
  IMAGE_CONTENT_TYPE,
  IMAGE_MODEL,
  IMAGE_SLOTS,
  MAX_ATTEMPTS,
  slotPriceCents,
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
  consumeGenerationCredit,
  hasGenerationCredit,
  markBrandImageFailed,
  markBrandImageReady,
} from "@/lib/images/rpc";

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
 * CREDITS. The initial seven are part of what she bought and consume nothing.
 * A regeneration consumes one, and the brief asks for it to be "checked
 * before the call and not charged on failure". There is no post-purchase
 * refund primitive (release_generation_credit only works while
 * brand_kits.directions is still null), so those two clauses are met as:
 * an advisory check BEFORE any money is spent, and the atomic consume only
 * AFTER the image is recorded. The window between them is real — two
 * concurrent regenerations could both pass the advisory check — and it is
 * bounded by the per-slot claim lock and the daily ceiling.
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

  // A slot that is off cannot be claimed, so it cannot be spent on by
  // accident. Six of the seven are off in this session, deliberately.
  if (!config.enabled) {
    return { ok: false, slot, reason: "slot_disabled", message: `The ${slot} slot is not enabled.` };
  }

  // Checked BEFORE the call, per the brief — nothing has cost anything yet.
  if (isRegeneration && !(await hasGenerationCredit(supabase, brandKitId))) {
    return {
      ok: false,
      slot,
      reason: "no_credit",
      message: "You have used every regeneration included with this kit.",
    };
  }

  const imageFingerprint = computeImageFingerprint(fingerprintInput);
  const costCents = slotPriceCents(slot);

  const claim = await claimBrandImage(
    supabase,
    brandKitId,
    slot,
    imageFingerprint,
    costCents,
    DAILY_CAP_CENTS
  );

  if (!claim.claimed || !claim.image_id || !claim.claim_token) {
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
  const prompt = buildImagePrompt(slot, fingerprintInput);

  // One retry, transient only. Never a loop: MAX_ATTEMPTS is 2 and the loop
  // breaks on anything that is not transient.
  let generated: Awaited<ReturnType<ImageModelClient["generate"]>> | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      generated = await client.generate({
        prompt,
        size: config.size,
        quality: config.quality,
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
    return { ok: false, slot, reason, message };
  }

  const storagePath = await brandImagesPath(supabase, brandKitId, imageFingerprint, slot);
  if (!storagePath) {
    await markBrandImageFailed(supabase, imageId, claimToken, "failed", "could not resolve a storage path");
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
    config.quality,
    config.size
  );
  if (!settled.ok) {
    // A reclaim beat us. The winner's row stands; ours is not an error to her.
    return { ok: false, slot, reason: "stale_claim", message: "Another run finished this image first." };
  }

  // Only now, and only for a regeneration: the image exists, so the credit is
  // for something she actually received.
  if (isRegeneration) {
    await consumeGenerationCredit(supabase, brandKitId);
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
