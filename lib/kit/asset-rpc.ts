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
  fn:
    | "get_brand_asset_manifest"
    | "request_brand_asset_upload"
    | "record_brand_asset"
    | "record_asset_download"
    | "get_brand_asset_versions"
    | "get_brand_asset_version_path"
    | "get_brand_asset_previous_inputs",
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
  /**
   * Pixel widths this asset can be re-rasterized to on demand, and the
   * formats it can be delivered in — both empty for a key whose pixels have
   * no vector source this repo can rebuild. The catalogue is the authority
   * (`lib/kit/render/variants.ts` is seeded to match it, not the reverse),
   * so a menu built from these two arrays can never offer a file the
   * renderer cannot make.
   */
  available_sizes: number[];
  available_formats: string[];
  current: boolean;
  asset: {
    storage_path: string;
    byte_size: number;
    created_at: string;
    download_count: number;
  } | null;
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

/**
 * A rendition of one catalogue key: `{ size: 0, format: "" }` is the native
 * one every caller before this lot asked for implicitly. Both RPCs below
 * validate the pair against the catalogue's own arrays and refuse anything
 * unlisted — the guard lives there, next to the paid check, not in a client
 * that can be edited.
 */
export type AssetRendition = { size: number; format: string };

export const NATIVE_RENDITION: AssetRendition = { size: 0, format: "" };

export function requestBrandAssetUpload(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string,
  rendition: AssetRendition = NATIVE_RENDITION
): Promise<AssetRpcResult<{ bucket: string; storage_path: string; size: number; format: string }>> {
  return call(supabase, "request_brand_asset_upload", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
    p_size: rendition.size,
    p_format: rendition.format,
  });
}

/** Returns the new count, or `null` on any refusal (not entitled, no matching row) -- never throws, never touches consume_generation_credit. */
export function recordAssetDownload(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string,
  rendition: AssetRendition = NATIVE_RENDITION
): Promise<AssetRpcResult<number | null>> {
  return call(supabase, "record_asset_download", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
    p_size: rendition.size,
    p_format: rendition.format,
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
  height?: number,
  rendition: AssetRendition = NATIVE_RENDITION,
  version?: AssetVersionRecord
): Promise<AssetRpcResult<{ id: string; storage_path: string }>> {
  return call(supabase, "record_brand_asset", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
    p_storage_path: storagePath,
    p_byte_size: byteSize,
    p_width: width ?? null,
    p_height: height ?? null,
    p_size: rendition.size,
    p_format: rendition.format,
    p_change_summary: version?.changeSummary ?? "",
    p_fingerprint_inputs: version?.fingerprintInputs ?? {},
  });
}

/*
 * ── VERSION HISTORY ─────────────────────────────────────────────────────
 *
 * `brand_assets` has always kept every version — a rebuild adds a row under
 * a new fingerprint rather than overwriting. These three read and write the
 * part that was missing: which version is hers today, and what changed to
 * produce each one.
 *
 * Recording the version's inputs is NOT computing the fingerprint.
 * `computeAssetFingerprint` (lib/kit/asset-fingerprint.ts) stays the single
 * definition of that hash; `fingerprintInputs` is the same object it was
 * handed, kept so the next rebuild has something to diff against.
 */
export type AssetVersionRecord = {
  /** One sentence, from `describeAssetChange`. Empty for a first version. */
  changeSummary: string;
  /** Exactly what `computeAssetFingerprint` was handed — never a reconstruction. */
  fingerprintInputs: unknown;
};

export type AssetVersion = {
  fingerprint: string;
  created_at: string;
  superseded_at: string | null;
  change_summary: string;
  byte_size: number;
  download_count: number;
  current: boolean;
};

export function getBrandAssetVersions(
  supabase: Client,
  brandKitId: string,
  key: string
): Promise<AssetRpcResult<AssetVersion[]>> {
  return call(supabase, "get_brand_asset_versions", {
    p_brand_kit_id: brandKitId,
    p_key: key,
  });
}

/** Where an older version's bytes live. Never re-renders: the inputs behind it are gone. */
export function getBrandAssetVersionPath(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string
): Promise<AssetRpcResult<{ storage_path: string }>> {
  return call(supabase, "get_brand_asset_version_path", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
  });
}

/** The inputs behind the version a rebuild is about to replace — `{}` when there is none. */
export function getBrandAssetPreviousInputs(
  supabase: Client,
  brandKitId: string,
  key: string,
  fingerprint: string
): Promise<AssetRpcResult<{ inputs: Record<string, unknown> }>> {
  return call(supabase, "get_brand_asset_previous_inputs", {
    p_brand_kit_id: brandKitId,
    p_key: key,
    p_fingerprint: fingerprint,
  });
}
