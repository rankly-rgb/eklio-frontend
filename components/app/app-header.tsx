"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * En-tête de l'espace connecté — 72px, gouttières de 48px, filet bas.
 * Wordmark Fraunces 600 23px, trois liens en 14px, avatar de 32px à droite.
 * Relevé sur les Écrans 1, 2, 5, 6 et 7, qui portent tous le même en-tête.
 *
 * Aucune monospace dans la navigation (§1) : elle n'apparaît ici que dans les
 * initiales de l'avatar.
 */

export type HeaderNav = {
  /** Absent tant qu'aucun kit n'a été généré : les deux liens sont alors inertes. */
  brandKitId: string | null;
  initials: string;
  signOutAction: () => void | Promise<void>;
};

function navClass(active: boolean): string {
  return active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink";
}

export function AppHeader({ brandKitId, initials, signOutAction }: HeaderNav) {
  const pathname = usePathname() ?? "";
  const kitHref = brandKitId ? `/app/brand-kits/${brandKitId}` : null;

  const links: Array<{ label: string; href: string | null; active: boolean }> = [
    { label: "Home", href: "/app", active: pathname === "/app" },
    {
      label: "Brand kit",
      href: kitHref,
      active: pathname.startsWith("/app/brand-kits"),
    },
    {
      label: "Content",
      href: brandKitId ? "/app/content" : null,
      active: pathname.startsWith("/app/content"),
    },
  ];

  return (
    <header className="flex h-[var(--header-h)] flex-none items-center gap-12 border-b border-line px-[var(--gutter)] max-md:gap-6 max-md:px-[var(--gutter-sm)]">
      <Link
        href="/app"
        className="font-display text-wordmark font-semibold tracking-wordmark text-ink"
      >
        Eklio
      </Link>

      <nav aria-label="Main" className="flex items-center gap-8 text-ui">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={navClass(link.active)}
            >
              {link.label}
            </Link>
          ) : (
            // Pas encore de kit : le lien existe visuellement mais ne mène
            // nulle part. On le rend inerte plutôt que de le faire mentir.
            <span key={link.label} aria-disabled="true" className="text-ink-3">
              {link.label}
            </span>
          )
        )}
      </nav>

      <div className="flex-1" />

      <AccountMenu initials={initials} signOutAction={signOutAction} />
    </header>
  );
}

function AccountMenu({
  initials,
  signOutAction,
}: {
  initials: string;
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

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 items-center justify-center rounded-pill border border-line bg-card"
      >
        <MonoLabel tracking="08">{initials}</MonoLabel>
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute right-0 top-11 z-40 min-w-[168px] rounded-card border border-line bg-bg p-2"
        >
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
