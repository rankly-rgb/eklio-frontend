"use client";

import { BrandCanvas } from "@/components/kit/brand-canvas";
import { useBrandFont } from "@/components/preview/use-brand-font";
import type { PracticeDetails, SitePreviewTokens } from "@/lib/site/types";

const ROLE_ORDER = [
  "primary",
  "secondary",
  "accent",
  "paper",
  "light_neutral",
  "dark_neutral",
] as const;

/*
 * The Overview's package header — what she bought, shown rather than
 * described: the hero band, her wordmark on a full-width canvas (the still
 * frame the delivery ceremony ends on), the six-colour rail with its named
 * labels, and her practice card.
 *
 * This is the ONE place on the kit's screens where her typography and her
 * colours are rendered at size, and that is why it lives inside
 * `<BrandCanvas>`: everything outside the canvas is Eklio's chrome, in
 * Eklio's face. The band above the sections carries her kit's NAME; this
 * carries her brand.
 *
 * The four state tiles that used to sit here moved up into that band — three
 * of them were counts, and a count belongs where it is true on every
 * section, not on the one section that happens to be scrolled to.
 *
 * ⚠ THERE IS NO PHOTOGRAPH BAND HERE ANY MORE. Roughly 800px of `hero` slot
 * used to sit above this card, full-bleed, pushing every actionable element
 * below the fold — and a real photograph would have done that more
 * beautifully rather than less. The `hero` slot itself is untouched and
 * still generated: the home screen renders it inside a browser frame at a
 * sane size, which is where an image of her brand belongs. This is the
 * removal of one band, not of a photograph.
 */
export function PackageHeaderCard({
  practiceName,
  tokens,
  colorLabels,
  practiceDetails,
  bookingUrl,
  siteEditorHref,
}: {
  practiceName: string | null;
  tokens: SitePreviewTokens | null;
  colorLabels: Record<string, string> | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  siteEditorHref: string;
}) {
  useBrandFont(tokens?.google_fonts_url ?? null);

  return (
    <div className="flex flex-col gap-6">
      {tokens ? (
        <>
          <BrandCanvas
            tokens={tokens}
            className="flex flex-col items-center gap-3 px-8 py-16 text-center"
          >
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
              <p className="mt-1 truncate font-mono text-mono tracking-mono-url text-ink-3">
                {bookingUrl}
              </p>
            ) : null}
          </div>

          {/*
           * The one app-level element her primary colour is allowed on: the
           * primary action of the section on show. The band's `Download
           * everything` is deliberately in Eklio's ink instead, so there is
           * still exactly one of these per screen.
           */}
          <a
            href={siteEditorHref}
            className="inline-flex h-10 flex-none items-center whitespace-nowrap rounded-pill px-[30px] text-ui font-semibold hover:opacity-90"
            style={{ background: tokens?.primary, color: tokens?.cta_ink }}
          >
            Edit your site
          </a>
        </div>
      ) : null}
    </div>
  );
}
