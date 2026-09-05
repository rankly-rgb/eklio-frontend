"use client";

import { BrandCanvas } from "@/components/kit/brand-canvas";
import { PhotoSlot } from "@/components/kit/photo-slot";
import { KitMenu } from "@/components/kit/kit-menu";
import { StateTile } from "@/components/kit/state-tile";
import { MonoLabel } from "@/components/ui/mono-label";
import { useBrandFont } from "@/components/preview/use-brand-font";
import type { PracticeDetails, SitePreviewTokens } from "@/lib/site/types";
import type { AssetStats } from "@/lib/data/asset-stats";

const ROLE_ORDER = ["primary", "secondary", "accent", "paper", "light_neutral", "dark_neutral"] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/*
 * The kit page's header (Lot 3).
 *
 * The section header — practice name, then nothing but her direction name
 * beneath it — carries every app control that used to sit inline (tier/
 * comp-access, Switch direction, Edit your brief, Delete this brand kit)
 * behind <KitMenu>, far right.
 *
 * Below it: her wordmark on a full-width canvas, the still frame the
 * delivery ceremony already ends on, with "YOUR BRAND, AS OF TODAY" in
 * mono beneath it; the six-colour band rule directly under the canvas
 * deliberately rhymes with that same screen; four real state tiles; her
 * practice card.
 */
export function KitHeader({
  brandKitId,
  projectId,
  practiceName,
  directionName,
  tokens,
  colorLabels,
  practiceDetails,
  bookingUrl,
  stats,
  compAccess,
  heroImageUrl = null,
}: {
  brandKitId: string;
  projectId: string;
  practiceName: string | null;
  directionName: string;
  tokens: SitePreviewTokens | null;
  colorLabels: Record<string, string> | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  stats: AssetStats | null;
  compAccess: boolean;
  /**
   * The hero photograph's signed URL, or null for the gradient. This is the
   * ONLY thing Lot 5 changes about this component: <PhotoSlot> was built in
   * Session 2 to take exactly this, and it renders the same gradient block
   * with no source as it does today. No skeleton, no second loading pattern.
   */
  heroImageUrl?: string | null;
}) {
  useBrandFont(tokens?.google_fonts_url ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {practiceName ?? "Your brand"}
          </h1>
          <MonoLabel tracking="16" className="mt-2" as="p">
            {directionName}
          </MonoLabel>
        </div>
        <KitMenu brandKitId={brandKitId} projectId={projectId} compAccess={compAccess} />
      </div>

      {tokens ? (
        <>
          {/*
            * The hero band — the one image ever shown large and full-bleed.
            * Gradient until Lot 5 generates one, photograph after, and the
            * transition between them is <PhotoSlot>'s own 400ms cross-fade
            * from the same block rather than from empty space.
            */}
          <PhotoSlot
            tokens={tokens}
            src={heroImageUrl}
            alt={heroImageUrl ? `A photograph in ${practiceName ?? "your"} brand's colors` : ""}
            className="aspect-[3/2] w-full rounded-card max-md:aspect-[4/3]"
          />

          <BrandCanvas tokens={tokens} className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <span
              style={{
                fontFamily: "var(--brand-heading)",
                fontWeight: 500,
                fontSize: 46,
                letterSpacing: "-0.02em",
                color: "var(--brand-dark)",
              }}
            >
              {practiceName ?? "Your brand"}
            </span>
            <span
              className="font-mono text-mono uppercase tracking-mono-14"
              style={{ color: "var(--brand-dark)", opacity: 0.6 }}
            >
              Your brand, as of today
            </span>
          </BrandCanvas>

          <div className="flex flex-col gap-2">
            <div className="flex h-2 overflow-hidden rounded-pill" aria-hidden="true">
              {ROLE_ORDER.map((role) => (
                <span
                  key={role}
                  className="flex-1"
                  style={{ background: tokens[role as keyof SitePreviewTokens] as string }}
                />
              ))}
            </div>
            {colorLabels ? (
              <p className="text-helper text-ink-3">
                {ROLE_ORDER.filter((role) => colorLabels[role]).map((role, index) => (
                  <span key={role}>
                    {index > 0 ? " · " : ""}
                    {colorLabels[role]}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        <StateTile label="Brand assets">{stats ? stats.currentCount : "—"}</StateTile>
        <StateTile label="Downloadable files">{stats ? stats.downloadableFileCount : "—"}</StateTile>
        <StateTile label="Last updated">{stats ? formatDate(stats.lastUpdated) : "—"}</StateTile>
        <StateTile label="Status">
          {stats && stats.staleKeys.length > 0 ? (
            <a
              href={`/app/brand-kits/${brandKitId}/assets?status=needs-rebuild`}
              className="text-ink underline decoration-[var(--accent)] underline-offset-4 hover:text-accent"
            >
              {stats.staleKeys.length} {stats.staleKeys.length === 1 ? "asset" : "assets"} need rebuilding
            </a>
          ) : (
            "Up to date"
          )}
        </StateTile>
      </div>

      {practiceDetails ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line p-5">
          <div className="min-w-0">
            <p className="text-body text-ink">
              {[practiceDetails.practitioner_name, practiceDetails.license_label]
                .filter(Boolean)
                .join(", ") || (practiceName ?? "")}
            </p>
            <p className="mt-1 text-helper text-ink-2">
              {[
                [practiceDetails.city, practiceDetails.state].filter(Boolean).join(", "),
                practiceDetails.email,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {bookingUrl ? (
              <p className="mt-1 truncate font-mono text-mono tracking-mono-url text-ink-3">{bookingUrl}</p>
            ) : null}
          </div>

          {/*
           * The one app-level element her primary colour is allowed on
           * (design law, LOT 1 of the Sept 2 chantier) — unchanged by this
           * lot's header redesign, just relocated here since the section
           * header row above it now carries nothing but her direction name.
           */}
          <div className="flex flex-none items-center gap-3">
            <a
              href={`/api/brand-kits/${brandKitId}/pdf`}
              className="inline-flex h-10 items-center whitespace-nowrap rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
            >
              Download PDF
            </a>
            <a
              href={`/app/brand-kits/${brandKitId}/site`}
              className="inline-flex h-10 items-center whitespace-nowrap rounded-pill px-[30px] text-ui font-semibold hover:opacity-90"
              style={{ background: tokens?.primary, color: tokens?.cta_ink }}
            >
              Edit your site
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
