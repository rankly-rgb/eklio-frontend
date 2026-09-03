"use client";

import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { BrandCanvas } from "@/components/kit/brand-canvas";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { SiteCard } from "@/components/kit/site-card";
import { PaletteSection } from "@/components/kit/palette-section";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { previewModelFromDirection, type Direction, type SocialTemplates, type VoiceGuide } from "@/lib/brand/shapes";
import { MONTHLY_PRESENCE, formatUsd } from "@/lib/billing/plans";
import type { ContrastReport, SitePreviewTokens } from "@/lib/site/types";

/*
 * Le kit de marque — Écrans 5 et 6, une seule page qui défile.
 *
 * ÉCART SIGNALÉ : le §2 veut « au plus un bouton primary ou accent par
 * écran ». Cette page en porte deux — « Edit your site » (primary, Écran 5, à
 * la place de l'ancien « Copy site prompt ») et « Add Monthly Presence »
 * (accent, Écran 6). Les deux références les montrent ainsi, chacune sur son
 * écran, et le §5 demande explicitement que les deux écrans n'en fassent
 * qu'un. Les références l'emportent ; on ne perd pas l'un des deux boutons
 * pour tenir un compte.
 *
 * ── Ce qui a changé au lot 11 ────────────────────────────────────────────
 *
 * La section « Site prompt » composait le prompt DANS CE DÉPÔT et l'affichait
 * en bloc. La base est désormais la source unique de la sortie : la section
 * est remplacée par une carte qui mène à l'éditeur de site, où le texte à
 * coller vit à côté de la maquette qui le produit.
 */

export function BrandKitView({
  brandKitId,
  projectId,
  practiceName,
  direction,
  socialTemplates,
  voiceGuide,
  practitionerLine,
  siteBuilderLabel,
  entitled,
  monthlyCheckoutHref,
  canvasTokens,
  canvasContrast,
}: {
  brandKitId: string;
  projectId: string;
  practiceName: string | null;
  direction: Direction;
  socialTemplates: SocialTemplates | null;
  voiceGuide: VoiceGuide | null;
  practitionerLine: string | null;
  /** Le constructeur retenu dans le spec de site, ou `null` s'il n'existe pas. */
  siteBuilderLabel: string | null;
  entitled: boolean;
  monthlyCheckoutHref: string;
  /** Les six rôles + quatre variantes (§3), ou `null` si le spec n'est pas encore semé. */
  canvasTokens: SitePreviewTokens | null;
  /** Les sept paires de contraste (§4), ou `null` dans le même cas. */
  canvasContrast: ContrastReport | null;
}) {
  const model = previewModelFromDirection(direction, practiceName);
  const ready = useBrandFont(direction.typography.google_fonts_url);

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
          {/*
           * L'exception voulue par le lot 1 : sa couleur primaire, sur
           * EXACTEMENT un élément de niveau app par écran — le bouton
           * d'action primaire. `cta_ink` pour le libellé, jamais un blanc
           * supposé. Un style en ligne, pas une classe : c'est un élément
           * précis, pas une surface réutilisable.
           */}
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

      {/* ── Your site ───────────────────────────────────────────────────── */}
      <section className="mt-6 flex flex-col gap-6">
        <SectionHeader title="Your site" />
        <div className="w-site-mock max-w-full">
          {/*
           * Cadre canvas — filet, rayon, ombre intérieure discrète — SANS
           * injecter de jetons `--brand-*` : <BrandPreview> gère déjà les
           * siens (`--p-*`) en interne, et le lot 3 dit d'en garder la
           * substance inchangée. C'est le même langage visuel que
           * `.brand-canvas`, appliqué en classes plutôt qu'en composant.
           */}
          <div className="overflow-hidden rounded-card border border-line shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <BrandPreview
              model={model}
              size="full"
              rendering={direction.rendering}
            />
          </div>
          <p className="mt-3 text-helper leading-prose text-ink-2">
            {/* La maquette du kit montre la marque appliquée à une page
                d'accueil. Les quatre pages, elles, s'éditent dans l'éditeur de
                site, où la maquette suit chaque changement. */}
            This is your brand on a page. Your pages, copy and builder
            instructions live in the site editor.
          </p>
        </div>

        <SiteCard
          brandKitId={brandKitId}
          model={model}
          builderLabel={siteBuilderLabel}
        />
      </section>

      {/* ── Palette ─────────────────────────────────────────────────────── */}
      <section className="mt-8 flex flex-col gap-5">
        <SectionHeader title="Palette" />
        <PaletteSection tokens={canvasTokens} contrast={canvasContrast} />
      </section>

      {/* ── Typography ──────────────────────────────────────────────────── */}
      <section className="mt-8 flex flex-col gap-5">
        <SectionHeader title="Typography" />
        {canvasTokens ? (
          <BrandCanvas
            tokens={canvasTokens}
            className="flex flex-col gap-3 p-6 transition-opacity duration-[var(--dur-font)]"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <div
              style={{
                fontFamily: "var(--brand-heading)",
                fontWeight: 500,
                fontSize: 42,
                lineHeight: 1.06,
                letterSpacing: "-0.025em",
                color: "var(--brand-dark)",
                minHeight: 48,
              }}
            >
              {direction.hero.headline}
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
              <MonoLabel tracking="14">
                {`Headings · ${canvasTokens.heading_font}`}
              </MonoLabel>
              <MonoLabel tracking="14">
                {`Body · ${canvasTokens.body_font}`}
              </MonoLabel>
            </div>
          </BrandCanvas>
        ) : (
          <p className="text-body text-ink-2">
            Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
          </p>
        )}
      </section>

      {/* ── This month, in your brand ───────────────────────────────────── */}
      <section className="mt-10 flex flex-col gap-8">
        <SectionHeader title="This month, in your brand" />
        <div className="flex items-start gap-12 max-xl:flex-col">
          <div className="flex flex-none items-start gap-4 max-md:flex-wrap">
            {socialTemplates?.map((template) => (
              <BrandPreview
                key={template.id}
                model={model}
                variant="social"
                template={template}
                practitionerLine={practitionerLine}
              />
            ))}
          </div>

          <div className="min-w-0 max-w-presence-card flex-1 rounded-card border border-line bg-card p-7">
            {entitled ? (
              <>
                <h3 className="text-pretty font-display text-card-title font-medium leading-card tracking-question text-ink">
                  Your month is already running.
                </h3>
                <p className="mt-3.5 text-ui leading-prose text-ink-2">
                  Monthly Presence is active — twelve posts, four stories and an
                  editorial calendar, in your colors.
                </p>
                <MonoLabel tracking="14" className="mt-5 block">
                  {`${formatUsd(MONTHLY_PRESENCE.amountCents)}/month · Cancel anytime`}
                </MonoLabel>
                <ButtonLink
                  href="/app/content"
                  variant="secondary"
                  className="mt-6 w-full"
                >
                  See this month
                </ButtonLink>
              </>
            ) : (
              <>
                <h3 className="text-pretty font-display text-card-title font-medium leading-card tracking-question text-ink">
                  Want 12 of these every month?
                </h3>
                <p className="mt-3.5 text-ui leading-prose text-ink-2">
                  {MONTHLY_PRESENCE.tagline}
                </p>
                <MonoLabel tracking="14" className="mt-5 block">
                  {`${formatUsd(MONTHLY_PRESENCE.amountCents)}/month · Cancel anytime`}
                </MonoLabel>
                <ButtonLink
                  href={monthlyCheckoutHref}
                  variant="accent"
                  className="mt-6 w-full"
                >
                  Add Monthly Presence
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Voice & tone ────────────────────────────────────────────────── */}
      {voiceGuide ? (
        <section className="mt-12 flex flex-col gap-10">
          <SectionHeader
            title="Voice & tone"
            trailing={
              <span className="flex-none rounded-pill border border-line px-3 py-1.5 font-mono text-mono uppercase tracking-mono-12 text-ink-2">
                Board-safe copy
              </span>
            }
          />
          <div className="flex max-w-voice max-md:flex-col max-md:gap-8">
            <div className="box-border flex-1 pr-14 max-md:pr-0">
              <h3 className="font-display text-subsection font-medium text-ink">
                Sounds like you
              </h3>
              <div className="mt-6 flex flex-col gap-5 text-body text-ink">
                {voiceGuide.sounds_like.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="w-px flex-none bg-line max-md:h-px max-md:w-full" />
            <div className="box-border flex-1 pl-14 max-md:pl-0">
              <h3 className="font-display text-subsection font-medium text-ink">
                Never write this
              </h3>
              <div className="mt-6 flex flex-col items-start gap-5 text-body text-ink-3">
                {voiceGuide.never_write.map((line) => (
                  <span key={line} className="relative inline-block">
                    <span>{line}</span>
                    {/* Barré posé à mi-hauteur, comme la référence — pas un
                        `line-through`, dont l'épaisseur varie avec la police. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-1/2 h-px bg-[var(--ink-3)]"
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
