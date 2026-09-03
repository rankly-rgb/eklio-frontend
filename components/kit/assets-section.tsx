"use client";

import { useEffect, useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * Your assets (Lot 3) — the whole catalogue, grouped, each item a real
 * download. Fetches `GET /api/brand-kits/[id]/assets` once for the listing
 * (label/description/current-or-not, no rendering), then each button POSTs
 * to the per-key route on demand — the same split as the two routes
 * themselves (see asset-context.ts's header for why the split exists).
 */

const GROUP_ORDER = ["identity", "web", "color", "social", "print", "document"] as const;
const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
  identity: "Identity",
  web: "Web",
  color: "Color",
  social: "Social",
  print: "Print",
  document: "Document",
};

export function AssetsSection({ brandKitId }: { brandKitId: string }) {
  const [manifest, setManifest] = useState<AssetManifestEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brand-kits/${brandKitId}/assets`)
      .then((res) => res.json() as Promise<{ manifest?: AssetManifestEntry[] }>)
      .then((body) => {
        if (cancelled) return;
        if (!body.manifest) {
          setError(true);
          return;
        }
        setManifest(body.manifest);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandKitId]);

  if (error) {
    return (
      <p className="text-body text-ink-2">
        Your assets didn&rsquo;t load. Refresh the page to try again.
      </p>
    );
  }

  if (!manifest) {
    return <p className="text-body text-ink-2">Loading your assets…</p>;
  }

  const zip = manifest.find((entry) => entry.key === "brand_kit_zip");
  const rest = manifest.filter((entry) => entry.key !== "brand_kit_zip");
  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    entries: rest.filter((entry) => entry.group === group),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {zip ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-card p-[18px_22px]">
          <div>
            <p className="text-body text-ink">{zip.label}</p>
            <p className="mt-1 text-helper text-ink-2">{zip.description}</p>
          </div>
          <AssetDownloadButton
            brandKitId={brandKitId}
            assetKey="brand_kit_zip"
            className="flex-none rounded-pill bg-ink px-[26px] py-2.5 text-ui font-semibold text-bg hover:bg-ink-2"
          >
            Download everything
          </AssetDownloadButton>
        </div>
      ) : null}

      {byGroup.map(({ group, entries }) => (
        <div key={group} className="flex flex-col gap-3">
          <MonoLabel tracking="16" as="h3">
            {GROUP_LABEL[group]}
          </MonoLabel>
          <ul className="flex flex-col gap-2.5">
            {entries.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-ui text-ink">{entry.label}</p>
                  <p className="mt-0.5 text-helper text-ink-2">{entry.description}</p>
                </div>
                <AssetDownloadButton
                  brandKitId={brandKitId}
                  assetKey={entry.key}
                  className="flex-none text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
                >
                  Download
                </AssetDownloadButton>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
