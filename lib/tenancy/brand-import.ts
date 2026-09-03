import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TenancyRpcResult } from "@/lib/tenancy/rpc";

/*
 * Wrapper for `import_brand_identity` (20260903120500_import_brand_identity.sql).
 *
 * ⚠ NO `deriveTextVariants(hex)` HERE, AND NONE WAS ADDED. Two independent
 * reasons, checked before writing this file:
 *
 *   1. It is not this module's job. site_specs' own BEFORE INSERT OR UPDATE
 *      trigger (`maintain_site_spec_text_variants`, unconditional — fires on
 *      every write to the table, from any caller) derives the AA-contrast
 *      text-variant columns automatically whenever import_brand_identity
 *      writes a colour. There is nothing left for the client to compute for
 *      that write to be correct.
 *   2. Even for a client-side PREVIEW of those variants, the derivation
 *      toolkit already exists: `lib/brand/color.ts` — relativeLuminance,
 *      contrastRatio, meetsAA, plus the full hex/rgb/hsl conversion set. A
 *      second implementation here would just be lib/brand/color.ts with a
 *      different name.
 *
 * ⚠ `tone` IS NOT IN THIS SCHEMA. site_specs has no tone column — see the
 * migration's own header for why. A payload containing `tone` fails
 * validation here before it ever reaches the RPC.
 */

type Client = SupabaseClient<Database>;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "must be a #RRGGBB hex color");
const orgStoragePath = z
  .string()
  .regex(/^org\//, "must be a Storage path under org/<organization id>/");

export const brandImportPayloadSchema = z
  .object({
    primary_hex: hex,
    secondary_hex: hex,
    accent_hex: hex,
    light_neutral_hex: hex,
    dark_neutral_hex: hex,
    paper_hex: hex,
    heading_font: z.string().min(1),
    body_font: z.string().min(1),
    font_display_fallback: z.string().min(1),
    logo_svg_path: orgStoragePath,
    logo_png_light_path: orgStoragePath,
    logo_png_dark_path: orgStoragePath,
    monogram_svg_path: orgStoragePath,
  })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "at least one field is required",
  });

export type BrandImportPayload = z.infer<typeof brandImportPayloadSchema>;

const importBrandIdentityInput = z.object({
  projectId: z.string().uuid(),
  payload: brandImportPayloadSchema,
});

export type ImportBrandIdentityInput = z.infer<typeof importBrandIdentityInput>;

/**
 * Writes any subset of the payload onto the project's site_specs, marking
 * each present field imported. A two-field payload (a logo and one colour)
 * is the common case, not a degraded one — every field absent is simply
 * left untouched. Requires the caller to own the project or be the active
 * org owner (enforced in the RPC).
 */
export async function importBrandIdentity(
  supabase: Client,
  input: ImportBrandIdentityInput
): Promise<TenancyRpcResult<null>> {
  const parsed = importBrandIdentityInput.parse(input);

  const { error } = await supabase.rpc("import_brand_identity", {
    p_project_id: parsed.projectId,
    p_payload: parsed.payload,
  });

  if (error) return { ok: false, error };
  return { ok: true, data: null };
}
