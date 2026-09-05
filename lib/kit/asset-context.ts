import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { siteSpecGet } from "@/lib/site/rpc";
import { computeAssetFingerprint } from "@/lib/kit/asset-fingerprint";
import type { AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";
import type { RenderContext } from "@/lib/kit/render/registry";

/*
 * The siteSpec-load + fingerprint-compute logic every asset route needs —
 * factored out once both the per-key render route
 * (app/api/brand-kits/[id]/assets/[key]/route.ts) and the manifest-listing
 * route (app/api/brand-kits/[id]/assets/route.ts, Lot 3's "Your assets"
 * section) needed the exact same computation. Two independent
 * implementations of "how do we compute this kit's current fingerprint"
 * is exactly the kind of drift the fingerprint's own file header warns
 * about avoiding.
 *
 * Deliberately does NOT fetch `site_setup_md` — only the per-key route's
 * `site_setup_md`/`brand_kit_zip` branch needs that extra RPC call, and
 * every other caller (including the manifest listing, which never renders
 * anything) has no reason to pay for it.
 */

type Client = SupabaseClient<Database>;

export type AssetContext =
  | {
      ok: true;
      /** Everything a renderer needs EXCEPT `siteSetupMd` — callers that need it fetch it themselves. */
      ctx: Omit<RenderContext, "siteSetupMd">;
      fingerprint: string;
      /**
       * The exact object `fingerprint` was computed from — the same one, not
       * a reconstruction. The rebuild path records it alongside the asset so
       * the NEXT rebuild can say what moved
       * (`lib/kit/asset-change-summary.ts`). Exposing it changes nothing
       * about how the hash is computed; it just stops the inputs from being
       * thrown away the moment they've been hashed.
       */
      fingerprintInputs: AssetFingerprintInput;
      /** The site spec's current builder target — the one extra piece `site_setup_md`/`brand_kit_zip` need beyond `ctx`. */
      target: string;
    }
  | { ok: false; reason: "no-direction" }
  | { ok: false; reason: "spec-not-ready" };

export async function loadAssetContext(
  supabase: Client,
  kit: BrandKit
): Promise<AssetContext> {
  if (!kit.selectedDirection) return { ok: false, reason: "no-direction" };

  const siteSpec = await siteSpecGet(supabase, kit.row.id);
  if (!siteSpec.ok) return { ok: false, reason: "spec-not-ready" };

  const tokens = siteSpec.data.preview.tokens;

  const practiceDetails = siteSpec.data.spec.practice_details
    ? {
        practitionerName: siteSpec.data.spec.practice_details.practitioner_name ?? null,
        licenseLabel: siteSpec.data.spec.practice_details.license_label ?? null,
        licenseNumber: siteSpec.data.spec.practice_details.license_number ?? null,
        city: siteSpec.data.spec.practice_details.city ?? null,
        state: siteSpec.data.spec.practice_details.state ?? null,
      }
    : null;
  const bookingUrl = siteSpec.data.spec.hero.cta_target_url || null;

  const fingerprintInputs: AssetFingerprintInput = {
    tokens: {
      primary: tokens.primary,
      secondary: tokens.secondary,
      accent: tokens.accent,
      paper: tokens.paper,
      light_neutral: tokens.light_neutral,
      dark_neutral: tokens.dark_neutral,
      primary_text: tokens.primary_text,
      secondary_text: tokens.secondary_text,
      accent_text: tokens.accent_text,
      cta_ink: tokens.cta_ink,
      heading_font: tokens.heading_font,
      body_font: tokens.body_font,
    },
    practiceName: kit.practiceName,
    hero: kit.selectedDirection.hero,
    socialTemplates: kit.socialTemplates,
    practitionerLine: kit.row.practitioner_line,
    practiceDetails,
    bookingUrl,
  };

  const fingerprint = computeAssetFingerprint(fingerprintInputs);

  return {
    ok: true,
    fingerprint,
    fingerprintInputs,
    target: siteSpec.data.spec.target,
    ctx: {
      tokens,
      practiceName: kit.practiceName,
      googleFontsUrl: kit.selectedDirection.typography.google_fonts_url,
      hero: kit.selectedDirection.hero,
      socialTemplates: kit.socialTemplates,
      practitionerLine: kit.row.practitioner_line,
      practiceDetails,
      bookingUrl,
    },
  };
}
