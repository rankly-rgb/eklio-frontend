import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * The brand asset RPCs (Lot 4.1–4.3): correctness and path construction,
 * never the security boundary — see FRONTEND_CONTRACT.md §10 (eklio-backend).
 * The real boundary is RLS on `storage.objects`, so the client used here
 * must always be the caller's own session client (`lib/supabase/server.ts`),
 * exactly like `lib/site/rpc.ts` — a `service_role` connection would make
 * every one of these calls answer `payment_required` (`auth.uid()` is NULL),
 * which is a failure, not a security hole.
 */

type Client = SupabaseClient<Database>;

export type AssetRpcErrorBody = { code: string; message: string; field?: string };
export type AssetRpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AssetRpcErrorBody };

function isRpcError(value: unknown): value is { error: AssetRpcErrorBody } {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

async function call<T>(
  supabase: Client,
  fn: "get_brand_asset_manifest" | "request_brand_asset_upload" | "record_brand_asset",
  args: Record<string, unknown>
): Promise<AssetRpcResult<T>> {
  const { data, error } = await supabase.rpc(fn, args as never);

  if (error) {
    console.error(`[kit/assets] ${fn}`, error);
    return {
      ok: false,
      error: { code: "not_found", message: "Something didn't go through on our side." },
    };
  }

  if (isRpcError(data)) {
    return { ok: false, error: data.error };
  }

  return { ok: true, data: data as T };
}

export type AssetManifestEntry = {
  key: string;
  group: string;
  label: string;
  description: string;
  kind: "svg" | "png" | "json" | "css" | "ase" | "html" | "zip" | "md";
  width: number | null;
  height: number | null;
  min_tier: string;
  current: boolean;
  asset: { storage_path: string; byte_size: number; created_at: string } | null;
};

export function getBrandAssetManifest(
  supabase: Client,
  brandKitId: string,
  currentFingerprint: string
): Promise<AssetRpcResult<AssetManifestEntry[]>> {
  return call(supabase, "get_brand_asset_manifest", {
    p_brand_kit_id: brandKitId,
    p_current_fingerprint: currentFingerprint,
  });
}

export function requestBrandAssetUpload(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string
): Promise<AssetRpcResult<{ bucket: string; storage_path: string }>> {
  return call(supabase, "request_brand_asset_upload", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
  });
}

export function recordBrandAsset(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string,
  storagePath: string,
  byteSize: number,
  width?: number,
  height?: number
): Promise<AssetRpcResult<{ id: string; storage_path: string }>> {
  return call(supabase, "record_brand_asset", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
    p_storage_path: storagePath,
    p_byte_size: byteSize,
    p_width: width ?? null,
    p_height: height ?? null,
  });
}
