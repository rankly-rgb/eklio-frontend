"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/*
 * The kit header's `···` menu — every app control that isn't her direction
 * name: the tier/comp-access indicator, Switch direction, Edit your brief,
 * Delete this brand kit. Nothing but the direction name sits under her
 * practice name in the header itself (Lot 3).
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

          <Link
            href={`/app/brand-kits/${brandKitId}/reveal`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Switch direction
          </Link>
          <Link
            href={`/app/briefs/${projectId}/review`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Edit your brief
          </Link>

          <div className="my-2 border-t border-line" />

          <a
            href="#kit-danger"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Delete this brand kit
          </a>
        </div>
      ) : null}
    </div>
  );
}
