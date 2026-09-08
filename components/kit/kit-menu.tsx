"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/*
 * The band's `···` menu — everything that is a real thing to do with a kit
 * but is not the one thing she came for.
 *
 * It used to hold three items and read as an afterthought beside a header
 * whose own buttons did the work. It now holds what the band's single
 * primary action deliberately does NOT: the PDF (a different artifact from
 * the zip, and a smaller ask), the designer handoff (the way out of Eklio,
 * on purpose), her brief, the direction switch, and deletion. Filled, not
 * decorative.
 */
export function KitMenu({
  brandKitId,
  projectId,
  compAccess,
}: {
  brandKitId: string;
  projectId: string;
  compAccess: boolean;
}) {
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

  return (
    <div ref={container} className="relative flex-none">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Brand kit options"
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-pill text-ink-2 hover:bg-card hover:text-ink"
      >
        <span aria-hidden="true" className="flex gap-[3px]">
          <span className="size-1 rounded-pill bg-current" />
          <span className="size-1 rounded-pill bg-current" />
          <span className="size-1 rounded-pill bg-current" />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute right-0 top-11 z-40 min-w-[200px] rounded-card border border-line bg-bg p-2"
        >
          {compAccess ? (
            <p className="px-3 py-2 font-mono text-mono uppercase tracking-mono-08 text-accent">
              Comp access active
            </p>
          ) : null}

          <a
            href={`/api/brand-kits/${brandKitId}/pdf`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Download PDF
          </a>
          <Link
            href={`/app/brand-kits/${brandKitId}/handoff`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Hand off to a designer
          </Link>
          <Link
            href={`/app/briefs/${projectId}/review`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Edit my brief
          </Link>

          <div className="my-2 border-t border-line" />

          <Link
            href={`/app/brand-kits/${brandKitId}/reveal`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Switch direction
          </Link>
          {/*
           * The delete section lives on the Overview, which is not
           * necessarily the section she is on — so this is a full address
           * with a fragment, never the bare `#kit-danger` it was when there
           * was only one page to be on.
           */}
          <Link
            href={`/app/brand-kits/${brandKitId}#kit-danger`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Delete this brand kit
          </Link>
        </div>
      ) : null}
    </div>
  );
}
