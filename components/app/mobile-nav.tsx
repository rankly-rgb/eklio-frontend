"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/*
 * The header's four nav items collapse into this at md and below (375px
 * first: four links plus a wordmark and three right-side controls do not
 * fit one row). Same dropdown shell as AccountMenu/NotificationBell.
 */
export function MobileNav({
  links,
}: {
  links: Array<{ label: string; href: string | null; active: boolean }>;
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
    <div ref={container} className="relative md:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 flex-col items-center justify-center gap-[3px] rounded-pill hover:bg-card"
      >
        <span aria-hidden="true" className="block h-[1.5px] w-4 bg-ink-2" />
        <span aria-hidden="true" className="block h-[1.5px] w-4 bg-ink-2" />
        <span aria-hidden="true" className="block h-[1.5px] w-4 bg-ink-2" />
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute left-0 top-11 z-40 min-w-[180px] rounded-card border border-line bg-bg p-2"
        >
          {links.map((link) =>
            link.href ? (
              <Link
                key={link.label}
                href={link.href}
                role="menuitem"
                aria-current={link.active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-check px-3 py-2 text-ui ${
                  link.active ? "font-semibold text-ink" : "text-ink-2 hover:bg-card hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ) : (
              <span
                key={link.label}
                aria-disabled="true"
                className="block rounded-check px-3 py-2 text-ui text-ink-3"
              >
                {link.label}
              </span>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
