"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { WorkspaceNav, type SectionId } from "@/components/kit/workspace-nav";
import { IdentitySection } from "@/components/kit/identity-section";
import { ColorsSection } from "@/components/kit/colors-section";
import { TypeSection } from "@/components/kit/type-section";
import { WordsSection } from "@/components/kit/words-section";
import { EthicsBadge } from "@/components/kit/ethics-badge";
import { AssetsPreview } from "@/components/kit/assets-preview";
import { KitHeader } from "@/components/kit/kit-header";
import { SiteCard } from "@/components/kit/site-card";
import { BrandPreview } from "@/components/preview/brand-preview";
import { LaunchProgressRow } from "@/components/kit/launch-progress-row";
import { DeleteKitSection } from "@/components/kit/delete-kit-section";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import { previewModelFromDirection, type Direction, type EthicsCheck, type VoiceGuide } from "@/lib/brand/shapes";
import type { ContrastReport, PracticeDetails as SitePracticeDetails, SitePreviewTokens } from "@/lib/site/types";
import type { LaunchProgress } from "@/lib/data/checklist";
import type { PracticeDetails } from "@/lib/kit/launch-copy";
import type { AssetStats } from "@/lib/data/asset-stats";

type RuleLabel = { id: string; label: string; description: string };

/*
 * Le kit de marque — le workspace du lot 3 : un en-tête (wordmark, bandes de
 * couleur, tuiles d'état, carte de practice), puis six sections navigables
 * (une seule page qui défile toujours sur desktop, une section à la fois
 * sur mobile — l'inversion de hiérarchie du lot 3, "Your assets" par
 * défaut).
 */

export function BrandKitView({
  brandKitId,
  projectId,
  practiceName,
  direction,
  voiceGuide,
  ethicsCheck,
  ethicsRules,
  siteBuilderLabel,
  canvasTokens,
  canvasContrast,
  colorLabels,
  sitePracticeDetails,
  assetStats,
  launchProgress,
  practitionerLine,
  practiceDetails,
  bookingUrl,
  compAccess,
  heroImageUrl,
}: {
  brandKitId: string;
  projectId: string;
  practiceName: string | null;
  direction: Direction;
  voiceGuide: VoiceGuide | null;
  /** Le verdict persisté de la dernière génération (`enforceEthics`), ou `null` s'il n'y en a pas encore. */
  ethicsCheck: EthicsCheck | null;
  /** Les six règles réelles de `ethics_rules`, pour le badge et « Check your own words ». */
  ethicsRules: RuleLabel[];
  /** Le constructeur retenu dans le spec de site, ou `null` s'il n'existe pas. */
  siteBuilderLabel: string | null;
  /** Les six rôles + quatre variantes (§3), ou `null` si le spec n'est pas encore semé. */
  canvasTokens: SitePreviewTokens | null;
  /** Les sept paires de contraste (§4), ou `null` dans le même cas. */
  canvasContrast: ContrastReport | null;
  /** The human name alongside each of the six roles, or null before the spec is seeded. */
  colorLabels: Record<string, string> | null;
  /** The full site-spec practice_details (name/credential/city/state/email) for the header's practice card. */
  sitePracticeDetails: SitePracticeDetails | null;
  /** The four state tiles' real numbers, or null before the spec is seeded. */
  assetStats: AssetStats | null;
  /** "Your first week" (Lot 6) — the seven-step checklist's current state. */
  launchProgress: LaunchProgress;
  practitionerLine: string | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  /** Accès comp actif (base de données) — jamais un droit, un signal d'affichage. */
  compAccess: boolean;
  /** The hero photograph's signed URL, or null for the gradient placeholder. */
  heroImageUrl: string | null;
}) {
  const model = previewModelFromDirection(direction, practiceName);
  const [activeMobileSection, setActiveMobileSection] = useState<SectionId>("kit-assets");

  const launchContext: LaunchStepContext = {
    practiceName,
    practitionerLine,
    aboutExcerpt: direction.about_excerpt,
    practiceDetails,
    bookingUrl,
    assetsHref: "#kit-assets",
    siteHref: `/app/brand-kits/${brandKitId}/site`,
  };

  function sectionClass(id: SectionId): string {
    return id === activeMobileSection ? "" : "max-lg:hidden";
  }

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <KitHeader
        brandKitId={brandKitId}
        projectId={projectId}
        practiceName={practiceName}
        directionName={direction.name}
        tokens={canvasTokens}
        colorLabels={colorLabels}
        practiceDetails={sitePracticeDetails}
        bookingUrl={bookingUrl}
        stats={assetStats}
        compAccess={compAccess}
        heroImageUrl={heroImageUrl}
      />

      <LaunchProgressRow
        brandKitId={brandKitId}
        progress={launchProgress}
        context={launchContext}
      />

      {/* ── Le workspace : rail + sections ──────────────────────────────── */}
      <div className="mt-10 flex items-start gap-12 max-lg:flex-col max-lg:gap-6">
        <WorkspaceNav
          activeMobileSection={activeMobileSection}
          onSelectMobileSection={setActiveMobileSection}
        />

        {/*
         * Each section already carries its own top margin/rule/padding
         * (`mt-12 … border-b … pb-12`) — a self-contained spacing rhythm,
         * not a fallback for a flex `gap` this div doesn't declare (it's
         * a plain block; `min-w-0`/`flex-1` size it as a flex ITEM of the
         * row above, which is the only flex context that matters here).
         */}
        <div className="min-w-0 flex-1 [&>section]:scroll-mt-8">
          <section
            id="kit-identity"
            className={`flex flex-col gap-5 border-b border-line pb-12 ${sectionClass("kit-identity")}`}
          >
            <SectionHeader title="Identity" id="kit-identity-heading" />
            <IdentitySection brandKitId={brandKitId} practiceName={practiceName} tokens={canvasTokens} />
          </section>

          <section
            id="kit-colors"
            className={`mt-12 flex flex-col gap-5 border-b border-line pb-12 max-lg:mt-6 ${sectionClass("kit-colors")}`}
          >
            <SectionHeader title="Colors" id="kit-colors-heading" />
            <ColorsSection
              brandKitId={brandKitId}
              initialTokens={canvasTokens}
              initialContrast={canvasContrast}
              colorLabels={colorLabels}
            />
          </section>

          <section
            id="kit-type"
            className={`mt-12 flex flex-col gap-5 border-b border-line pb-12 max-lg:mt-6 ${sectionClass("kit-type")}`}
          >
            <SectionHeader title="Type" id="kit-type-heading" />
            <TypeSection direction={direction} tokens={canvasTokens} />
          </section>

          <section
            id="kit-site"
            className={`mt-12 flex flex-col gap-6 border-b border-line pb-12 max-lg:mt-6 ${sectionClass("kit-site")}`}
          >
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

          <section
            id="kit-words"
            className={`mt-12 flex flex-col gap-5 border-b border-line pb-12 max-lg:mt-6 ${sectionClass("kit-words")}`}
          >
            <SectionHeader
              title="Your words"
              id="kit-words-heading"
              trailing={<EthicsBadge ethicsCheck={ethicsCheck} ethicsRules={ethicsRules} />}
            />
            <WordsSection voiceGuide={voiceGuide} tokens={canvasTokens} ethicsRules={ethicsRules} />
          </section>

          <section
            id="kit-assets"
            className={`mt-12 flex flex-col gap-5 max-lg:mt-6 ${sectionClass("kit-assets")}`}
          >
            <SectionHeader title="Your assets" id="kit-assets-heading" />
            {assetStats ? (
              <AssetsPreview brandKitId={brandKitId} manifest={assetStats.manifest} />
            ) : (
              <p className="text-body text-ink-2">
                Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
              </p>
            )}
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

      {practiceName ? (
        <div id="kit-danger" className="mt-12 max-w-[720px] scroll-mt-8 border-t border-line pt-6">
          <DeleteKitSection brandKitId={brandKitId} practiceName={practiceName} />
        </div>
      ) : null}
    </main>
  );
}
