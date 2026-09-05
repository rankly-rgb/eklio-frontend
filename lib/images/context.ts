import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { siteSpecGet } from "@/lib/site/rpc";
import type { ImageFingerprintInput } from "@/lib/images/fingerprint";

/*
 * Everything the image pipeline reads about a kit, and NOTHING else.
 *
 * The deliberate contrast with `lib/kit/asset-context.ts`: that one loads
 * hero copy, social templates, the credential line, the booking URL, and the
 * font URL, because renderers draw them. None of that reaches a photograph,
 * so none of it is loaded here — which is also why the two fingerprints
 * cannot be merged. See lib/images/fingerprint.ts's header.
 */

type Client = SupabaseClient<Database>;

export type ImageContext =
  | { ok: true; input: ImageFingerprintInput }
  | { ok: false; reason: "no-direction" | "spec-not-ready" };

/**
 * The practice's PRIMARY specialty label — the one with the lowest
 * `sort_order` in the catalogue, matching `lib/generation/scope-key.ts`'s
 * definition rather than `specialty_ids[0]`, which is a raw array with no
 * guaranteed order. Null when the brief named none, which photographs as the
 * neutral setting.
 */
async function primarySpecialty(supabase: Client, projectId: string): Promise<string | null> {
  const { data: brief } = await supabase
    .from("project_briefs")
    .select("specialty_ids")
    .eq("project_id", projectId)
    .maybeSingle();

  const ids = (brief?.specialty_ids ?? []) as string[];
  if (ids.length === 0) return null;

  const { data: rows } = await supabase
    .from("specialties")
    .select("id,label,sort_order")
    .in("id", ids)
    .order("sort_order");

  return rows?.[0]?.label ?? null;
}

export async function loadImageContext(supabase: Client, kit: BrandKit): Promise<ImageContext> {
  if (!kit.selectedDirection) return { ok: false, reason: "no-direction" };

  const siteSpec = await siteSpecGet(supabase, kit.row.id);
  if (!siteSpec.ok) return { ok: false, reason: "spec-not-ready" };

  const tokens = siteSpec.data.preview.tokens;
  const details = siteSpec.data.spec.practice_details;

  return {
    ok: true,
    input: {
      direction: {
        id: kit.selectedDirection.id,
        name: kit.selectedDirection.name,
        tone_keywords: kit.selectedDirection.tone_keywords,
      },
      palette: {
        primary: tokens.primary,
        secondary: tokens.secondary,
        accent: tokens.accent,
        paper: tokens.paper,
        light_neutral: tokens.light_neutral,
        dark_neutral: tokens.dark_neutral,
      },
      specialty: await primarySpecialty(supabase, kit.projectId),
      city: details?.city ?? null,
      state: details?.state ?? null,
    },
  };
}
