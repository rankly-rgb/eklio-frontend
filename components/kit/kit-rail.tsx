"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { SectionGlyph } from "@/components/ui/glyphs";
import { MonoLabel } from "@/components/ui/mono-label";
import { PhotoSlot } from "@/components/kit/photo-slot";
import { KIT_SECTIONS, sectionHref } from "@/lib/kit/sections";
import { initialsFrom } from "@/lib/app/header-context";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * The kit's section switcher — a persistent rail down the left.
 *
 * ⚠ THE ACTIVE ITEM COMES FROM THE ROUTER. The list this replaces kept it in
 * a `useState` seeded to "Your assets" that only moved on click, so on
 * desktop the highlight sat on a section that wasn't on screen. There is
 * nothing left to guess here: `useSelectedLayoutSegment()` returns the
 * segment the router is rendering, and exactly one item can match it.
 *
 * ONE `<nav>`, not two. Below 900px the same list turns into a horizontal,
 * scrollable strip pinned under the header band — a media query on the same
 * element, so there is never a second copy of these landmarks in the tree.
 * It is deliberately NOT a hamburger: the sections are this page's spine,
 * and hiding a spine costs a tap on every single navigation.
 *
 * The furniture around the list — the monogram, the card, Settings and Help
 * — is desktop rail furniture, and it is hidden below 900px rather than
 * stacked above the section she came to read. The account menu in the app
 * header already carries Settings and Help there.
 */
export function KitRail({
  brandKitId,
  practiceName,
  directionName,
  tokens,
  photoUrl,
}: {
  brandKitId: string;
  practiceName: string | null;
  directionName: string;
  tokens: SitePreviewTokens | null;
  photoUrl: string | null;
}) {
  const segment = useSelectedLayoutSegment();

  return (
    <div className="sticky top-6 flex w-[212px] flex-none flex-col gap-6 self-start max-[900px]:static max-[900px]:w-full">
      {/* ── Her mark, in her colour ──────────────────────────────────────
       *
       * The one place in this rail that carries her primary: a monogram IS a
       * brand mark, shown inside a brand context, and it does not spend the
       * screen's single allowance for an app-level element in her colour.
       */}
      <div className="flex items-center gap-3 max-[900px]:hidden">
        {tokens ? (
          <span
            aria-hidden="true"
            className="flex size-10 flex-none items-center justify-center rounded-card font-display text-ui font-medium"
            style={{ background: tokens.primary, color: tokens.cta_ink }}
          >
            {initialsFrom(practiceName, null)}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-ui font-semibold text-ink">
            {practiceName ?? "Your brand"}
          </p>
          <MonoLabel tracking="08" className="mt-0.5 block truncate">
            {directionName}
          </MonoLabel>
        </div>
      </div>

      <nav
        aria-label="Brand kit sections"
        className="flex flex-col gap-0.5 max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-20 max-[900px]:-mx-[var(--gutter-sm)] max-[900px]:flex-row max-[900px]:gap-2 max-[900px]:overflow-x-auto max-[900px]:border-b max-[900px]:border-line max-[900px]:bg-bg max-[900px]:px-[var(--gutter-sm)] max-[900px]:py-3"
      >
        {KIT_SECTIONS.map((section) => {
          const current = section.segment === segment;
          return (
            <Link
              key={section.id}
              href={sectionHref(brandKitId, section)}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-pill px-3 py-2 text-ui transition-colors max-[900px]:flex-none max-[900px]:border max-[900px]:border-line ${
                current
                  ? "bg-card font-semibold text-ink max-[900px]:border-ink"
                  : "text-ink-2 hover:bg-card hover:text-ink"
              }`}
            >
              <SectionGlyph section={section.id} />
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4 max-[900px]:hidden">
        {/* ── Eklio's own card ─────────────────────────────────────────────
         *
         * ⚠ NOT AN UPSELL. She has already paid; a "grow with Eklio" panel
         * in a paid space is a tax on the thing she bought. So: one
         * photograph, one line in Eklio's voice — this is where that voice
         * belongs, rather than among her numbers in the band — and exactly
         * one real link, which leads OUT of Eklio on purpose.
         */}
        <div className="overflow-hidden rounded-card border border-line">
          {tokens ? (
            <PhotoSlot
              tokens={tokens}
              src={photoUrl}
              alt=""
              className="aspect-[4/3] w-full"
            />
          ) : null}
          <div className="flex flex-col gap-3 p-4">
            <p className="text-helper leading-prose text-ink-2">
              A brand is a set of decisions. Yours are made and written down —
              so the next person who touches your work starts from them.
            </p>
            <Link
              href={`/app/brand-kits/${brandKitId}/handoff`}
              className="text-ui text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
            >
              Hand off to a designer →
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 border-t border-line pt-4">
          <Link
            href="/app/settings"
            className="rounded-pill px-3 py-1.5 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Settings
          </Link>
          <a
            href="mailto:hello@eklio.com"
            className="rounded-pill px-3 py-1.5 text-ui text-ink-2 hover:bg-card hover:text-ink"
          >
            Help &amp; support
          </a>
        </div>
      </div>
    </div>
  );
}
