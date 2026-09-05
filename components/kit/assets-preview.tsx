import Link from "next/link";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { AssetThumbnail } from "@/components/kit/asset-thumbnail";
import { MonoLabel } from "@/components/ui/mono-label";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * "Your assets" (Lot 3) — six cards grouped by USAGE (how she looks for a
 * file: "the thing for my Instagram"), distinct from the asset library's
 * filter rail (Lot 4), which groups by the catalog's own structural
 * `group` ("how she reads her brand" -- identity/web/social/print/color/
 * document). Both groupings survive, each where it helps.
 *
 * A curated subset, not a repartition of all 34 keys: wordmarks/monograms
 * and the setup sheet stay reachable only through "View all assets" --
 * these six are the ones worth a dedicated card at a glance.
 */

type UsageGroup = {
  label: string;
  keys: string[];
  thumbnailKey: string;
};

const USAGE_GROUPS: UsageGroup[] = [
  {
    label: "Website preview",
    keys: ["og_image_1200x630", "favicon_16", "favicon_32", "apple_touch_icon_180", "icon_512", "manifest_values_json"],
    thumbnailKey: "og_image_1200x630",
  },
  {
    label: "Social post template",
    keys: [
      "post_statement_1080",
      "post_question_1080",
      "post_notes_1080",
      "post_signature_1080",
      "story_1080x1920",
      "cover_linkedin_1584x396",
      "cover_facebook_1640x624",
    ],
    thumbnailKey: "post_statement_1080",
  },
  { label: "Profile image", keys: ["avatar_400"], thumbnailKey: "avatar_400" },
  {
    label: "Business card",
    keys: ["business_card_front", "business_card_back"],
    thumbnailKey: "business_card_front",
  },
  {
    label: "Email signature",
    keys: ["email_signature_html", "email_signature_png"],
    thumbnailKey: "email_signature_png",
  },
  {
    label: "Brand colors",
    keys: ["palette_sheet_png", "palette_ase", "tokens_json", "colors_css"],
    thumbnailKey: "palette_sheet_png",
  },
];

export function AssetsPreview({
  brandKitId,
  manifest,
}: {
  brandKitId: string;
  manifest: AssetManifestEntry[];
}) {
  const zip = manifest.find((entry) => entry.key === "brand_kit_zip");
  const availableKeys = new Set(manifest.map((entry) => entry.key));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {USAGE_GROUPS.map((usageGroup) => {
          const count = usageGroup.keys.filter((key) => availableKeys.has(key)).length;
          return (
            <Link
              key={usageGroup.label}
              href={`/app/brand-kits/${brandKitId}/assets?keys=${usageGroup.keys.join(",")}`}
              className="group flex flex-col overflow-hidden rounded-card border border-line hover:border-ink-3"
            >
              <AssetThumbnail
                brandKitId={brandKitId}
                assetKey={usageGroup.thumbnailKey}
                className="aspect-[4/3] w-full"
              />
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="text-ui text-ink">{usageGroup.label}</p>
                <MonoLabel tracking="08">{`${count} ${count === 1 ? "asset" : "assets"}`}</MonoLabel>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        {zip ? (
          <AssetDownloadButton
            brandKitId={brandKitId}
            assetKey="brand_kit_zip"
            className="rounded-pill bg-ink px-[26px] py-2.5 text-ui font-semibold text-bg hover:bg-ink-2"
          >
            Download everything (.zip)
          </AssetDownloadButton>
        ) : null}
        <Link
          href={`/app/brand-kits/${brandKitId}/assets`}
          className="text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          View all assets →
        </Link>
      </div>
    </div>
  );
}
