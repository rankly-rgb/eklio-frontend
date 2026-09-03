"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/button";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { brandCanvasVariables } from "@/lib/kit/canvas-tokens";
import { previewModelFromDirection, type Direction } from "@/lib/brand/shapes";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * The delivery moment (Lot 2) — reachable exactly once, right after a
 * direction is selected on a paid kit (`app/app/brand-kits/[id]/delivered/
 * page.tsx` marks it seen server-side and redirects everywhere else). A
 * designer putting the work on the table: no congratulations, no confetti.
 *
 * Every beat reuses the app's own four motion primitives (`app/globals.css`,
 * "§3 : quatre mouvements, pas un de plus") — `.reveal-rise` with
 * `--stagger-index` set per element, exactly how the reveal ceremony already
 * stages its cards 120ms apart (`--stagger-reveal`). No new keyframes.
 * `prefers-reduced-motion` needs no handling here either: the same global
 * media query that already collapses every animation in the app to ~0
 * collapses this one too — see `app/globals.css`.
 *
 * `brandCanvasVariables(tokens)` (not the `<BrandCanvas>` wrapper — that
 * component's hairline/radius/shadow chrome is a framed-card treatment,
 * wrong for a full-viewport moment) gives the page her paper background, her
 * ink, and her body font, scoped to this page only.
 */

const SURFACE_KEYS = ["post_statement_1080", "email_signature_png", "business_card_front"] as const;

export function DeliveryCeremony({
  brandKitId,
  practiceName,
  direction,
  tokens,
}: {
  brandKitId: string;
  practiceName: string | null;
  direction: Direction;
  tokens: SitePreviewTokens;
}) {
  const [wordmarkUrl, setWordmarkUrl] = useState<string | null>(null);
  const [surfaceUrls, setSurfaceUrls] = useState<Partial<Record<(typeof SURFACE_KEYS)[number], string>>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchSignedUrl(key: string): Promise<string | null> {
      try {
        const response = await fetch(`/api/brand-kits/${brandKitId}/assets/${key}`, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { url?: string } | null;
        return body?.url ?? null;
      } catch {
        return null;
      }
    }

    void fetchSignedUrl("wordmark_svg_dark").then((url) => {
      if (!cancelled) setWordmarkUrl(url);
    });
    for (const key of SURFACE_KEYS) {
      void fetchSignedUrl(key).then((url) => {
        if (!cancelled && url) setSurfaceUrls((current) => ({ ...current, [key]: url }));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [brandKitId]);

  const model = previewModelFromDirection(direction, practiceName);
  const canvasVars = brandCanvasVariables(tokens);

  const bands = [
    "var(--brand-primary)",
    "var(--brand-secondary)",
    "var(--brand-accent)",
    "var(--brand-paper)",
    "var(--brand-light)",
    "var(--brand-dark)",
  ];

  return (
    <main
      className="route-enter flex min-h-[calc(100dvh-var(--gutter))] flex-col items-center justify-center gap-9 px-8 py-16 text-center"
      style={{ ...canvasVars, background: "var(--brand-paper)", color: "var(--brand-dark)" }}
    >
      <div className="reveal-rise flex h-14 items-center" style={{ "--stagger-index": 0 } as CSSProperties}>
        {wordmarkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wordmarkUrl} alt={practiceName ?? "Your brand"} className="h-full w-auto" />
        ) : (
          <p className="font-display text-card-title font-medium" style={{ fontFamily: "var(--brand-heading)" }}>
            {practiceName ?? "Your brand"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5" role="img" aria-label="Your six brand colors">
        {bands.map((color, index) => (
          <span
            key={color}
            aria-hidden="true"
            className="reveal-rise h-2 w-14 rounded-pill border"
            style={
              {
                background: color,
                borderColor: "color-mix(in srgb, var(--brand-dark) 18%, transparent)",
                "--stagger-index": index + 1,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="reveal-rise grid w-full max-w-[900px] grid-cols-4 gap-5 max-md:grid-cols-2"
        style={{ "--stagger-index": 9 } as CSSProperties}
      >
        <div className="overflow-hidden rounded-card border" style={{ borderColor: "color-mix(in srgb, var(--brand-dark) 18%, transparent)" }}>
          <BrandPreview model={model} variant="thumbnail" shape="site" />
        </div>
        {SURFACE_KEYS.map((key) => (
          <div
            key={key}
            className="aspect-square overflow-hidden rounded-card border"
            style={{ borderColor: "color-mix(in srgb, var(--brand-dark) 18%, transparent)" }}
          >
            {surfaceUrls[key] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={surfaceUrls[key]} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>

      <p
        className="reveal-rise text-pretty text-card-title font-medium leading-card"
        style={{ "--stagger-index": 14, fontFamily: "var(--brand-body)" } as CSSProperties}
      >
        {`${practiceName ?? "Your brand"} — your brand, as of today.`}
      </p>

      <div
        className="reveal-rise flex items-center gap-5"
        style={{ "--stagger-index": 16 } as CSSProperties}
      >
        <ButtonLink href={`/app/brand-kits/${brandKitId}`} variant="primary">
          Open your brand kit
        </ButtonLink>
        <AssetDownloadButton
          brandKitId={brandKitId}
          assetKey="brand_kit_zip"
          className="text-ui opacity-70 hover:underline hover:decoration-current hover:underline-offset-4 [color:var(--brand-dark)]"
        >
          Download everything
        </AssetDownloadButton>
      </div>
    </main>
  );
}
