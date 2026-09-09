"use client";

import { useEffect, useRef, useState } from "react";
import { AssetThumbnail } from "@/components/kit/asset-thumbnail";
import { AssetDownloadButton, AssetDownloadSplit } from "@/components/kit/asset-download-button";
import { AssetVersionHistory } from "@/components/kit/asset-version-history";
import { InSituSection } from "@/components/kit/in-situ/in-situ-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { MonoLabel } from "@/components/ui/mono-label";
import type { StatusKey } from "@/lib/status";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import type { KitTier } from "@/lib/kit/tiers";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierUpgradePrompt } from "@/components/billing/tier-upgrade-prompt";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The width below which this stops being a panel and becomes a sheet.
 *
 * ⚠ IT IS WRITTEN TWICE and it has to be: Tailwind's `max-[900px]:` classes
 * are compiled strings and cannot read a constant, so the layout half lives
 * in the class list and the semantic half lives here. A test asserts the two
 * agree, because a sheet that looks modal and does not announce itself as
 * one is worse than either.
 */
const SHEET_MAX_WIDTH = 900;

/** What the browser will move focus to with Tab, in DOM order. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Whether this is currently the sheet rather than the panel.
 *
 * Starts `false` on the server AND on the first client render, so hydration
 * matches; the effect corrects it on mount. That first frame is the desktop
 * reading, which is the safe one to be briefly wrong about — claiming
 * `aria-modal` for a beat costs nothing, claiming it forever on a panel that
 * is not modal is the bug this exists to avoid.
 */
function useIsSheet(): boolean {
  const [isSheet, setIsSheet] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SHEET_MAX_WIDTH}px)`);
    const sync = () => setIsSheet(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isSheet;
}

/*
 * The asset library's detail panel — driven by the `asset` search param.
 *
 * ⚠ IT IS TWO DIFFERENT THINGS AT TWO WIDTHS, and the accessibility tree has
 * to say which one. Above 900px it is a 520px rail sitting BESIDE the grid:
 * the grid is still there, still readable, still clickable, so it is a
 * labelled `region` and claiming `role="dialog"` would be a lie — it would
 * tell a screen reader the rest of the page had gone away when it had not.
 * Below 900px it is a sheet OVER the grid, behind a backdrop: that one is a
 * real modal, and a modal without `aria-modal` and without a focus trap
 * walks a keyboard or screen-reader user straight into the grid underneath
 * it, invisible and unreachable, with no way back.
 *
 * So: role, `aria-modal`, the backdrop and the trap are all conditional on
 * the same measurement. Escape and focus-return are unconditional — they are
 * correct for both.
 */
export function AssetDetailPanel({
  brandKitId,
  entry,
  status,
  onClose,
  availableKeys,
  practiceName,
  entitledTier,
  projectId,
}: {
  brandKitId: string;
  entry: AssetManifestEntry;
  status: StatusKey | null;
  onClose: () => void;
  availableKeys: Set<string>;
  practiceName: string;
  entitledTier: KitTier | null;
  projectId: string;
}) {
  /*
   * ⚠ THREE SURFACES INSIDE ONE PANEL, and they resolve separately because
   * they are separately sold. Seeing an asset in place and asking for another
   * size or format are Practice; every past version of it is Signature. The
   * file itself, at the size the catalogue defines, is Starter and is always
   * here.
   *
   * The API refuses each of these too — a hidden control is not a closed
   * door, and every one of them is a plain request against her own kit.
   */
  const inSitu = surfaceAccess("assets_in_situ", entitledTier);
  const versions = surfaceAccess("assets_version_history", entitledTier);
  const renditions = surfaceAccess("assets_sizes_and_formats", entitledTier);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const isSheet = useIsSheet();

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

  /*
   * The trap, and ONLY when it is the sheet. Trapping focus in the desktop
   * rail would be the mirror-image bug: she could tab into the panel and
   * never tab back out to the grid it belongs to.
   */
  useEffect(() => {
    if (!isSheet) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSheet]);

  return (
    <>
      {/* The sheet's backdrop. Tapping it closes, same as Escape — a sheet
          whose only exit is a small × is a trap. Rendered only when it is
          actually a sheet, so the desktop rail has no phantom sibling. */}
      {isSheet ? (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/25"
        />
      ) : null}

      <div
        ref={panelRef}
        tabIndex={-1}
        role={isSheet ? "dialog" : "region"}
        aria-modal={isSheet ? true : undefined}
        aria-label={entry.label}
        className="route-enter sticky top-6 flex w-[520px] flex-none flex-col gap-5 rounded-card border border-line bg-bg p-5 max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:top-auto max-[900px]:z-50 max-[900px]:max-h-[85vh] max-[900px]:w-auto max-[900px]:overflow-y-auto max-[900px]:rounded-b-none"
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
                {/*
                  * ⚠ THE SCOPE IS IN THE LABEL, and it has to be.
                  * `download_count` lives on the asset ROW, and the row is
                  * keyed by (kit, key, fingerprint) -- so this number is the
                  * downloads of THIS rendering, and it starts again at zero
                  * the next time her palette moves and the file is rebuilt.
                  * Labelled `Downloads` it read as a lifetime total and was
                  * quietly wrong; labelled this way it is simply true.
                  */}
                <SpecRow
                  label="Downloads of this version"
                  value={String(entry.asset.download_count)}
                />
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

        {inSitu.ok ? (
          <InSituSection
            brandKitId={brandKitId}
            assetKey={entry.key}
            availableKeys={availableKeys}
            practiceName={practiceName}
          />
        ) : inSitu.reason === "payment_required" ? (
          <TierUpgradePrompt access={inSitu} projectId={projectId} />
        ) : null}

        {versions.ok ? (
          <AssetVersionHistory key={entry.key} brandKitId={brandKitId} assetKey={entry.key} />
        ) : versions.reason === "payment_required" ? (
          <TierUpgradePrompt access={versions} projectId={projectId} />
        ) : null}

        {/*
         * ⚠ NOT A DEAD CONTROL — THE OTHER CONTROL. Without Practice the split
         * button becomes the plain one: she still downloads the file, at the
         * size the catalogue defines, which is hers. Greying out the half she
         * cannot use would teach her the product is broken; removing the
         * download with it would take away something she bought.
         */}
        {renditions.ok ? (
          <AssetDownloadSplit
            brandKitId={brandKitId}
            assetKey={entry.key}
            kind={entry.kind}
            availableSizes={entry.available_sizes}
            availableFormats={entry.available_formats}
            nativeWidth={entry.width}
            className="self-start rounded-pill bg-ink px-[26px] py-2.5 text-ui font-semibold text-bg hover:bg-ink-2"
          >
            Download
          </AssetDownloadSplit>
        ) : (
          <AssetDownloadButton
            brandKitId={brandKitId}
            assetKey={entry.key}
            className="self-start rounded-pill bg-ink px-[26px] py-2.5 text-ui font-semibold text-bg hover:bg-ink-2"
          >
            Download
          </AssetDownloadButton>
        )}
      </div>
    </>
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
