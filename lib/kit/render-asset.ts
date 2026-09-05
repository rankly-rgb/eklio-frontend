import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AssetContext } from "@/lib/kit/asset-context";
import { getRenderer } from "@/lib/kit/render/registry";
import { requestBrandAssetUpload, recordBrandAsset, type AssetManifestEntry } from "@/lib/kit/asset-rpc";
import { siteOutputGet } from "@/lib/site/rpc";

type Client = SupabaseClient<Database>;

export type EnsureAssetResult =
  | { ok: true; storagePath: string; byteSize: number }
  | { ok: false; error: string };

/**
 * Render-if-needed, factored out of the per-key download route so the
 * batch zip route (Lot 4's "Download selected") can guarantee every
 * requested key is current before bundling, without a second copy of the
 * render → upload → record sequence.
 */
export async function ensureAssetRendered(
  supabase: Client,
  brandKitId: string,
  key: string,
  entry: AssetManifestEntry,
  assetContext: Extract<AssetContext, { ok: true }>
): Promise<EnsureAssetResult> {
  if (entry.current && entry.asset) {
    return { ok: true, storagePath: entry.asset.storage_path, byteSize: entry.asset.byte_size };
  }

  const renderer = getRenderer(key);
  if (!renderer) return { ok: false, error: "No such asset." };

  let siteSetupMd: string | null = null;
  if (key === "site_setup_md" || key === "brand_kit_zip") {
    const output = await siteOutputGet(supabase, brandKitId, assetContext.target, "md");
    siteSetupMd = output.ok && typeof output.data === "string" ? output.data : null;
  }

  let rendered;
  try {
    rendered = await renderer({ ...assetContext.ctx, siteSetupMd });
  } catch {
    return { ok: false, error: "That file couldn't be rendered." };
  }

  const upload = await requestBrandAssetUpload(supabase, brandKitId, key, assetContext.fingerprint);
  if (!upload.ok) return { ok: false, error: upload.error.message };

  const put = await supabase.storage
    .from(upload.data.bucket)
    .upload(upload.data.storage_path, rendered.bytes, {
      contentType: rendered.contentType,
      upsert: true,
    });
  if (put.error) return { ok: false, error: "That file couldn't be saved." };

  const record = await recordBrandAsset(
    supabase,
    brandKitId,
    key,
    assetContext.fingerprint,
    upload.data.storage_path,
    rendered.bytes.byteLength,
    rendered.width,
    rendered.height
  );
  if (!record.ok) return { ok: false, error: record.error.message };

  return { ok: true, storagePath: upload.data.storage_path, byteSize: rendered.bytes.byteLength };
}
