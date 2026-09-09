"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetThumbnail } from "@/components/kit/asset-thumbnail";
import { AssetDetailPanel } from "@/components/kit/asset-detail-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { MonoLabel } from "@/components/ui/mono-label";
import type { StatusKey } from "@/lib/status";
import type { KitTier } from "@/lib/kit/tiers";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import { track } from "@/lib/analytics";

const GROUP_ORDER = ["identity", "web", "color", "social", "print", "document"] as const;
type Group = (typeof GROUP_ORDER)[number];
const GROUP_LABEL: Record<Group, string> = {
  identity: "Identity",
  web: "Web",
  color: "Color",
  social: "Social",
  print: "Print",
  document: "Documents",
};

const SORTS = ["newest", "name", "downloads"] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  name: "Name",
  // Same fingerprint scope as the panel's spec row: the counter this
  // sorts on is per-rendering, not per-file-for-all-time.
  downloads: "Most downloaded (this version)",
};

function assetStatus(entry: AssetManifestEntry, staleKeys: Set<string>): StatusKey | null {
  if (entry.current) return "ready";
  if (staleKeys.has(entry.key)) return "needs-rebuild";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function specLine(entry: AssetManifestEntry): string {
  const parts = [entry.kind.toUpperCase()];
  if (entry.width && entry.height) parts.push(`${entry.width}×${entry.height}`);
  if (entry.asset) parts.push(formatBytes(entry.asset.byte_size));
  return parts.join(" · ");
}

export function AssetLibraryView({
  brandKitId,
  manifest,
  staleKeys,
  practiceName,
  entitledTier,
  projectId,
}: {
  brandKitId: string;
  manifest: AssetManifestEntry[];
  staleKeys: string[];
  practiceName: string;
  /*
   * Drilled to the detail panel, where three of its parts are their own
   * surfaces: other sizes and formats and seeing an asset in place are
   * Practice, version history is Signature. The library ITSELF is Starter —
   * the grid, the filters and the plain download are what she bought.
   */
  entitledTier: KitTier | null;
  projectId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staleSet = useMemo(() => new Set(staleKeys), [staleKeys]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function toggleSelected(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function downloadSelected() {
    if (selected.size === 0 || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/assets/zip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: [...selected] }),
      });
      /*
       * A failure used to return silently: the button un-dimmed and nothing
       * else happened, which is indistinguishable from a browser that
       * blocked the download. It says so now, and says it in a live region
       * so a screen reader hears it too.
       */
      if (!response.ok) {
        setDownloadError("That download couldn't be prepared. Try again in a moment.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "brand-assets.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("That download couldn't be prepared. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  const group = searchParams.get("group");
  const sort = (searchParams.get("sort") as Sort) ?? "newest";
  const view = searchParams.get("view") === "list" ? "list" : "grid";
  const status = searchParams.get("status");
  const activeAssetKey = searchParams.get("asset");
  const explicitKeys = searchParams.get("keys");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.push(`/app/brand-kits/${brandKitId}/assets?${next.toString()}`, { scroll: false });
  }

  const restricted = explicitKeys ? new Set(explicitKeys.split(",")) : null;

  const filtered = manifest.filter((entry) => {
    if (restricted && !restricted.has(entry.key)) return false;
    if (group && entry.group !== group) return false;
    if (status === "needs-rebuild" && !staleSet.has(entry.key)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.label.localeCompare(b.label);
    if (sort === "downloads") return (b.asset?.download_count ?? 0) - (a.asset?.download_count ?? 0);
    return (b.asset?.created_at ?? "").localeCompare(a.asset?.created_at ?? "");
  });

  /*
   * ⚠ THE CHIP COUNTS AND THE GRID COME FROM THE SAME ARRAY.
   *
   * `manifest` is the one the section was handed and the one `filtered` is
   * derived from, so a chip saying "Print (3)" cannot show two. This is not
   * a style preference: a second query, or a constant, is how a filter comes
   * to promise a number the grid then contradicts — which is exactly what
   * the `Categories` tile that used to sit here was doing, reporting
   * `GROUP_ORDER.length` (a flat six) whatever the kit contained.
   */
  const counts = GROUP_ORDER.reduce<Record<string, number>>((acc, g) => {
    acc[g] = manifest.filter((entry) => entry.group === g).length;
    return acc;
  }, {});

  const activeAsset = activeAssetKey ? manifest.find((entry) => entry.key === activeAssetKey) ?? null : null;

  /*
   * Group headings run down the grid whenever she is looking at everything.
   * Once a chip or an explicit key list has narrowed it, they would be one
   * heading over one grid — so the list goes flat and the heading's job is
   * done by the chip that is lit.
   */
  const grouped = !group && !restricted;

  return (
    <div className="mt-6 flex items-start gap-8 max-[900px]:flex-col">
      <div className="min-w-0 flex-1">
        {/* ── Filter chips ─────────────────────────────────────────────── */}
        <nav
          aria-label="Filter by group"
          className="flex flex-wrap items-center gap-2 max-[900px]:flex-nowrap max-[900px]:overflow-x-auto"
        >
          <FilterChip
            active={!group}
            label="All assets"
            count={manifest.length}
            onClick={() => {
              setParam("group", null);
              track("asset_filtered", { group: "all" });
            }}
          />
          {GROUP_ORDER.map((g) => (
            <FilterChip
              key={g}
              active={group === g}
              label={GROUP_LABEL[g]}
              count={counts[g] ?? 0}
              onClick={() => {
                setParam("group", g);
                track("asset_filtered", { group: g });
              }}
            />
          ))}
        </nav>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-ui text-ink-2">
              Sort
              <select
                value={sort}
                onChange={(event) => setParam("sort", event.target.value)}
                className="rounded-check border border-line bg-bg px-2 py-1 text-ui text-ink"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {selected.size > 0 ? (
              <button
                type="button"
                disabled={downloading}
                onClick={() => void downloadSelected()}
                className="rounded-pill bg-ink px-[18px] py-1.5 text-ui font-semibold text-bg hover:bg-ink-2 disabled:opacity-40"
              >
                {downloading ? "Preparing…" : `Download selected (.zip) — ${selected.size}`}
              </button>
            ) : null}
            {downloadError ? (
              <p role="alert" className="text-meta leading-body text-danger">
                {downloadError}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1 rounded-pill border border-line p-1">
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => setParam("view", null)}
              className={`rounded-pill px-3 py-1 text-ui ${view === "grid" ? "bg-ink text-bg" : "text-ink-2"}`}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setParam("view", "list")}
              className={`rounded-pill px-3 py-1 text-ui ${view === "list" ? "bg-ink text-bg" : "text-ink-2"}`}
            >
              List
            </button>
          </div>
        </div>

        {/* ── Grid / list ──────────────────────────────────────────────── */}
        {grouped ? (
          <div className="flex flex-col">
            {GROUP_ORDER.filter((g) => sorted.some((entry) => entry.group === g)).map((g) => (
              <div key={g}>
                <div className="mt-8 flex items-baseline justify-between gap-4 border-b border-line pb-2">
                  <MonoLabel tracking="14" as="h3">
                    {GROUP_LABEL[g]}
                  </MonoLabel>
                  <button
                    type="button"
                    onClick={() => {
                      setParam("group", g);
                      track("asset_filtered", { group: g });
                    }}
                    className="flex-none whitespace-nowrap text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
                  >
                    View all →
                  </button>
                </div>
                {renderEntries(sorted.filter((entry) => entry.group === g))}
              </div>
            ))}
          </div>
        ) : (
          renderEntries(sorted)
        )}

        {sorted.length === 0 ? (
          <p className="py-12 text-center text-body text-ink-2">
            Nothing matches this filter.
          </p>
        ) : null}
      </div>

      {activeAsset ? (
        <AssetDetailPanel
          brandKitId={brandKitId}
          entry={activeAsset}
          status={assetStatus(activeAsset, staleSet)}
          onClose={() => setParam("asset", null)}
          availableKeys={new Set(manifest.filter((entry) => entry.current).map((entry) => entry.key))}
          practiceName={practiceName}
          entitledTier={entitledTier}
          projectId={projectId}
        />
      ) : null}
    </div>
  );

  /*
   * One renderer for the cards, called once when the list is flat and once
   * per group when it is not. The grid's markup is untouched by this lot —
   * the headings wrap it, they do not rewrite it.
   */
  function renderEntries(entries: AssetManifestEntry[]) {
    return (
      <div
        className={
          view === "grid"
            ? "mt-6 grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2"
            : "mt-6 flex flex-col gap-2"
        }
      >
        {entries.map((entry) => {
          const chipStatus = assetStatus(entry, staleSet);
          const isSelected = selected.has(entry.key);
          const openDetail = () => {
            setParam("asset", entry.key);
            track("asset_detail_opened", { key: entry.key });
          };
          const checkbox = (
            <label
              className="flex size-6 flex-none items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(entry.key)}
                aria-label={`Select ${entry.label}`}
                className="size-4"
              />
            </label>
          );

          return view === "grid" ? (
            <div
              key={entry.key}
              className={`group flex flex-col overflow-hidden rounded-card border text-left ${
                isSelected ? "border-ink" : "border-line hover:border-ink-3"
              }`}
            >
              <div className="relative">
                <button type="button" onClick={openDetail} className="block w-full">
                  <AssetThumbnail brandKitId={brandKitId} assetKey={entry.key} className="aspect-square w-full" />
                </button>
                <div className="absolute left-2 top-2 rounded-check bg-bg/90">{checkbox}</div>
              </div>
              <button type="button" onClick={openDetail} className="flex flex-col gap-1 p-3 text-left">
                <p className="truncate text-ui text-ink">{entry.label}</p>
                <MonoLabel tracking="08">{specLine(entry)}</MonoLabel>
                {chipStatus ? <StatusChip status={chipStatus} /> : null}
              </button>
            </div>
          ) : (
            <div
              key={entry.key}
              className={`flex items-center gap-3 rounded-card border px-4 py-3 ${
                isSelected ? "border-ink" : "border-line hover:border-ink-3"
              }`}
            >
              {checkbox}
              <button
                type="button"
                onClick={openDetail}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
              >
                <span className="min-w-0 truncate text-ui text-ink">{entry.label}</span>
                <span className="flex flex-none items-center gap-4">
                  <MonoLabel tracking="08">{specLine(entry)}</MonoLabel>
                  {chipStatus ? <StatusChip status={chipStatus} /> : null}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  }
}


/**
 * One filter chip — its label with its own count, in the same breath.
 *
 * The count is not decoration: it is the difference between "Print" as a
 * guess and "Print (3)" as a promise the grid one line below keeps.
 */
function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-ui transition-colors ${
        active
          ? "border-ink bg-card font-semibold text-ink"
          : "border-line text-ink-2 hover:bg-card hover:text-ink"
      }`}
    >
      {`${label} (${count})`}
    </button>
  );
}
