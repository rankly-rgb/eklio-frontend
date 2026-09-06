"use client";

import { BrowserFrame } from "@/components/ui/browser-frame";
import { PhotoSlot } from "@/components/kit/photo-slot";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { domainFor } from "@/lib/brand/derive";
import { siteTokenVariables } from "@/lib/site/tokens";
import type { SiteHero, SitePreviewTokens } from "@/lib/site/types";

/*
 * ── THE HERO OBJECT ──────────────────────────────────────────────────────
 *
 * Her site's actual hero, at full fidelity: the REAL tokens the site editor
 * renders with (`siteTokenVariables`, `--s-*`, the same custom properties
 * `components/site/mockup.tsx` sets), not the five-role palette the
 * pre-purchase preview uses. The sizes and color roles below are the same
 * ones `components/site/mockup-section.tsx`'s `Hero()` already draws --
 * headline 42px on `--s-dark`, subhead at 0.86 opacity, the button on
 * `--s-primary` with `--s-cta-ink` -- so this reads as the same site, not a
 * second opinion of it. What that one doesn't have is a photograph: the real
 * site is copy she pastes elsewhere, and this screen is the one place her
 * generated photograph and her real copy sit together.
 *
 * The gradient IS the seam, same as everywhere else in the product:
 * `<PhotoSlot>` renders it until a current photograph exists, never a second
 * loading pattern.
 */
export function BrandCanvas({
  practiceName,
  tokens,
  hero,
  photoUrl,
  pages,
}: {
  practiceName: string | null;
  tokens: SitePreviewTokens;
  hero: SiteHero;
  photoUrl: string | null;
  /** Her real, enabled page labels, in `envelope.preview.pages` order. */
  pages: string[];
}) {
  const ready = useBrandFont(tokens.google_fonts_url);
  const practice = practiceName ?? "Your practice";

  return (
    <div className="brand-preview" style={siteTokenVariables(tokens)}>
      <BrowserFrame
        size="full"
        domain={domainFor(practiceName)}
        className="aspect-[16/10] flex flex-col max-md:aspect-auto"
      >
        <div
          className="flex flex-none items-center gap-6 max-md:gap-3"
          style={{
            padding: "clamp(14px, 3vw, 20px) clamp(20px, 5vw, 36px)",
            background: "var(--s-paper)",
            borderBottom: "1px solid color-mix(in srgb, var(--s-dark) 12%, transparent)",
          }}
        >
          <span
            className="min-w-0 truncate transition-opacity duration-[var(--dur-font)]"
            style={{
              fontFamily: "var(--s-heading)",
              fontWeight: 600,
              fontSize: "clamp(15px, 3.5vw, 19px)",
              letterSpacing: "-0.01em",
              color: "var(--s-primary-text)",
              opacity: ready ? 1 : 0,
            }}
          >
            {practice}
          </span>
          <div className="flex-1" />
          {/* Her real page labels -- the same tabs `components/site/mockup.tsx`
              renders -- not invented placeholders. */}
          <div
            className="flex flex-none items-center gap-5 whitespace-nowrap max-md:hidden"
            style={{ fontFamily: "var(--s-body)", fontSize: 13, color: "var(--s-dark)" }}
          >
            {pages.map((label) => (
              <span key={label} style={{ opacity: 0.6 }}>
                {label}
              </span>
            ))}
          </div>
          <div
            className="inline-flex flex-none items-center whitespace-nowrap rounded-pill max-md:hidden"
            style={{
              height: 32,
              paddingInline: "clamp(14px, 3vw, 20px)",
              background: "var(--s-primary)",
              color: "var(--s-cta-ink)",
              fontFamily: "var(--s-body)",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {hero.cta_label}
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 items-stretch max-md:flex-col"
          style={{ background: "var(--s-paper)" }}
        >
          <div
            className="flex min-w-0 flex-1 flex-col justify-center transition-opacity duration-[var(--dur-font)]"
            style={{
              padding: "clamp(16px, 3vw, 28px) clamp(20px, 5vw, 36px)",
              opacity: ready ? 1 : 0,
            }}
          >
            {hero.overline ? (
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 11,
                  letterSpacing: "var(--tracking-mono-18)",
                  color: "var(--s-secondary-text)",
                }}
              >
                {hero.overline}
              </div>
            ) : null}

            <div
              className="text-pretty"
              style={{
                fontFamily: "var(--s-heading)",
                fontWeight: 500,
                fontSize: "clamp(24px, 4vw, 40px)",
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: "var(--s-dark)",
                marginTop: hero.overline ? 14 : 0,
              }}
            >
              {hero.headline}
            </div>

            {hero.subhead ? (
              <p
                className="mt-3"
                style={{
                  fontFamily: "var(--s-body)",
                  fontSize: "clamp(13px, 1.6vw, 16px)",
                  lineHeight: 1.6,
                  color: "var(--s-dark)",
                  opacity: 0.86,
                  maxWidth: 460,
                }}
              >
                {hero.subhead}
              </p>
            ) : null}

            <div
              className="mt-5 inline-flex w-fit items-center rounded-pill"
              style={{
                fontFamily: "var(--s-body)",
                fontWeight: 700,
                fontSize: 14,
                height: 44,
                paddingInline: "clamp(18px, 3vw, 26px)",
                background: "var(--s-primary)",
                color: "var(--s-cta-ink)",
              }}
            >
              {hero.cta_label}
            </div>
          </div>

          <div className="w-[38%] flex-none max-md:aspect-video max-md:w-full">
            <PhotoSlot
              tokens={{ primary: tokens.primary, dark_neutral: tokens.dark_neutral }}
              src={photoUrl}
              className="h-full w-full"
            />
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}
