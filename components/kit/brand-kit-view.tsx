"use client";

import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { WorkspaceNav } from "@/components/kit/workspace-nav";
import { IdentitySection } from "@/components/kit/identity-section";
import { ColorsSection } from "@/components/kit/colors-section";
import { TypeSection } from "@/components/kit/type-section";
import { WordsSection } from "@/components/kit/words-section";
import { AssetsSection } from "@/components/kit/assets-section";
import { SiteCard } from "@/components/kit/site-card";
import { BrandPreview } from "@/components/preview/brand-preview";
import { previewModelFromDirection, type Direction, type VoiceGuide } from "@/lib/brand/shapes";
import type { ContrastReport, SitePreviewTokens } from "@/lib/site/types";

/*
 * Le kit de marque — le workspace du lot 3 : six sections navigables (une
 * seule page qui défile toujours, mais avec un rail de navigation), chacune
 * appliqué / spécifié / actionnable.
 *
 * ── Ce qui a changé au lot 3 ─────────────────────────────────────────────
 *
 * « This month, in your brand » a disparu de cette page — ce contenu vit sur
 * la page Content, et n'a jamais eu sa place ici (le lot le dit
 * explicitement). Ce qui partait avec elle : `socialTemplates`,
 * `practitionerLine`, `entitled`, `monthlyCheckoutHref` — plus utilisés nulle
 * part sur cette page, retirés plutôt que gardés morts.
 *
 * « Voice & tone » devient « Your words » : même contenu, désormais posé dans
 * un `<BrandCanvas>` (`components/kit/words-section.tsx`) — l'écart que le
 * lot 1 avait laissé.
 *
 * « Palette » devient « Colors » : la section existante était déjà proche de
 * ce que demande le lot, mais gagne un mockup en applied/labelled
 * (`components/kit/colors-section.tsx`) et l'action Fix, en direct.
 *
 * « Identity » et « Your assets » sont entièrement nouvelles.
 */

export function BrandKitView({
  brandKitId,
  projectId,
  practiceName,
  direction,
  voiceGuide,
  siteBuilderLabel,
  canvasTokens,
  canvasContrast,
}: {
  brandKitId: string;
  projectId: string;
  practiceName: string | null;
  direction: Direction;
  voiceGuide: VoiceGuide | null;
  /** Le constructeur retenu dans le spec de site, ou `null` s'il n'existe pas. */
  siteBuilderLabel: string | null;
  /** Les six rôles + quatre variantes (§3), ou `null` si le spec n'est pas encore semé. */
  canvasTokens: SitePreviewTokens | null;
  /** Les sept paires de contraste (§4), ou `null` dans le même cas. */
  canvasContrast: ContrastReport | null;
}) {
  const model = previewModelFromDirection(direction, practiceName);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex items-end gap-8 max-lg:flex-col max-lg:items-start max-lg:gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {practiceName ?? "Your brand"}
          </h1>
          <MonoLabel tracking="16" className="mt-3 block">
            {`${direction.name} · Selected`}
          </MonoLabel>
        </div>

        <div className="flex flex-none items-center gap-4">
          <ButtonLink
            href={`/app/brand-kits/${brandKitId}/site`}
            variant="primary"
            className={canvasTokens ? "hover:opacity-90" : undefined}
            style={
              canvasTokens
                ? { background: canvasTokens.primary, color: canvasTokens.cta_ink }
                : undefined
            }
          >
            Edit your site
          </ButtonLink>
          <a
            href={`/api/brand-kits/${brandKitId}/pdf`}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
          >
            Download PDF
          </a>
          <Link
            href={`/app/brand-kits/${brandKitId}/reveal`}
            className="whitespace-nowrap text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
          >
            Switch direction
          </Link>
          <Link
            href={`/app/briefs/${projectId}/review`}
            className="whitespace-nowrap text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
          >
            Edit your brief
          </Link>
        </div>
      </div>

      {/* ── Le workspace : rail + sections ──────────────────────────────── */}
      <div className="mt-10 flex items-start gap-12 max-lg:flex-col max-lg:gap-8">
        <WorkspaceNav />

        {/*
         * Each section already carries its own top margin/rule/padding
         * (`mt-12 … border-b … pb-12`) — a self-contained spacing rhythm,
         * not a fallback for a flex `gap` this div doesn't declare (it's
         * a plain block; `min-w-0`/`flex-1` size it as a flex ITEM of the
         * row above, which is the only flex context that matters here).
         */}
        <div className="min-w-0 flex-1 [&>section]:scroll-mt-8">
          <section id="kit-identity" className="flex flex-col gap-5 border-b border-line pb-12">
            <SectionHeader title="Identity" id="kit-identity-heading" />
            <IdentitySection brandKitId={brandKitId} practiceName={practiceName} tokens={canvasTokens} />
          </section>

          <section id="kit-colors" className="mt-12 flex flex-col gap-5 border-b border-line pb-12">
            <SectionHeader title="Colors" id="kit-colors-heading" />
            <ColorsSection
              brandKitId={brandKitId}
              initialTokens={canvasTokens}
              initialContrast={canvasContrast}
            />
          </section>

          <section id="kit-type" className="mt-12 flex flex-col gap-5 border-b border-line pb-12">
            <SectionHeader title="Type" id="kit-type-heading" />
            <TypeSection direction={direction} tokens={canvasTokens} />
          </section>

          <section id="kit-site" className="mt-12 flex flex-col gap-6 border-b border-line pb-12">
            <SectionHeader title="Your site" id="kit-site-heading" />
            <div className="w-site-mock max-w-full">
              <div className="overflow-hidden rounded-card border border-line shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                <BrandPreview model={model} size="full" rendering={direction.rendering} />
              </div>
              <p className="mt-3 text-helper leading-prose text-ink-2">
                This is your brand on a page. Your pages, copy and builder
                instructions live in the site editor.
              </p>
            </div>
            <SiteCard brandKitId={brandKitId} model={model} builderLabel={siteBuilderLabel} />
          </section>

          <section id="kit-words" className="mt-12 flex flex-col gap-5 border-b border-line pb-12">
            <SectionHeader
              title="Your words"
              id="kit-words-heading"
              trailing={
                <span className="flex-none rounded-pill border border-line px-3 py-1.5 font-mono text-mono uppercase tracking-mono-12 text-ink-2">
                  Board-safe copy
                </span>
              }
            />
            <WordsSection voiceGuide={voiceGuide} tokens={canvasTokens} />
          </section>

          <section id="kit-assets" className="mt-12 flex flex-col gap-5">
            <SectionHeader title="Your assets" id="kit-assets-heading" />
            <AssetsSection brandKitId={brandKitId} />
          </section>
        </div>
      </div>

      <div className="mt-12 max-w-[720px] border-t border-line pt-6">
        <EthicsDisclaimer />
        <ButtonLink
          href={`/app/briefs/${projectId}`}
          variant="tertiary"
          className="mt-4"
        >
          Edit my brief
        </ButtonLink>
      </div>
    </main>
  );
}
