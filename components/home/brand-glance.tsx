"use client";

import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { TONE_KEYWORD_SEPARATOR } from "@/lib/brand/shapes";
import type { Direction } from "@/lib/brand/shapes";

/*
 * "Brand at a glance" — four compact cards, each a count of something the
 * kit actually holds.
 *
 * ⚠ EVERY NUMBER HERE IS A LENGTH, NOT A RATING. The colours card counts the
 * palette's roles, the type card counts the pair, the imagery card counts
 * photographs that are current, the tone card prints her three words. None of
 * them is a score, and there is no fifth card summarising the other four.
 *
 * `Aa` renders in her display face, which is the point of that card — so this
 * is a client component for `useBrandFont`, the same loader the canvas uses.
 * Until the face arrives it shows in the fallback rather than reserving a
 * blank: the word is legible either way.
 */
export function BrandGlance({
  direction,
  imageryCount,
  viewKitHref,
}: {
  direction: Direction;
  imageryCount: number;
  viewKitHref: string;
}) {
  useBrandFont(direction.typography.google_fonts_url);

  const swatches = Object.values(direction.palette);

  return (
    <section aria-labelledby="brand-at-a-glance" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <MonoLabel tracking="16" as="h2" id="brand-at-a-glance">
          Brand at a glance
        </MonoLabel>
        <Link
          href={viewKitHref}
          className="-my-2 ml-auto inline-flex min-h-[44px] items-center text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          View brand kit &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
        <GlanceCard
          label="Colors"
          value={`${swatches.length} colors`}
          mark={
            <span aria-hidden="true" className="flex items-center">
              {swatches.map((hex, index) => (
                <span
                  key={hex}
                  className="size-5 rounded-pill border border-line"
                  style={{ background: hex, marginLeft: index === 0 ? 0 : -6 }}
                />
              ))}
            </span>
          }
        />

        <GlanceCard
          label="Fonts"
          value="2 typefaces"
          mark={
            <span
              aria-hidden="true"
              className="text-[26px] leading-none text-ink transition-opacity duration-[var(--dur-font)]"
              style={{ fontFamily: `"${direction.typography.heading_font}", Georgia, serif` }}
            >
              Aa
            </span>
          }
        />

        <GlanceCard
          label="Imagery"
          value={`${imageryCount} ${imageryCount === 1 ? "photograph" : "photographs"}`}
          mark={
            <span
              aria-hidden="true"
              className="block size-6 rounded-preview"
              style={{
                background: `linear-gradient(135deg, ${direction.palette.primary}, ${direction.palette.secondary})`,
              }}
            />
          }
        />

        <GlanceCard
          label="Tone"
          value={direction.tone_keywords.join(TONE_KEYWORD_SEPARATOR)}
          mark={
            <span
              aria-hidden="true"
              className="block h-[3px] w-6 rounded-pill"
              style={{ background: direction.palette.primary }}
            />
          }
        />
      </div>
    </section>
  );
}

function GlanceCard({
  label,
  value,
  mark,
}: {
  label: string;
  value: string;
  mark: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-line p-[14px_14px_12px]">
      <span className="flex h-6 items-center">{mark}</span>
      <span className="truncate text-ui font-medium leading-body text-ink">{label}</span>
      <span className="text-meta leading-body text-ink-2">{value}</span>
    </div>
  );
}
