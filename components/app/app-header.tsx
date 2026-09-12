"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/app/account-menu";
import { CheckGlyph, SectionGlyph } from "@/components/ui/glyphs";
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
 *
 * ── LES TROIS SEULS ÉCARTS DU CHANTIER home-v3 ──────────────────────────
 *
 * Une icône par entrée, l'entrée active en pastille de lin plein, et la
 * pastille de compte qui retrouve sa seconde ligne (voir `account-menu.tsx`).
 * Rien d'autre : la recherche et la cloche étaient DÉJÀ là, et la maquette les
 * montre telles quelles.
 *
 * Trois des quatre marques existent déjà — c'est celle de l'accueil qui
 * manquait, et elle est dessinée ici en bordures comme toutes les autres,
 * plutôt qu'ajoutée à `glyphs.tsx`, dont l'en-tête se dit « les trois seules
 * glyphes de l'app » (`status-chip.tsx` a posé le même précédent).
 */

/** Un toit et un mur — l'accueil. */
function HomeGlyph() {
  const stroke = "1.25px solid currentColor";

  return (
    <span aria-hidden="true" className="relative block size-[14px]">
      <span
        className="absolute left-1/2 top-0 block -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderBottom: "5px solid currentColor",
        }}
      />
      <span
        className="absolute inset-x-[1.5px] bottom-0 block"
        style={{ height: 8, border: stroke, borderRadius: 1, boxSizing: "border-box" }}
      />
    </span>
  );
}

export type HeaderNav = {
  /** Absent tant qu'aucun kit n'a été généré : les liens qui en dépendent sont alors inertes. */
  brandKitId: string | null;
  initials: string;
  displayName: string;
  workspaces: Workspace[];
  signOutAction: () => void | Promise<void>;
};

/*
 * L'entrée active est une pastille de lin plein ; les autres sont nues.
 *
 * `min-h-[44px]` sur les deux : l'en-tête fait 72px de haut, mais la cible
 * tactile, elle, est le lien — et le chantier d'acquisition a déjà trouvé 45
 * cibles sous le minimum. On n'en ajoute pas une quarante-sixième ici.
 */
function navClass(active: boolean): string {
  const base =
    "inline-flex min-h-[44px] items-center gap-2 rounded-pill px-3 transition-colors";
  return active
    ? `${base} bg-card font-semibold text-ink`
    : `${base} text-ink-2 hover:bg-card hover:text-ink`;
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

  const links: Array<{
    label: string;
    href: string | null;
    active: boolean;
    icon: ReactNode;
  }> = [
    { label: "Home", href: "/app", active: pathname === "/app", icon: <HomeGlyph /> },
    {
      label: "Brand kit",
      href: kitHref,
      active: pathname.startsWith("/app/brand-kits"),
      icon: <SectionGlyph section="identity" />,
    },
    {
      label: "Content",
      href: brandKitId ? "/app/content" : null,
      active: pathname.startsWith("/app/content"),
      icon: <SectionGlyph section="words" />,
    },
    // LOT 7 shipped: the slot is live. It still needs a kit, like Content --
    // Check reads the six rules against her copy inside the paid space.
    {
      label: "Check",
      href: brandKitId ? "/app/check" : null,
      active: pathname.startsWith("/app/check"),
      icon: <CheckGlyph size="sm" color="currentColor" />,
    },
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

      <nav aria-label="Main" className="flex items-center gap-1.5 text-ui max-md:hidden">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={navClass(link.active)}
            >
              <span className="flex-none">{link.icon}</span>
              {link.label}
            </Link>
          ) : (
            // Pas encore disponible (pas de kit, ou route pas encore construite) :
            // le lien existe visuellement mais ne mène nulle part.
            <span
              key={link.label}
              aria-disabled="true"
              className="inline-flex min-h-[44px] items-center gap-2 px-3 text-ink-3"
            >
              <span className="flex-none">{link.icon}</span>
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
