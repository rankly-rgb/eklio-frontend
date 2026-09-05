"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronGlyph } from "@/components/ui/glyphs";

/*
 * One catalogue key, one download. POSTs to
 * `/api/brand-kits/[id]/assets/[key]` (renders-if-needed, signs, returns a
 * URL), then opens it — the browser's own download/viewer behavior takes it
 * from there, same as the existing "Download PDF" link elsewhere on this
 * page, just POST-driven instead of a plain `<a href>` since this route has
 * to decide whether to render first.
 *
 * A same-origin `fetch` already carries the session cookie the route's
 * `authenticate()` reads (`lib/supabase/server.ts`'s cookie-based client,
 * same as every other route in this app) — no token to attach by hand.
 */

type Rendition = {
  size?: number;
  format?: string;
  /** An older version's fingerprint. Served from storage, never re-rendered. */
  version?: string;
};

function downloadUrl(brandKitId: string, assetKey: string, rendition?: Rendition): string {
  const params = new URLSearchParams({ intent: "download" });
  if (rendition?.size) params.set("size", String(rendition.size));
  if (rendition?.format) params.set("format", rendition.format);
  if (rendition?.version) params.set("version", rendition.version);
  return `/api/brand-kits/${brandKitId}/assets/${assetKey}?${params.toString()}`;
}

async function openDownload(url: string): Promise<boolean> {
  const res = await fetch(url, { method: "POST" });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !body.url) return false;
  window.open(body.url, "_blank", "noopener,noreferrer");
  return true;
}

export function AssetDownloadButton({
  brandKitId,
  assetKey,
  version,
  children,
  className = "",
}: {
  brandKitId: string;
  assetKey: string;
  /** Omit for the version she has now; pass a fingerprint for an older one. */
  version?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function handleClick() {
    setState("working");
    try {
      setState((await openDownload(downloadUrl(brandKitId, assetKey, { version }))) ? "idle" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      disabled={state === "working"}
      onClick={() => void handleClick()}
      className={`disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {state === "working" ? "Preparing…" : state === "error" ? "Couldn't get that file — try again" : children}
    </button>
  );
}

/*
 * ── THE SPLIT BUTTON ────────────────────────────────────────────────────
 *
 * The left half is the plain download she came for: the file at the size
 * the catalogue calls native. The right half opens the sizes and formats
 * that same rendering can also be handed over in.
 *
 * Both halves cost her nothing. A width she picks here is the same vector
 * re-rasterized under the same fingerprint — no credit is consumed, and
 * `app/__tests__/download-is-never-a-generation.test.ts` holds that true.
 * So there is no warning, no confirmation and no count in this menu: there
 * is nothing for her to weigh.
 *
 * `availableSizes` / `availableFormats` come straight from the catalogue
 * row via the manifest. An asset with neither renders as the plain button
 * above — no disabled chevron for a menu that would be empty.
 */
export function AssetDownloadSplit({
  brandKitId,
  assetKey,
  kind,
  availableSizes,
  availableFormats,
  nativeWidth,
  children,
  className = "",
}: {
  brandKitId: string;
  assetKey: string;
  /** The catalogue row's own file type — the one the plain half hands over. */
  kind: string;
  availableSizes: number[];
  availableFormats: string[];
  /** Marks which entry in the size list is the one she already has. */
  nativeWidth: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The catalogue lists the asset's own format alongside the alternatives,
  // because that is how the menu reads to her ("PNG / SVG"). The plain half
  // already hands over the native one, so only the others earn a row.
  const otherFormats = availableFormats.filter((format) => format !== kind);
  const hasMenu = availableSizes.length > 0 || otherFormats.length > 0;

  async function download(rendition?: Rendition) {
    setOpen(false);
    setState("working");
    try {
      setState((await openDownload(downloadUrl(brandKitId, assetKey, rendition))) ? "idle" : "error");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "working" ? "Preparing…" : state === "error" ? "Couldn't get that file — try again" : children;

  if (!hasMenu) {
    return (
      <button
        type="button"
        disabled={state === "working"}
        onClick={() => void download()}
        className={`disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div ref={container} className="relative self-start">
      <div className="flex items-stretch overflow-hidden rounded-pill bg-ink text-bg">
        <button
          type="button"
          disabled={state === "working"}
          onClick={() => void download()}
          className="px-[26px] py-2.5 text-ui font-semibold hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
        <span aria-hidden="true" className="my-2 w-px bg-bg/25" />
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Other sizes and formats"
          disabled={state === "working"}
          onClick={() => setOpen((value) => !value)}
          className="px-3 hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronGlyph color="var(--bg)" />
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute left-0 top-12 z-40 min-w-[200px] rounded-card border border-line bg-bg p-2"
        >
          {availableSizes.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-2 text-mono font-mono uppercase tracking-mono-08 text-ink-3">
                Size
              </p>
              {availableSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  role="menuitem"
                  onClick={() => void download({ size })}
                  className="flex w-full items-center justify-between rounded-check px-3 py-2 text-left text-ui text-ink-2 hover:bg-card hover:text-ink"
                >
                  <span>{size} px</span>
                  {size === nativeWidth ? (
                    <span className="text-mono font-mono uppercase tracking-mono-08 text-ink-3">
                      Yours
                    </span>
                  ) : null}
                </button>
              ))}
            </>
          ) : null}

          {otherFormats.length > 0 ? (
            <>
              {availableSizes.length > 0 ? <div className="my-2 border-t border-line" /> : null}
              <p className="px-3 pb-1 pt-2 text-mono font-mono uppercase tracking-mono-08 text-ink-3">
                Format
              </p>
              {otherFormats.map((format) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  onClick={() => void download({ format })}
                  className="block w-full rounded-check px-3 py-2 text-left text-ui text-ink-2 hover:bg-card hover:text-ink"
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
