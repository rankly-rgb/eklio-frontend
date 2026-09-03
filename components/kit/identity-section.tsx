import { BrandCanvas } from "@/components/kit/brand-canvas";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * Identity (Lot 3) — applied / specified / actionable.
 *
 * "Applied" is a live CSS approximation of the wordmark (heading font, real
 * ink, on paper) — not the rendered SVG itself, which is a server round
 * trip. Same technique the old "Typography" section already used for the
 * headline: always in sync with the current tokens, no fingerprint/caching
 * concerns on a page that just wants to SHOW the mark, not deliver a file.
 * The real files are what "actionable" hands over.
 */
export function IdentitySection({
  brandKitId,
  practiceName,
  tokens,
}: {
  brandKitId: string;
  practiceName: string | null;
  tokens: SitePreviewTokens | null;
}) {
  if (!tokens || !practiceName) {
    return (
      <p className="text-body text-ink-2">
        Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
      </p>
    );
  }

  const words = practiceName.trim().split(/\s+/).filter(Boolean);
  const monogram =
    words.length <= 1 ? (words[0]?.[0] ?? "").toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();

  return (
    <div className="flex flex-col gap-8">
      {/* ── Applied ─────────────────────────────────────────────────────── */}
      <BrandCanvas tokens={tokens} className="flex flex-wrap items-center gap-10 p-8">
        <span
          style={{
            fontFamily: "var(--brand-heading)",
            fontWeight: 500,
            fontSize: 48,
            letterSpacing: "-0.02em",
            color: "var(--brand-dark)",
          }}
        >
          {practiceName}
        </span>
        <span
          className="flex h-16 w-16 flex-none items-center justify-center rounded-full"
          style={{ background: "var(--brand-primary)", color: "var(--brand-cta-ink)" }}
        >
          <span style={{ fontFamily: "var(--brand-heading)", fontWeight: 600, fontSize: 26 }}>
            {monogram}
          </span>
        </span>
      </BrandCanvas>

      {/* ── Specified ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-helper leading-prose text-ink-2">
          <span className="text-ink">Wordmark</span> — set in {tokens.heading_font}, in four inks: dark
          (for a light background), light (for a dark one), and solid black or white for a single-colour
          print run.
        </p>
        <p className="text-helper leading-prose text-ink-2">
          <span className="text-ink">Monogram</span> — {monogram}, in three treatments: on your primary
          colour, on paper, and transparent.
        </p>
      </div>

      {/* ── Actionable ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5">
        <AssetDownloadButton
          brandKitId={brandKitId}
          assetKey="wordmark_svg_dark"
          className="rounded-pill border border-line px-[22px] py-2 text-ui text-ink hover:bg-card"
        >
          Download wordmark
        </AssetDownloadButton>
        <AssetDownloadButton
          brandKitId={brandKitId}
          assetKey="monogram_svg"
          className="rounded-pill border border-line px-[22px] py-2 text-ui text-ink hover:bg-card"
        >
          Download monogram
        </AssetDownloadButton>
        <a
          href="#kit-assets"
          className="text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          See every identity file
        </a>
      </div>
    </div>
  );
}
