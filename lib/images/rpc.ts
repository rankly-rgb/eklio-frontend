import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ImageSlot } from "@/lib/images/config";

/*
 * The brand_images RPCs. Correctness and shape only — the security boundary
 * is `brand_kit_entitled()` inside each function plus the storage.objects RLS
 * policies, exactly as for `lib/kit/asset-rpc.ts`. The client used here is
 * always the caller's own session client; a service_role connection would
 * make every one of these answer `payment_required`, because `auth.uid()`
 * would be NULL.
 */

type Client = SupabaseClient<Database>;

export type ClaimReason =
  | "claimed"
  | "reclaimed"
  | "already_ready"
  | "already_moderated"
  | "busy"
  | "budget_exceeded"
  | "disabled"
  | "payment_required"
  | "invalid_field";

export type ClaimResult = {
  claimed: boolean;
  reason: ClaimReason;
  image_id: string | null;
  claim_token: string | null;
};

export type ImageStatus = "pending" | "claimed" | "ready" | "failed" | "moderated" | "refused_cap";

export type BrandImage = {
  slot: ImageSlot;
  status: ImageStatus;
  failure_reason: string;
  storage_path: string | null;
  byte_size: number | null;
  cost_cents: number | null;
  created_at: string;
  updated_at: string;
  /** Only `ready` AND at the current fingerprint. Anything else is the gradient. */
  current: boolean;
};

export async function claimBrandImage(
  supabase: Client,
  brandKitId: string,
  slot: ImageSlot,
  imageFingerprint: string,
  costEstimateCents: number,
  dailyCapCents: number
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("brand_images_claim", {
    p_brand_kit_id: brandKitId,
    p_slot: slot,
    p_image_fingerprint: imageFingerprint,
    p_cost_estimate_cents: costEstimateCents,
    p_daily_cap_cents: dailyCapCents,
  } as never);

  if (error) {
    console.error("[images] brand_images_claim", error);
    return { claimed: false, reason: "invalid_field", image_id: null, claim_token: null };
  }
  return data as unknown as ClaimResult;
}

export async function markBrandImageReady(
  supabase: Client,
  imageId: string,
  claimToken: string,
  storagePath: string,
  byteSize: number,
  costCents: number,
  model: string,
  quality: string,
  size: string
): Promise<{ ok: boolean; reason: string }> {
  const { data, error } = await supabase.rpc("brand_images_mark_ready", {
    p_image_id: imageId,
    p_claim_token: claimToken,
    p_storage_path: storagePath,
    p_byte_size: byteSize,
    p_cost_cents: costCents,
    p_model: model,
    p_quality: quality,
    p_size: size,
  } as never);

  if (error) {
    console.error("[images] brand_images_mark_ready", error);
    return { ok: false, reason: "rpc_error" };
  }
  return data as unknown as { ok: boolean; reason: string };
}

export async function markBrandImageFailed(
  supabase: Client,
  imageId: string,
  claimToken: string,
  status: "failed" | "moderated",
  failureReason: string
): Promise<{ ok: boolean; reason: string }> {
  const { data, error } = await supabase.rpc("brand_images_mark_failed", {
    p_image_id: imageId,
    p_claim_token: claimToken,
    p_status: status,
    // Never empty: the RPC refuses an unexplained failure, and it is right to.
    p_failure_reason: failureReason || "unknown failure",
  } as never);

  if (error) {
    console.error("[images] brand_images_mark_failed", error);
    return { ok: false, reason: "rpc_error" };
  }
  return data as unknown as { ok: boolean; reason: string };
}

export async function getBrandImages(
  supabase: Client,
  brandKitId: string,
  imageFingerprint: string
): Promise<BrandImage[]> {
  const { data, error } = await supabase.rpc("get_brand_images", {
    p_brand_kit_id: brandKitId,
    p_image_fingerprint: imageFingerprint,
  } as never);

  if (error) {
    console.error("[images] get_brand_images", error);
    return [];
  }
  if (data && typeof data === "object" && "error" in (data as object)) return [];
  return (data ?? []) as unknown as BrandImage[];
}

export async function brandImagesPath(
  supabase: Client,
  brandKitId: string,
  imageFingerprint: string,
  slot: ImageSlot
): Promise<string | null> {
  const { data, error } = await supabase.rpc("brand_images_path", {
    p_brand_kit_id: brandKitId,
    p_image_fingerprint: imageFingerprint,
    p_slot: slot,
  } as never);
  if (error) {
    console.error("[images] brand_images_path", error);
    return null;
  }
  return (data as unknown as string) ?? null;
}

/** Advisory only. `consume_generation_credit` is what actually spends one. */
export async function hasGenerationCredit(supabase: Client, brandKitId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("brand_kit_has_generation_credit", {
    p_brand_kit_id: brandKitId,
  } as never);
  if (error) {
    console.error("[images] brand_kit_has_generation_credit", error);
    return false;
  }
  return data === true;
}

export async function consumeGenerationCredit(supabase: Client, brandKitId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_generation_credit", {
    p_brand_kit_id: brandKitId,
  } as never);
  if (error) {
    console.error("[images] consume_generation_credit", error);
    return false;
  }
  return data === true;
}
