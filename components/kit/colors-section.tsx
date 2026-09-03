"use client";

import { useState } from "react";
import { BrandCanvas } from "@/components/kit/brand-canvas";
import { MonoLabel } from "@/components/ui/mono-label";
import { createClient } from "@/lib/supabase/client";
import { siteSpecFixContrast } from "@/lib/site/rpc";
import { contrastSummary, isBelowAa, pairNote, pairReading } from "@/lib/site/contrast";
import type { ContrastReport, SitePreviewTokens } from "@/lib/site/types";

/*
 * The Colors section (Lot 3) — applied / specified / actionable, in that
 * order: a labelled-region canvas showing every role in place, the six
 * swatches with their one-line jobs, then the seven contrast pairs with a
 * live Fix action.
 *
 * The Fix action calls `site_spec_fix_contrast` directly (not through
 * `useSiteEditor`, which is the full site-editor hook this page doesn't
 * otherwise need) and re-renders from the RETURNED envelope, never a
 * patched-in-place pair — same rule `components/site/contrast-section.tsx`
 * already documents: a fix rewrites one token, and every pair sharing that
 * token moves with it, sometimes the wrong way.
 */
export function ColorsSection({
  brandKitId,
  initialTokens,
  initialContrast,
}: {
  brandKitId: string;
  initialTokens: SitePreviewTokens | null;
  initialContrast: ContrastReport | null;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [contrast, setContrast] = useState(initialContrast);
  const [fixing, setFixing] = useState<string | null>(null);

  if (!tokens) {
    return (
      <p className="text-body text-ink-2">
        Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
      </p>
    );
  }

  async function fixPair(pairId: string) {
    setFixing(pairId);
    try {
      const supabase = createClient();
      const result = await siteSpecFixContrast(supabase, brandKitId, pairId);
      if (result.ok) {
        setTokens(result.data.preview.tokens);
        setContrast(result.data.contrast);
      }
    } finally {
      setFixing(null);
    }
  }

  const roles: { key: keyof typeof ROLE_LABEL; hex: string }[] = [
    { key: "primary", hex: tokens.primary },
    { key: "secondary", hex: tokens.secondary },
    { key: "accent", hex: tokens.accent },
    { key: "paper", hex: tokens.paper },
    { key: "light_neutral", hex: tokens.light_neutral },
    { key: "dark_neutral", hex: tokens.dark_neutral },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* ── Applied: a labelled small page ─────────────────────────────── */}
      <LabeledRegionCanvas tokens={tokens} />

      {/* ── Specified: the six swatches ─────────────────────────────────── */}
      <div className="w-site-mock max-w-full">
        <div className="grid grid-cols-6">
          {roles.map(({ key, hex }) => (
            <div
              key={key}
              className="h-24"
              style={{
                background: hex,
                boxShadow:
                  key === "paper" || key === "light_neutral"
                    ? "inset 0 0 0 1px rgba(38,33,28,0.10)"
                    : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-6">
          {roles.map(({ key, hex }) => (
            <MonoLabel key={key} tracking="url">
              {`${key} ${hex}`}
            </MonoLabel>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {roles.map(({ key }) => (
            <p key={key} className="text-helper leading-prose text-ink-2">
              <span className="text-ink">{ROLE_LABEL[key]}</span> — {ROLE_JOB[key]}
            </p>
          ))}
        </div>
      </div>

      {/* ── Actionable: the seven contrast pairs, with Fix ─────────────── */}
      {contrast ? (
        <div className="flex flex-col gap-2">
          <MonoLabel tracking="14" className="block">
            {contrastSummary(contrast).label}
          </MonoLabel>
          <ul className="mt-2 flex flex-col gap-2">
            {contrast.pairs.map((pair) => {
              const below = isBelowAa(pair);
              const note = pairNote(pair);
              return (
                <li
                  key={pair.pair_id}
                  className="flex flex-wrap items-center gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="flex flex-none items-center gap-0.5" aria-hidden="true">
                    <span className="size-4 rounded-l-check border border-line" style={{ background: pair.bg }} />
                    <span className="size-4 rounded-r-check border border-line" style={{ background: pair.fg }} />
                  </span>
                  <span className={`min-w-0 flex-1 text-meta leading-body ${below ? "text-[var(--danger)]" : "text-ink-2"}`}>
                    {pair.label}
                  </span>
                  <MonoLabel
                    tracking="hex"
                    uppercase={false}
                    className={`flex-none whitespace-nowrap ${below ? "text-[var(--danger)]" : ""}`}
                  >
                    {pairReading(pair)}
                  </MonoLabel>
                  {below && pair.suggested_fix ? (
                    <button
                      type="button"
                      disabled={fixing !== null}
                      onClick={() => void fixPair(pair.pair_id)}
                      className="flex-none rounded-pill border border-[var(--danger)] px-3 py-0.5 text-meta text-[var(--danger)] disabled:opacity-40"
                    >
                      {fixing === pair.pair_id ? "Fixing…" : "Fix"}
                    </button>
                  ) : null}
                  {note ? <p className="w-full text-meta leading-body text-ink-2">{note}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A small page mockup — header band, heading, body card, button, link,
 * accent rule — each region labelled with the token it's drawn from. This
 * is the "applied" half of the section: not five rectangles, a real
 * composition someone could recognize as a webpage.
 */
function LabeledRegionCanvas({ tokens }: { tokens: SitePreviewTokens }) {
  return (
    <BrandCanvas tokens={tokens} className="w-site-mock max-w-full overflow-hidden">
      <div style={{ background: "var(--brand-paper)" }} className="relative p-6">
        <RegionTag label="Paper — page background" className="right-3 top-3" />
        <div
          className="relative rounded-[10px] p-5"
          style={{ background: "var(--brand-light)" }}
        >
          <RegionTag label="Light neutral — section background" className="right-3 top-3" />
          <div
            style={{ fontFamily: "var(--brand-heading)", fontSize: 22, fontWeight: 500, color: "var(--brand-secondary)" }}
          >
            A calmer place to start.
          </div>
          <div className="relative mt-2 inline-block">
            <span style={{ fontFamily: "var(--brand-body)", fontSize: 14, color: "var(--brand-dark)" }}>
              Secondary — headings and supporting surfaces
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span
            className="relative flex h-10 items-center whitespace-nowrap rounded-pill px-5"
            style={{ background: "var(--brand-primary)", color: "var(--brand-cta-ink)", fontFamily: "var(--brand-body)", fontWeight: 700, fontSize: 13 }}
          >
            Book a consult
            <RegionTag label="Primary fill · CTA ink text" className="left-1/2 top-full mt-1 -translate-x-1/2" />
          </span>

          <span
            className="relative flex-none pb-0.5"
            style={{ borderBottom: "1px solid var(--brand-primary-text)", color: "var(--brand-primary-text)", fontFamily: "var(--brand-body)", fontSize: 13 }}
          >
            About
          </span>

          <span
            className="relative h-3 w-3 flex-none rounded-full"
            style={{ background: "var(--brand-accent)" }}
          >
            <RegionTag label="Accent — small marks only" className="left-1/2 top-full mt-1 -translate-x-1/2" />
          </span>
        </div>

        <p className="relative mt-5 max-w-[380px]" style={{ fontFamily: "var(--brand-body)", fontSize: 14, lineHeight: 1.6, color: "var(--brand-dark)" }}>
          Body copy sits in dark neutral, on paper.
          <RegionTag label="Dark neutral — body text" className="left-0 top-full mt-1" />
        </p>
      </div>
    </BrandCanvas>
  );
}

/** A small mono tag, positioned relative to its parent — decorative labeling only, the same information lives in the swatch list below for anyone who can't see it positioned. */
function RegionTag({ label, className }: { label: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-canvas-static pointer-events-none absolute z-10 whitespace-nowrap rounded-pill border border-line bg-bg px-2 py-0.5 font-mono text-mono-sm tracking-mono-08 text-ink-2 ${className}`}
    >
      {label}
    </span>
  );
}

const ROLE_LABEL = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  paper: "Page background",
  light_neutral: "Section background",
  dark_neutral: "Body text",
} as const;

const ROLE_JOB = {
  primary: "Buttons, links, active states.",
  secondary: "Supporting headings and surfaces.",
  accent: "Small marks only — a check, a selected state, a rule under a heading.",
  paper: "The whole page. The largest surface on the site.",
  light_neutral: "Tinted bands and cards sitting on top of the page.",
  dark_neutral: "Body copy, and the fill of a dark section.",
} as const;
