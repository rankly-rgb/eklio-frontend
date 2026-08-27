"use client";

import type { CSSProperties, ReactNode } from "react";
import { BrowserFrame } from "@/components/ui/browser-frame";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import { useBrandFont } from "@/components/preview/use-brand-font";
import {
  HAIRLINE_ALPHA,
  domainFor,
  previewCssVariables,
} from "@/lib/brand/derive";
import { relativeLuminance, rgbToHsl, hexToRgb } from "@/lib/brand/color";
import {
  defaultRendering,
  type PreviewModel,
  type Rendering,
  type SocialTemplate,
} from "@/lib/brand/shapes";

/*
 * <BrandPreview> — la maquette du site du praticien, rendue depuis le
 * `PreviewModel` que renvoie `brief_preview()`.
 *
 * TOUT ce qui est saturé à l'écran passe par ici : c'est la seule chose de
 * l'application qui porte les couleurs de l'utilisateur. Les tokens de marque
 * sont posés en propriétés custom sur la racine (`--p-*`), et JAMAIS en
 * classes : un changement de modèle doit ANIMER (500 ms sur les couleurs,
 * fondu de 200 ms sur les polices) et non remonter le composant.
 *
 * Les géométries ci-dessous sont relevées au pixel dans `design/reference/` :
 *   panel — Écrans 1 et 2, rail de 420px
 *   card  — Écran 4, maquette de 250px dans une carte de direction
 *   full  — Écran 5, maquette de 900px du kit de marque
 *
 * Elles ne sont pas des tokens (elles ne se réutilisent nulle part ailleurs),
 * d'où des valeurs littérales — chacune annotée de sa référence.
 */

type SiteSize = "panel" | "card" | "full";

type SiteProps = {
  model: PreviewModel;
  size: SiteSize;
  variant?: "site";
  /** Personnalité de la maquette. Absent : dérivé de la palette, pas de l'index. */
  rendering?: Rendering;
  className?: string;
};

type SocialProps = {
  model: PreviewModel;
  variant: "social";
  template: SocialTemplate;
  /** Ligne du praticien, rendue par le gabarit `signature`. */
  practitionerLine?: string | null;
  className?: string;
};

type ThumbnailProps = {
  model: PreviewModel;
  variant: "thumbnail";
  /** `palette` — carte de palette du brief · `site` — carte de marque de l'accueil. */
  shape?: "palette" | "site";
  className?: string;
};

export type BrandPreviewProps = SiteProps | SocialProps | ThumbnailProps;

export function BrandPreview(props: BrandPreviewProps) {
  if (props.variant === "social") return <SocialTile {...props} />;
  if (props.variant === "thumbnail") return <Thumbnail {...props} />;
  return <SitePreview {...props} />;
}

/* ── Racine porteuse des tokens ─────────────────────────────────────────── */

function TokenRoot({
  model,
  hairlineAlpha,
  className = "",
  style,
  children,
}: {
  model: PreviewModel;
  hairlineAlpha?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={`brand-preview ${className}`}
      style={{ ...previewCssVariables(model.tokens, hairlineAlpha), ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Enveloppe typographique : masque le bloc le temps que la police de marque
 * arrive, puis le révèle en 200 ms. La hauteur est réservée par l'appelant,
 * donc l'échange ne décale rien.
 */
function FontFade({
  ready,
  children,
  className = "",
}: {
  ready: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`transition-opacity duration-[var(--dur-font)] ${className}`}
      style={{ opacity: ready ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

/* ── Maquette de site ───────────────────────────────────────────────────── */

/*
 * L'Écran 1 rend un titre court à 34px, l'Écran 2 un titre long à 27px : la
 * taille suit la longueur, elle n'est pas fixe. Le seuil est calé entre les
 * deux cas des références (24 et 53 caractères).
 */
function headlineSize(headline: string, size: SiteSize): number {
  if (size === "card") return 27;
  if (size === "full") return 42;
  return headline.length > 30 ? 27 : 34;
}

function SitePreview({ model, size, rendering, className = "" }: SiteProps) {
  const ready = useBrandFont(model.tokens.google_fonts_url);
  const nav = rendering ?? defaultRendering(model.tokens);
  const practice = model.practice_name ?? "Your practice";

  if (size === "card") {
    return (
      <TokenRoot
        model={model}
        hairlineAlpha={HAIRLINE_ALPHA.card}
        className={`flex h-[250px] flex-col overflow-hidden rounded-preview border border-line ${className}`}
        style={{ background: "var(--p-light)" }}
      >
        <CardNavbar practice={practice} model={model} nav={nav} ready={ready} />

        <div className="min-h-0 flex-1 p-[26px_18px_28px]">
          <FontFade ready={ready}>
            <div
              className="text-pretty"
              style={{
                fontFamily: "var(--p-heading)",
                fontWeight: 500,
                fontSize: 27,
                lineHeight: 1.14,
                color: "var(--p-ink)",
                // Deux lignes réservées : la maquette ne bouge pas quand le
                // titre change de longueur d'une direction à l'autre.
                minHeight: 27 * 1.14 * 2,
              }}
            >
              {model.hero.headline}
            </div>
            <div
              className="mt-2.5"
              style={{
                fontFamily: "var(--p-body)",
                fontSize: 11,
                lineHeight: 1.6,
                color: "var(--p-ink-soft)",
              }}
            >
              {model.hero.subhead}
            </div>
          </FontFade>
        </div>

        <div
          className="p-[16px_18px_18px]"
          style={{
            borderTop: "1px solid var(--p-rule)",
            background: "var(--p-about)",
          }}
        >
          <PlaceholderLines widths={[92, 80, 58]} height={4} gap={6} opacity={0.5} />
        </div>
      </TokenRoot>
    );
  }

  const isPanel = size === "panel";

  return (
    <TokenRoot
      model={model}
      hairlineAlpha={isPanel ? HAIRLINE_ALPHA.panel : HAIRLINE_ALPHA.full}
      className={className}
    >
      <BrowserFrame
        size={isPanel ? "panel" : "full"}
        domain={domainFor(model.practice_name)}
        shadow={isPanel}
      >
        <div style={{ background: "var(--p-light)" }}>
          <SiteNavbar
            practice={practice}
            ctaLabel={model.hero.cta_label}
            ready={ready}
            size={size}
          />

          <div
            className={isPanel ? "p-[34px_20px_40px]" : "p-[26px_36px]"}
            style={{ fontFamily: "var(--p-body)" }}
          >
            {model.hero.overline ? (
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: isPanel ? 10 : 11,
                  letterSpacing: "var(--tracking-mono-18)",
                  color: "var(--p-secondary)",
                }}
              >
                {model.hero.overline}
              </div>
            ) : null}

            <FontFade ready={ready}>
              <div
                className="text-pretty"
                style={{
                  fontFamily: "var(--p-heading)",
                  fontWeight: 500,
                  fontSize: headlineSize(model.hero.headline, size),
                  lineHeight: isPanel ? 1.1 : 1.06,
                  letterSpacing: "-0.02em",
                  color: "var(--p-ink)",
                  marginTop: isPanel ? 14 : 18,
                  minHeight: isPanel ? 74 : 88,
                }}
              >
                {model.hero.headline}
              </div>
            </FontFade>

            <div
              className="mt-3"
              style={{
                fontFamily: "var(--p-body)",
                fontSize: isPanel ? 12 : 16,
                lineHeight: 1.6,
                color: "var(--p-ink-soft)",
                maxWidth: isPanel ? 250 : 420,
              }}
            >
              {model.hero.subhead}
            </div>

            <div
              className="mt-[22px] inline-flex items-center rounded-pill"
              style={{
                fontFamily: "var(--p-body)",
                fontWeight: 700,
                fontSize: isPanel ? 11 : 14,
                height: isPanel ? 32 : 44,
                paddingInline: isPanel ? 18 : 24,
                background: "var(--p-primary)",
                color: "var(--p-on-primary)",
              }}
            >
              {model.hero.cta_label}
            </div>
          </div>

          <AboutBlock model={model} size={size} />
        </div>
      </BrowserFrame>

      {isPanel ? (
        <p className="mt-[18px] font-display text-[14px] text-ink-2">
          Your site, taking shape.
        </p>
      ) : null}
    </TokenRoot>
  );
}

function SiteNavbar({
  practice,
  ctaLabel,
  ready,
  size,
}: {
  practice: string;
  ctaLabel: string;
  ready: boolean;
  size: "panel" | "full";
}) {
  const isPanel = size === "panel";
  return (
    <div
      className="flex items-center"
      style={{
        gap: isPanel ? 10 : 28,
        padding: isPanel ? "16px" : "20px 36px",
        borderBottom: isPanel ? undefined : "1px solid var(--p-rule)",
      }}
    >
      <FontFade ready={ready} className="flex-none">
        <span
          className="whitespace-nowrap"
          style={{
            fontFamily: "var(--p-heading)",
            fontWeight: 600,
            fontSize: isPanel ? 13 : 19,
            letterSpacing: "-0.01em",
            color: "var(--p-primary)",
          }}
        >
          {practice}
        </span>
      </FontFade>

      <div className="flex-1" />

      <div
        className="flex flex-none items-center whitespace-nowrap"
        style={{
          gap: isPanel ? 8 : 22,
          fontFamily: "var(--p-body)",
          fontSize: isPanel ? 9 : 13,
          color: "var(--p-ink-soft)",
        }}
      >
        <span>About</span>
        <span>Approach</span>
        <span>Fees</span>
      </div>

      <div
        className="flex flex-none items-center whitespace-nowrap rounded-pill"
        style={{
          height: isPanel ? 22 : 32,
          paddingInline: isPanel ? 9 : 16,
          background: "var(--p-primary)",
          color: "var(--p-on-primary)",
          fontFamily: "var(--p-body)",
          fontWeight: 700,
          fontSize: isPanel ? 9 : 12,
        }}
      >
        {ctaLabel}
      </div>
    </div>
  );
}

/*
 * Barre de la maquette de carte. C'est ici que se joue la personnalité de la
 * direction : posée sur le primaire, ou sur le clair avec un filet teinté.
 */
function CardNavbar({
  practice,
  model,
  nav,
  ready,
}: {
  practice: string;
  model: PreviewModel;
  nav: Rendering;
  ready: boolean;
}) {
  const onPrimary = nav.nav_surface === "primary";
  const radius = { pill: 999, rounded: 4, square: 2 }[nav.cta_shape];
  const outline = nav.cta_style === "outline";

  return (
    <div
      className="flex items-center gap-2.5 p-[12px_14px]"
      style={{
        background: onPrimary ? "var(--p-primary)" : "var(--p-light)",
        borderBottom: onPrimary ? undefined : "1px solid var(--p-rule)",
      }}
    >
      <FontFade ready={ready} className="flex-none">
        <span
          className="whitespace-nowrap"
          style={{
            fontFamily: "var(--p-heading)",
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "-0.01em",
            color: onPrimary ? "var(--p-on-primary)" : "var(--p-primary)",
          }}
        >
          {practice}
        </span>
      </FontFade>

      <div className="flex-1" />

      <div
        className="flex flex-none items-center whitespace-nowrap"
        style={{
          height: 20,
          paddingInline: 10,
          borderRadius: radius,
          fontFamily: "var(--p-body)",
          fontWeight: 600,
          fontSize: 9,
          ...(outline
            ? {
                // Filet du bouton contourné : la couleur du texte à 50 %,
                // comme l'Écran 4 (rgba(243,237,228,0.5) sur le primaire).
                border:
                  "1px solid color-mix(in srgb, currentColor 50%, transparent)",
                color: onPrimary ? "var(--p-on-primary)" : "var(--p-primary)",
              }
            : {
                background: onPrimary
                  ? "var(--p-on-primary)"
                  : "var(--p-primary)",
                color: onPrimary ? "var(--p-primary)" : "var(--p-on-primary)",
              }),
        }}
      >
        {model.hero.cta_label}
      </div>
    </div>
  );
}

function AboutBlock({ model, size }: { model: PreviewModel; size: SiteSize }) {
  const isPanel = size === "panel";
  return (
    <div
      style={{
        borderTop: "1px solid var(--p-rule)",
        background: "var(--p-light)",
        padding: isPanel ? 20 : "0 36px 20px",
      }}
    >
      <div
        style={{
          background: "var(--p-about)",
          borderRadius: isPanel ? 10 : 12,
          padding: isPanel ? "18px 16px" : "18px 28px",
        }}
      >
        <PlaceholderLines
          widths={isPanel ? [94, 88, 62] : [88, 80, 54]}
          height={isPanel ? 5 : 6}
          gap={isPanel ? 7 : 9}
          opacity={isPanel ? 0.55 : 0.5}
        />

        {isPanel && model.specialties.length > 0 ? (
          <div className="mt-4 flex gap-2">
            {model.specialties.slice(0, 2).map((specialty) => (
              <span
                key={specialty}
                className="flex items-center rounded-pill"
                style={{
                  height: 22,
                  paddingInline: 12,
                  border: "1px solid var(--p-secondary)",
                  color: "var(--p-primary)",
                  fontFamily: "var(--p-body)",
                  fontWeight: 600,
                  fontSize: 10,
                }}
              >
                {specialty}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Tuiles sociales ────────────────────────────────────────────────────── */

/*
 * Le rôle de palette de la tuile vient des DONNÉES (`palette_role`), contraint
 * par la base à l'un des cinq rôles. La couleur du texte n'en vient pas : elle
 * se déduit de la luminance du fond, pour qu'une palette générée sombre reste
 * lisible sans qu'on ait à la relire.
 */
function tileColors(model: PreviewModel, role: SocialTemplate["palette_role"]) {
  const background = model.tokens[role];
  const onDark = relativeLuminance(background) < 0.5;
  return {
    background,
    foreground: onDark ? "var(--p-light)" : "var(--p-ink)",
    /* Les lignes de placeholder d'une tuile saturée reprennent la couleur du
       texte, pas l'encre de l'app : sur un aplat ocre, `--ink-3` disparaît. */
    lines: onDark ? model.tokens.light : model.tokens.dark,
  };
}

function SocialTile({
  model,
  template,
  practitionerLine,
  className = "",
}: SocialProps) {
  const ready = useBrandFont(model.tokens.google_fonts_url);
  const { background, foreground, lines } = tileColors(
    model,
    template.palette_role
  );
  const isStory = template.type === "story";
  const font =
    template.typography_role === "heading"
      ? "var(--p-heading)"
      : "var(--p-body)";

  return (
    <TokenRoot
      model={model}
      className={`box-border overflow-hidden rounded-social ${className}`}
      style={{
        width: isStory ? 190 : 220,
        height: isStory ? 338 : 220,
        background,
      }}
    >
      {template.layout === "signature" ? (
        <FontFade
          ready={ready}
          className="flex h-full flex-col items-center justify-center gap-2.5"
        >
          <span
            style={{
              fontFamily: "var(--p-heading)",
              fontWeight: 600,
              fontSize: 18,
              letterSpacing: "-0.01em",
              color: "var(--p-primary)",
            }}
          >
            {template.headline}
          </span>
          {practitionerLine ? (
            <span
              style={{
                fontFamily: "var(--p-body)",
                fontSize: 12,
                color: "var(--p-ink-soft)",
              }}
            >
              {practitionerLine}
            </span>
          ) : null}
        </FontFade>
      ) : template.layout === "notes" ? (
        <div className="flex h-full flex-col p-[26px_24px]">
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--p-body)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.14em",
              color: foreground,
            }}
          >
            {template.headline}
          </span>
          <PlaceholderLines
            className="mt-[22px]"
            widths={[92, 84, 60]}
            height={6}
            gap={9}
            color={lines}
            opacity={0.5}
          />
        </div>
      ) : (
        <FontFade
          ready={ready}
          className="flex h-full flex-col justify-end p-[26px_24px]"
        >
          <span
            className="text-pretty"
            style={{
              fontFamily: font,
              fontWeight: 500,
              // Le gabarit `statement` porte une phrase courte et respire à
              // 30px ; `question` en dit plus et descend à 27px (Écran 6).
              fontSize: template.layout === "statement" ? 30 : 27,
              lineHeight: template.layout === "statement" ? 1.12 : 1.14,
              letterSpacing: "-0.015em",
              color: foreground,
            }}
          >
            {template.headline}
          </span>
        </FontFade>
      )}
    </TokenRoot>
  );
}

/* ── Vignettes abstraites ───────────────────────────────────────────────── */

/** La plus sombre des deux couleurs de marque — jamais un index. */
function darker(a: string, b: string): string {
  const la = hexToRgb(a) ? rgbToHsl(hexToRgb(a)!).l : 100;
  const lb = hexToRgb(b) ? rgbToHsl(hexToRgb(b)!).l : 100;
  // Égalité : le primaire l'emporte (cas CLAY & SAND, où les deux sont à 49.8 %).
  return la <= lb ? a : b;
}

function Thumbnail({ model, shape = "palette", className = "" }: ThumbnailProps) {
  const { primary, secondary } = model.tokens;
  const dominant = darker(primary, secondary);
  const accent = dominant === primary ? secondary : primary;

  if (shape === "site") {
    /* Carte « Your brand » de l'accueil (Écran 7) : cadre 24px, deux colonnes. */
    return (
      <TokenRoot model={model} className={className}>
        <BrowserFrame size="thumbnail">
          <div className="flex items-stretch" style={{ background: "var(--p-light)" }}>
            <div className="min-w-0 flex-1 p-[20px_22px_22px]">
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-16 flex-none rounded-[2px]"
                  style={{ background: "var(--p-primary)" }}
                />
                <div className="flex-1" />
                <div
                  className="h-[18px] w-[60px] flex-none rounded-pill"
                  style={{ background: "var(--p-primary)" }}
                />
              </div>
              <div className="mt-[18px] flex flex-col gap-2">
                <div
                  className="h-3 w-[74%] rounded-[2px]"
                  style={{ background: "var(--p-ink)" }}
                />
                <div
                  className="h-3 w-[46%] rounded-[2px]"
                  style={{ background: "var(--p-ink)" }}
                />
              </div>
              <PlaceholderLines
                className="mt-4 max-w-[280px]"
                widths={[90, 72]}
                count={2}
                height={4}
                gap={6}
                opacity={0.5}
              />
            </div>
            <div
              className="m-[20px_22px_22px_0] w-[200px] flex-none rounded-preview"
              style={{ background: "var(--p-about)" }}
            />
          </div>
        </BrowserFrame>
      </TokenRoot>
    );
  }

  /* Vignette de carte de palette (Écran 1). */
  return (
    <TokenRoot
      model={model}
      className={`overflow-hidden ${className}`}
      style={{ background: "var(--p-light)" }}
    >
      <div
        className="flex h-5 items-center gap-[5px] px-2"
        style={{ background: "var(--p-primary)" }}
      >
        <div
          className="h-1 w-[22px] rounded-pill opacity-90"
          style={{ background: "var(--p-light)" }}
        />
        <div className="flex-1" />
        <div
          className="h-[3px] w-2.5 rounded-pill opacity-50"
          style={{ background: "var(--p-light)" }}
        />
        <div
          className="h-[3px] w-2.5 rounded-pill opacity-50"
          style={{ background: "var(--p-light)" }}
        />
      </div>
      <div className="p-[14px_12px_16px]">
        <div
          className="h-2 w-[76%] rounded-[2px]"
          style={{ background: dominant }}
        />
        <div
          className="mt-2 h-[5px] w-[54%] rounded-[2px] opacity-55"
          style={{ background: accent }}
        />
        <PlaceholderLines className="mt-3.5" height={4} gap={5} />
        <div
          className="mt-4 h-3.5 w-14 rounded-pill"
          style={{ background: accent }}
        />
      </div>
    </TokenRoot>
  );
}
