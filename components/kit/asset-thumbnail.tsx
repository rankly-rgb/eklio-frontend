"use client";

import { useAssetUrl } from "@/lib/kit/use-asset-url";

/*
 * A real rendered thumbnail — reuses the exact same signed-URL round trip
 * as `AssetDownloadButton` (POST /api/brand-kits/[id]/assets/[key]), just
 * displayed inline instead of opened in a new tab.
 */
export function AssetThumbnail({
  brandKitId,
  assetKey,
  className = "",
}: {
  brandKitId: string;
  assetKey: string;
  className?: string;
}) {
  const url = useAssetUrl(brandKitId, assetKey);

  return (
    <div className={`relative overflow-hidden bg-card ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, ephemeral Storage URL
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : null}
    </div>
  );
}
