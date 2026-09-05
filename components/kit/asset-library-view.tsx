"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetThumbnail } from "@/components/kit/asset-thumbnail";
import { AssetDetailPanel } from "@/components/kit/asset-detail-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { MonoLabel } from "@/components/ui/mono-label";
import type { StatusKey } from "@/lib/status";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import { track } from "@/lib/analytics";

const GROUP_ORDER = ["identity", "web", "color", "social", "print", "document"] as const;
const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
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
  downloads: "Most downloaded",
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
}: {
  brandKitId: string;
  manifest: AssetManifestEntry[];
  staleKeys: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staleSet = useMemo(() => new Set(staleKeys), [staleKeys]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

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
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/assets/zip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: [...selected] }),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "brand-assets.zip";
      anchor.click();
      URL.revokeObjectURL(url);
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

  const counts = GROUP_ORDER.reduce<Record<string, number>>((acc, g) => {
    acc[g] = manifest.filter((entry) => entry.group === g).length;
    return acc;
  }, {});

  const currentCount = manifest.filter((entry) => entry.current).length;
  const totalDownloads = manifest.reduce((sum, entry) => sum + (entry.asset?.download_count ?? 0), 0);
  const lastUpdated = manifest.reduce<string | null>((max, entry) => {
    const createdAt = entry.asset?.created_at ?? null;
    if (!createdAt) return max;
    return !max || createdAt > max ? createdAt : max;
  }, null);

  const activeAsset = activeAssetKey ? manifest.find((entry) => entry.key === activeAssetKey) ?? null : null;

  return (
    <div className="mt-8 flex items-start gap-10 max-lg:flex-col">
      {/* ── Filter rail ──────────────────────────────────────────────── */}
      <nav aria-label="Filter by group" className="flex w-[180px] flex-none flex-col gap-1 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto">
        <FilterChip
          active={!group}
          label="All"
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

      <div className="min-w-0 flex-1">
        {/* ── Metrics strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
          <Metric label="Total assets" value={currentCount} />
          <Metric label="Total downloads" value={totalDownloads} />
          <Metric label="Categories" value={GROUP_ORDER.length} />
          <Metric
            label="Last updated"
            value={
              lastUpdated
                ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"
            }
          />
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
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
        <div
          className={
            view === "grid"
              ? "mt-6 grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2"
              : "mt-6 flex flex-col gap-2"
          }
        >
          {sorted.map((entry) => {
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
          {sorted.length === 0 ? (
            <p className="col-span-full py-12 text-center text-body text-ink-2">
              Nothing matches this filter.
            </p>
          ) : null}
        </div>
      </div>

      {activeAsset ? (
        <AssetDetailPanel
          brandKitId={brandKitId}
          entry={activeAsset}
          status={assetStatus(activeAsset, staleSet)}
          onClose={() => setParam("asset", null)}
        />
      ) : null}
    </div>
  );
}

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
      className={`flex items-center justify-between rounded-pill px-3 py-1.5 text-left text-ui max-lg:flex-none max-lg:border max-lg:border-line ${
        active ? "bg-card font-semibold text-ink" : "text-ink-2 hover:bg-card hover:text-ink"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <MonoLabel tracking="08" className="ml-2">
        {count}
      </MonoLabel>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line p-4">
      <MonoLabel tracking="10">{label}</MonoLabel>
      <div className="text-body text-ink">{value}</div>
    </div>
  );
}
