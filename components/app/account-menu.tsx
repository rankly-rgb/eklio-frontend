"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronGlyph } from "@/components/ui/glyphs";
import { MonoLabel } from "@/components/ui/mono-label";
import type { Workspace } from "@/lib/data/workspaces";

/*
 * Account menu — her name, "Your workspace" beneath it, a chevron. Opens
 * onto: the workspace switcher (one entry today, from `workspaces`),
 * Settings, Help & support, Sign out.
 *
 * Built as a real switcher with one row rather than a single "Your
 * workspace" line, so the Practice offer adds a second row here later
 * without this component, or the trigger, changing shape.
 */
export function AccountMenu({
  initials,
  displayName,
  workspaces,
  signOutAction,
}: {
  initials: string;
  displayName: string;
  workspaces: Workspace[];
  signOutAction: () => void | Promise<void>;
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

  const current = workspaces.find((w) => w.isCurrent) ?? workspaces[0];

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-pill border border-line bg-card py-1 pl-1 pr-2.5 hover:bg-bg"
      >
        <span
          aria-hidden="true"
          className="flex size-8 flex-none items-center justify-center rounded-pill border border-line bg-bg"
        >
          <MonoLabel tracking="08">{initials}</MonoLabel>
        </span>
        <span className="flex flex-col items-start leading-tight max-sm:hidden">
          <span className="text-ui text-ink">{displayName || "Your account"}</span>
          <span className="text-mono font-mono uppercase tracking-mono-08 text-ink-3">
            {current?.name ?? "Your workspace"}
          </span>
        </span>
        <ChevronGlyph color="var(--ink-2)" />
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute right-0 top-12 z-40 min-w-[220px] rounded-card border border-line bg-bg p-2"
        >
          <p className="px-3 pb-1 pt-2 text-mono font-mono uppercase tracking-mono-08 text-ink-3">
            Your workspace
          </p>
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              role="menuitem"
              aria-current={workspace.isCurrent ? "true" : undefined}
              className="flex items-center justify-between rounded-check px-3 py-2 text-ui text-ink"
            >
              <span>{workspace.name}</span>
              {workspace.isCurrent ? (
                <span className="size-1.5 rounded-pill bg-accent" aria-hidden="true" />
              ) : null}
            </div>
          ))}

          <div className="my-2 border-t border-line" />

          <Link
            href="/app/settings"
            role="menuitem"
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <a
            href="mailto:hello@eklio.com"
            role="menuitem"
            className="block rounded-check px-3 py-2 text-ui text-ink-2 hover:bg-card hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Help &amp; support
          </a>

          <div className="my-2 border-t border-line" />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-check px-3 py-2 text-left text-ui text-ink-2 hover:bg-card hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
