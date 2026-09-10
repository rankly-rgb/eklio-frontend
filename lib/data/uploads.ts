import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { UPLOAD_MIME_TYPES } from "@/lib/uploads/sniff";

/*
 * The files she brought herself.
 *
 * ⚠ NONE OF THESE ROWS CARRY A FINGERPRINT, and nothing in this file computes
 * one. Her portrait is not derived from her palette, so a colour change must
 * not mark it stale, queue it for a rebuild, or delete it. The table has no
 * column that would allow it and a migration guard rail keeps it that way;
 * this comment is the frontend half of the same rule.
 */

type Client = SupabaseClient<Database>;

export const UPLOAD_KINDS = ["portrait", "logo", "photo", "document"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const uploadSchema = z.object({
  id: z.string(),
  kind: z.enum(UPLOAD_KINDS),
  storage_path: z.string(),
  mime_type: z.enum(UPLOAD_MIME_TYPES),
  byte_size: z.number().int(),
  original_name: z.string().nullable(),
  created_at: z.string(),
});
export type UserUpload = z.infer<typeof uploadSchema>;

export const uploadListSchema = z.object({
  files: z.array(uploadSchema),
  quota: z.object({
    files: z.number().int(),
    max_files: z.number().int(),
    bytes: z.number().int(),
    max_bytes: z.number().int(),
    max_file_bytes: z.number().int(),
  }),
});
export type UploadList = z.infer<typeof uploadListSchema>;

const rpcErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type UploadResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  payment_required: 402,
  empty_file: 400,
  file_too_large: 413,
  too_many_files: 409,
  kit_quota_exceeded: 409,
  unsupported_type: 415,
};

function decode<T>(
  context: string,
  schema: z.ZodType<T>,
  data: unknown,
  error: { message: string } | null
): UploadResult<T> {
  if (error) {
    console.error(`[uploads] ${context}`, error);
    return { ok: false, code: "server_error", message: "Something went wrong.", status: 500 };
  }

  const asError = rpcErrorSchema.safeParse(data);
  if (asError.success) {
    return {
      ok: false,
      code: asError.data.error.code,
      message: asError.data.error.message,
      status: STATUS_BY_CODE[asError.data.error.code] ?? 500,
    };
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[uploads] ${context} shape`, parsed.error.issues);
    return { ok: false, code: "server_error", message: "Something went wrong.", status: 500 };
  }
  return { ok: true, data: parsed.data };
}

export async function listUserUploads(
  supabase: Client,
  brandKitId: string
): Promise<UploadResult<UploadList>> {
  const { data, error } = await supabase.rpc("list_user_uploads", {
    p_brand_kit_id: brandKitId,
  });
  return decode("list_user_uploads", uploadListSchema, data, error);
}

export async function requestUserUpload(
  supabase: Client,
  brandKitId: string,
  kind: UploadKind,
  mimeType: string,
  byteSize: number
): Promise<UploadResult<{ id: string; path: string }>> {
  const { data, error } = await supabase.rpc("request_user_upload", {
    p_brand_kit_id: brandKitId,
    p_kind: kind,
    p_mime_type: mimeType,
    p_byte_size: byteSize,
  });
  return decode(
    "request_user_upload",
    z.object({ id: z.string(), path: z.string() }),
    data,
    error
  );
}

export async function recordUserUpload(
  supabase: Client,
  input: {
    brandKitId: string;
    id: string;
    kind: UploadKind;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    originalName: string | null;
  }
): Promise<UploadResult<{ id: string; replaced_path: string | null }>> {
  const { data, error } = await supabase.rpc("record_user_upload", {
    p_brand_kit_id: input.brandKitId,
    p_id: input.id,
    p_kind: input.kind,
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType,
    p_byte_size: input.byteSize,
    p_original_name: input.originalName ?? undefined,
  });
  return decode(
    "record_user_upload",
    z.object({ id: z.string(), replaced_path: z.string().nullable() }),
    data,
    error
  );
}

export async function deleteUserUpload(
  supabase: Client,
  id: string
): Promise<UploadResult<{ deleted: boolean; path: string }>> {
  const { data, error } = await supabase.rpc("delete_user_upload", { p_id: id });
  return decode(
    "delete_user_upload",
    z.object({ deleted: z.boolean(), path: z.string() }),
    data,
    error
  );
}

export const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  portrait: "Your portrait",
  logo: "A logo you already had",
  photo: "A photograph",
  document: "A document",
};

/** `1048576` → `1.0 MB`. Measured bytes, never an estimate. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
