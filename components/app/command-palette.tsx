"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SearchAssetResult, SearchLaunchStepResult } from "@/app/api/search/route";

/*
 * Global search, ⌘K / Ctrl-K. Scoped to the current page's brand kit and
 * labelled accordingly. One RPC (app_search), no client-side full scan --
 * this component only ever renders what the server already filtered.
 *
 * Focus-trap / Escape / focus-return follows the same pattern already
 * established for this app's other modal (`components/site/reset-
 * section.tsx`'s ConfirmReset).
 */
export function CommandPalette({ brandKitId }: { brandKitId: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<SearchAssetResult[]>([]);
  const [steps, setSteps] = useState<SearchLaunchStepResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const placeholder = pathname.startsWith("/app/content")
    ? "Search posts, captions, tags…"
    : pathname.startsWith("/app/brand-kits")
      ? "Search assets, files, or anything…"
      : "Search…";

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setAssets([]);
    setSteps([]);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        triggerRef.current = document.activeElement as HTMLElement | null;
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape" && open) close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open || !brandKitId || trimmedQuery === "") return;

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandKitId, query: trimmedQuery }),
      })
        .then((response) => response.json())
        .then((data: { assets?: SearchAssetResult[]; launch_steps?: SearchLaunchStepResult[] }) => {
          if (cancelled) return;
          setAssets(data.assets ?? []);
          setSteps(data.launch_steps ?? []);
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, brandKitId, trimmedQuery]);

  // Derived, not stored: a cleared query hides the previous fetch's results
  // without needing an effect to actively reset state on every keystroke.
  const visibleAssets = trimmedQuery === "" ? [] : assets;
  const visibleSteps = trimmedQuery === "" ? [] : steps;

  if (!brandKitId) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="Search"
        className="flex size-8 items-center justify-center rounded-pill border border-line text-ink-3 max-md:size-8 md:h-8 md:w-auto md:px-3"
      >
        <SearchGlyph />
        <span className="max-md:hidden">Search</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => {
          triggerRef.current = document.activeElement as HTMLElement | null;
          setOpen(true);
        }}
        className="flex h-8 items-center gap-2 rounded-pill border border-line px-2 text-ui text-ink-2 hover:bg-card hover:text-ink md:px-3"
      >
        <SearchGlyph />
        <span className="max-md:hidden">Search</span>
        <span className="font-mono text-mono-sm uppercase tracking-mono-08 text-ink-3 max-md:hidden">
          ⌘K
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[15vh]"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="route-enter w-full max-w-[560px] rounded-card border border-line bg-bg shadow-preview max-md:mx-4">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="w-full border-b border-line bg-transparent px-5 py-4 text-body text-ink outline-none placeholder:text-ink-3"
            />

            <div className="max-h-[360px] overflow-y-auto p-2">
              {trimmedQuery === "" ? (
                <p className="px-3 py-6 text-center text-ui text-ink-3">
                  Search rows you already own — nothing else.
                </p>
              ) : visibleAssets.length === 0 && visibleSteps.length === 0 ? (
                <p className="px-3 py-6 text-center text-ui text-ink-3">No matches.</p>
              ) : (
                <>
                  {visibleAssets.length > 0 ? (
                    <ResultGroup label="Assets">
                      {visibleAssets.map((asset) => (
                        <ResultRow
                          key={asset.key}
                          label={asset.label}
                          meta={asset.group}
                          onSelect={() => {
                            close();
                            router.push(`/app/brand-kits/${brandKitId}#kit-assets`);
                          }}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}

                  {visibleSteps.length > 0 ? (
                    <ResultGroup label="Launch steps">
                      {visibleSteps.map((step) => (
                        <ResultRow
                          key={step.key}
                          label={step.label}
                          meta={step.status}
                          onSelect={() => {
                            close();
                            router.push(`/app/brand-kits/${brandKitId}`);
                          }}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1 font-mono text-mono-sm uppercase tracking-mono-08 text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function ResultRow({
  label,
  meta,
  onSelect,
}: {
  label: string;
  meta: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-check px-3 py-2 text-left text-ui text-ink hover:bg-card"
    >
      <span>{label}</span>
      <span className="font-mono text-mono-sm uppercase tracking-mono-08 text-ink-3">{meta}</span>
    </button>
  );
}

/** Hand-drawn, matching `components/ui/glyphs.tsx`'s bordered-div convention. */
function SearchGlyph() {
  return (
    <span aria-hidden="true" className="relative block flex-none" style={{ width: 13, height: 13 }}>
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 9,
          height: 9,
          border: "1.5px solid var(--ink-2)",
          borderRadius: "50%",
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 4,
          height: 1.5,
          background: "var(--ink-2)",
          transform: "rotate(45deg)",
          transformOrigin: "right",
        }}
      />
    </span>
  );
}
