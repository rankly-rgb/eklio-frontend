"use client";

import { useEffect, useState } from "react";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { MonoLabel } from "@/components/ui/mono-label";
import type { AssetVersion } from "@/lib/kit/asset-rpc";

/*
 * ── VERSION HISTORY ─────────────────────────────────────────────────────
 *
 * `brand_assets` has kept every version since the assets shipped: a rebuild
 * writes a row under a new fingerprint instead of overwriting the old one.
 * This is the part she can see — when each version was made, one sentence
 * saying what changed, and a way back to any of them.
 *
 * WHAT IT DELIBERATELY DOESN'T DO:
 *
 *  - No "restore this version" button. Putting an old file back would leave
 *    her kit saying one thing and her assets another. The way back to an
 *    old look is to put the colour back, and then the asset follows.
 *  - No diff view, no thumbnails per version. She has the sentence and the
 *    file; a picture of what a favicon used to look like at 32px is not
 *    information.
 *  - Nothing at all when there is only one version. A history of one entry
 *    is furniture.
 */
export function AssetVersionHistory({
  brandKitId,
  assetKey,
}: {
  brandKitId: string;
  assetKey: string;
}) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brand-kits/${brandKitId}/assets/${assetKey}/versions`)
      .then((response) => response.json() as Promise<{ versions?: AssetVersion[] }>)
      .then((body) => {
        if (!cancelled && body.versions) setVersions(body.versions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandKitId, assetKey]);

  // The list belongs to the key it was fetched for: showing another asset's
  // versions, even for one frame, would be wrong rather than merely late.
  // The panel mounts this with `key={entry.key}`, so a different asset gets
  // a fresh component instead of a stale list waiting to be replaced.
  if (versions.length < 2) return null;

  return (
    <div>
      <MonoLabel tracking="10">Version history</MonoLabel>
      <ul className="mt-2 flex flex-col">
        {versions.map((version) => (
          <li
            key={version.fingerprint}
            className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-ui text-ink">
                {formatDate(version.created_at)}
                {version.current ? (
                  <span className="ml-2 text-mono font-mono uppercase tracking-mono-08 text-ink-3">
                    Current
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-helper leading-prose text-ink-2">
                {version.change_summary || "The first version of this file."}
              </p>
            </div>
            {version.current ? null : (
              <AssetDownloadButton
                brandKitId={brandKitId}
                assetKey={assetKey}
                version={version.fingerprint}
                className="flex-none rounded-pill border border-line px-3.5 py-1.5 text-ui text-ink-2 hover:bg-card hover:text-ink"
              >
                Download
              </AssetDownloadButton>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
