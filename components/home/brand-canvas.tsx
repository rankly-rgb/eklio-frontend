"use client";

import { PhotoSlot } from "@/components/kit/photo-slot";
import { StatGlyph } from "@/components/ui/glyphs";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { solveOverlayScrim } from "@/lib/brand/color";
import { siteTokenVariables } from "@/lib/site/tokens";
import type { HomeStats } from "@/lib/data/home";
import type { SiteHero, SitePreviewTokens } from "@/lib/site/types";

/*
 * ── THE HERO CANVAS ──────────────────────────────────────────────────────
 *
 * Her site's actual hero at full fidelity, in a rounded card with NO browser
 * chrome and no URL bar. Production draws one; the mockup drops it, and the
 * mockup wins. What is left is not a screenshot of a browser — it is her hero,
 * composed — so the counts along the bottom are set in EKLIO's faces, not
 * hers: her typography is what her own copy is set in, and a count of her
 * brand assets is Eklio talking about her kit, not her website saying
 * anything.
 *
 * The colour roles are the site editor's own `--s-*` custom properties
 * (`siteTokenVariables`), the same ones `components/site/mockup.tsx` sets, so
 * this reads as the same site rather than a second opinion of it.
 *
 * The gradient IS the seam: `<PhotoSlot>` draws its deterministic gradient
 * until a current photograph exists, never a second loading pattern.
 */
export function BrandCanvas({
  practiceName,
  tokens,
  hero,
  photoUrl,
  pages,
  toneKeywords,
  stats,
}: {
  practiceName: string | null;
  tokens: SitePreviewTokens;
  hero: SiteHero;
  photoUrl: string | null;
  /** Her real, enabled page labels, in `envelope.preview.pages` order. */
  pages: string[];
  /** Her direction's three tone words — the overlay, or `[]` for no overlay. */
  toneKeywords: string[];
  stats: HomeStats;
}) {
  const ready = useBrandFont(tokens.google_fonts_url);
  const practice = practiceName ?? "Your practice";

  return (
    <div
      className="brand-preview overflow-hidden rounded-card border border-line"
      style={siteTokenVariables(tokens)}
    >
      <div
        className="flex items-center gap-6 max-md:gap-3"
        style={{
          padding: "clamp(14px, 2.4vw, 20px) clamp(20px, 3.4vw, 26px)",
          background: "var(--s-paper)",
          borderBottom: "1px solid color-mix(in srgb, var(--s-dark) 12%, transparent)",
        }}
      >
        <span
          className="min-w-0 truncate transition-opacity duration-[var(--dur-font)]"
          style={{
            fontFamily: "var(--s-heading)",
            fontWeight: 600,
            fontSize: "clamp(15px, 2.6vw, 18px)",
            letterSpacing: "-0.01em",
            color: "var(--s-primary-text)",
            opacity: ready ? 1 : 0,
          }}
        >
          {practice}
        </span>
        <div className="flex-1" />
        {/* Her real page labels — the same tabs `components/site/mockup.tsx`
            renders — not invented placeholders. */}
        <div
          className="flex flex-none items-center gap-5 whitespace-nowrap max-md:hidden"
          style={{ fontFamily: "var(--s-body)", fontSize: 13, color: "var(--s-dark)" }}
        >
          {pages.map((label) => (
            <span key={label} style={{ opacity: 0.65 }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-stretch max-md:flex-col" style={{ background: "var(--s-paper)" }}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex flex-1 flex-col justify-center transition-opacity duration-[var(--dur-font)]"
            style={{
              padding: "clamp(20px, 3vw, 34px) clamp(20px, 3.4vw, 30px)",
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
                fontSize: "clamp(24px, 3.4vw, 38px)",
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
                  fontSize: "clamp(13px, 1.4vw, 15px)",
                  lineHeight: 1.55,
                  color: "var(--s-dark)",
                  opacity: 0.86,
                  maxWidth: 340,
                }}
              >
                {hero.subhead}
              </p>
            ) : null}

            <div
              className="mt-5 inline-flex w-fit items-center gap-2.5 rounded-pill"
              style={{
                fontFamily: "var(--s-body)",
                fontWeight: 700,
                fontSize: 14,
                height: 44,
                paddingInline: "clamp(18px, 2.4vw, 24px)",
                background: "var(--s-primary)",
                color: "var(--s-cta-ink)",
              }}
            >
              {hero.cta_label}
              <span aria-hidden="true">&rarr;</span>
            </div>
          </div>

          <StatsRow stats={stats} />
        </div>

        <div className="relative w-[41%] flex-none max-md:aspect-video max-md:w-full">
          <PhotoSlot
            tokens={{ primary: tokens.primary, dark_neutral: tokens.dark_neutral }}
            src={photoUrl}
            className="h-full w-full"
          />
          <ToneOverlay words={toneKeywords} scrimHex={tokens.dark_neutral} />
        </div>
      </div>
    </div>
  );
}

/** The overlay's text. Light by construction, so the scrim is solved for it. */
const OVERLAY_INK = "#FFFFFF";

/*
 * Her three tone words, stacked, over the photograph.
 *
 * ⚠ THE SCRIM IS SOLVED, NOT MEASURED — and against the WORST CASE, not
 * against this picture. `solveOverlayScrim` blends her `dark_neutral` over a
 * white pixel and climbs until white text clears 4.5:1, so the ratio it
 * reports is a floor that any real photograph (darker than white) can only
 * beat. The render pipeline's `measureRegionLuminance` does the honest,
 * measured version, but it decodes a Buffer through `sharp` and nothing
 * persists what it computes — on a read path it would mean fetching and
 * decoding the photograph on every load of this screen. See HOME_V3_MAPPING.md.
 */
function ToneOverlay({ words, scrimHex }: { words: string[]; scrimHex: string }) {
  if (words.length === 0) return null;
  const scrim = solveOverlayScrim(scrimHex, OVERLAY_INK);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
        style={{
          background: `linear-gradient(to bottom, transparent, color-mix(in srgb, ${scrimHex} ${Math.round(
            scrim.alpha * 100
          )}%, transparent))`,
        }}
      />
      <p
        className="pointer-events-none absolute bottom-[11%] right-[9%] flex flex-col items-end gap-1 text-right font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: "var(--tracking-mono-18)",
          color: OVERLAY_INK,
        }}
      >
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </p>
    </>
  );
}

/*
 * The three tiles, hairline-divided, each with its icon on the value's line.
 *
 * The third one is the rebuild date. The mockup puts a percentage of an
 * invented quality metric here instead; Eklio computes no such number, and
 * `app/__tests__/forbidden-metrics.test.ts` fails if its name comes back —
 * including from a comment like this one, which is why this comment does not
 * write it. A tile whose value is null drops out and the row closes up: two
 * tiles, still composed.
 */
function StatsRow({ stats }: { stats: HomeStats }) {
  const tiles: Array<{ value: string; label: string; icon: "files" | "categories" | "clock" }> = [
    { value: String(stats.assetCount), label: "Brand assets", icon: "files" },
    { value: String(stats.pagesReady), label: "Pages ready", icon: "categories" },
  ];

  if (stats.lastRebuiltAt) {
    tiles.push({ value: rebuiltLabel(stats.lastRebuiltAt), label: "Since rebuild", icon: "clock" });
  }

  return (
    <div
      className="flex items-stretch"
      style={{ borderTop: "1px solid color-mix(in srgb, var(--s-dark) 12%, transparent)" }}
    >
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 max-md:px-4"
          style={
            index === 0
              ? undefined
              : { borderLeft: "1px solid color-mix(in srgb, var(--s-dark) 12%, transparent)" }
          }
        >
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-card-title font-medium leading-tight tracking-h1 text-ink">
              {tile.value}
            </span>
            <span className="ml-auto text-ink-3">
              <StatGlyph stat={tile.icon} />
            </span>
          </div>
          <span className="truncate text-meta leading-body text-ink-2">{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * `2026-09-10T…` → `2d`, the age of the most recent current asset.
 *
 * A duration, never a quality: this says when the kit was last rebuilt, which
 * is a timestamp the manifest already carries, not a judgement about it.
 */
function rebuiltLabel(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}
