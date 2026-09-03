import { BrandCanvas } from "@/components/kit/brand-canvas";
import { MonoLabel } from "@/components/ui/mono-label";
import type { Direction } from "@/lib/brand/shapes";
import type { SitePreviewTokens } from "@/lib/site/types";

/**
 * Type (Lot 3) — a rendered specimen at real sizes, using her OWN copy —
 * never lorem ipsum. Three sizes from the same scale the site actually
 * uses: the hero headline (largest), the hero subhead, and a body
 * paragraph from her about excerpt.
 */
export function TypeSection({
  direction,
  tokens,
}: {
  direction: Direction;
  tokens: SitePreviewTokens | null;
}) {
  if (!tokens) {
    return (
      <p className="text-body text-ink-2">
        Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
      </p>
    );
  }

  return (
    <BrandCanvas tokens={tokens} className="flex flex-col gap-6 p-8">
      <div
        style={{
          fontFamily: "var(--brand-heading)",
          fontWeight: 500,
          fontSize: 44,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: "var(--brand-dark)",
        }}
      >
        {direction.hero.headline}
      </div>
      <div
        style={{
          fontFamily: "var(--brand-body)",
          fontSize: 20,
          lineHeight: 1.4,
          color: "var(--brand-dark)",
          opacity: 0.85,
          maxWidth: 560,
        }}
      >
        {direction.hero.subhead}
      </div>
      <div
        style={{
          fontFamily: "var(--brand-body)",
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--brand-dark)",
          maxWidth: 520,
        }}
      >
        {direction.about_excerpt}
      </div>
      <div className="brand-canvas-static mt-2 flex gap-8">
        <MonoLabel tracking="14">{`Headings · ${tokens.heading_font}`}</MonoLabel>
        <MonoLabel tracking="14">{`Body · ${tokens.body_font}`}</MonoLabel>
      </div>
    </BrandCanvas>
  );
}
