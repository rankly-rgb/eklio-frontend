"use client";

import { useEffect, useState } from "react";

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
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brand-kits/${brandKitId}/assets/${assetKey}`, { method: "POST" })
      .then((response) => response.json() as Promise<{ url?: string }>)
      .then((body) => {
        if (cancelled) return;
        if (body.url) setUrl(body.url);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandKitId, assetKey]);

  if (failed) {
    return <div className={`bg-card ${className}`} aria-hidden="true" />;
  }

  return (
    <div className={`relative overflow-hidden bg-card ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, ephemeral Storage URL
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : null}
    </div>
  );
}
