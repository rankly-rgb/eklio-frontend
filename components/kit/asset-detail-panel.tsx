"use client";

import { useEffect, useRef } from "react";
import { AssetThumbnail } from "@/components/kit/asset-thumbnail";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { StatusChip } from "@/components/ui/status-chip";
import { MonoLabel } from "@/components/ui/mono-label";
import type { StatusKey } from "@/lib/status";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/*
 * The asset library's detail panel — 520px, right side, driven by the
 * `asset` search param. Traps focus and returns it on close, same pattern
 * `components/site/reset-section.tsx`'s ConfirmReset already established.
 *
 * "Also see it in place" (the in-situ frame strip) is Lot 4's next step —
 * this panel's slot for it is wired up there, not here.
 */
export function AssetDetailPanel({
  brandKitId,
  entry,
  status,
  onClose,
}: {
  brandKitId: string;
  entry: AssetManifestEntry;
  status: StatusKey | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/close transition only, not every entry change
  }, []);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label={entry.label}
      className="route-enter sticky top-6 flex w-[520px] flex-none flex-col gap-5 rounded-card border border-line p-5 max-lg:static max-lg:w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body text-ink">{entry.label}</p>
          {status ? <StatusChip status={status} className="mt-1.5" /> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 flex-none items-center justify-center rounded-pill text-ink-2 hover:bg-card hover:text-ink"
        >
          ×
        </button>
      </div>

      <AssetThumbnail brandKitId={brandKitId} assetKey={entry.key} className="aspect-square w-full rounded-card" />

      <table className="text-ui text-ink-2">
        <tbody>
          <SpecRow label="File type" value={entry.kind.toUpperCase()} />
          {entry.width && entry.height ? (
            <SpecRow label="Dimensions" value={`${entry.width}×${entry.height}`} />
          ) : null}
          {entry.asset ? (
            <>
              <SpecRow label="File size" value={formatBytes(entry.asset.byte_size)} />
              <SpecRow label="Added" value={formatDate(entry.asset.created_at)} />
              <SpecRow label="Downloads" value={String(entry.asset.download_count)} />
            </>
          ) : null}
        </tbody>
      </table>

      {entry.description ? (
        <div>
          <MonoLabel tracking="10">Usage guidelines</MonoLabel>
          <p className="mt-1.5 text-helper leading-prose text-ink-2">{entry.description}</p>
        </div>
      ) : null}

      <AssetDownloadButton
        brandKitId={brandKitId}
        assetKey={entry.key}
        className="self-start rounded-pill bg-ink px-[26px] py-2.5 text-ui font-semibold text-bg hover:bg-ink-2"
      >
        Download
      </AssetDownloadButton>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="py-2 pr-4 text-left font-normal text-ink-3">
        {label}
      </th>
      <td className="py-2 text-ink">{value}</td>
    </tr>
  );
}
