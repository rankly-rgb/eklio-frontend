"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/app/account-menu";
import { CommandPalette } from "@/components/app/command-palette";
import { MobileNav } from "@/components/app/mobile-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import type { Workspace } from "@/lib/data/workspaces";

/*
 * En-tête de l'espace connecté — 72px, gouttières de 48px, filet bas.
 * Wordmark Fraunces 600 23px, nav en 14px, search + bell + account menu à
 * droite. Relevé sur les Écrans 1, 2, 5, 6 et 7, qui portent tous le même
 * en-tête.
 *
 * Aucune monospace dans la navigation (§1) : elle n'apparaît ici que dans
 * les initiales de l'avatar et le raccourci ⌘K.
 */

export type HeaderNav = {
  /** Absent tant qu'aucun kit n'a été généré : les liens qui en dépendent sont alors inertes. */
  brandKitId: string | null;
  initials: string;
  displayName: string;
  workspaces: Workspace[];
  signOutAction: () => void | Promise<void>;
};

function navClass(active: boolean): string {
  return active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink";
}

export function AppHeader({
  brandKitId,
  initials,
  displayName,
  workspaces,
  signOutAction,
}: HeaderNav) {
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
    // /app/check doesn't exist yet -- it's LOT 7, a later session. The nav
    // slot is real now (per this lot's chrome spec); it stays inert until
    // that route ships, same treatment as "no kit yet" above.
    { label: "Check", href: null, active: pathname.startsWith("/app/check") },
  ];

  return (
    <header className="flex h-[var(--header-h)] flex-none items-center gap-12 border-b border-line px-[var(--gutter)] max-md:gap-4 max-md:px-[var(--gutter-sm)]">
      <MobileNav links={links} />

      <Link
        href="/app"
        className="font-display text-wordmark font-semibold tracking-wordmark text-ink"
      >
        Eklio
      </Link>

      <nav aria-label="Main" className="flex items-center gap-8 text-ui max-md:hidden">
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
            // Pas encore disponible (pas de kit, ou route pas encore construite) :
            // le lien existe visuellement mais ne mène nulle part.
            <span key={link.label} aria-disabled="true" className="text-ink-3">
              {link.label}
            </span>
          )
        )}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <CommandPalette brandKitId={brandKitId} />
        {brandKitId ? <NotificationBell brandKitId={brandKitId} /> : null}
        <AccountMenu
          initials={initials}
          displayName={displayName}
          workspaces={workspaces}
          signOutAction={signOutAction}
        />
      </div>
    </header>
  );
}
