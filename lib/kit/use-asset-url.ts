"use client";

import { useEffect, useState } from "react";

/**
 * The signed-URL round trip `AssetThumbnail` and every in-situ frame need —
 * factored out so both call the same fetch rather than two copies of it.
 * Never passes `?intent=download`: every caller here is a preview, not a
 * download.
 */
export function useAssetUrl(brandKitId: string, assetKey: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brand-kits/${brandKitId}/assets/${assetKey}`, { method: "POST" })
      .then((response) => response.json() as Promise<{ url?: string }>)
      .then((body) => {
        if (!cancelled && body.url) setUrl(body.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `assetKey` changing while a stale `url` from the previous key briefly
    // remains is a cosmetic one-frame flash, not a correctness issue --
    // resetting it synchronously here would re-trigger the exact
    // cascading-render pattern this hook's callers already avoid elsewhere.
  }, [brandKitId, assetKey]);

  return url;
}
