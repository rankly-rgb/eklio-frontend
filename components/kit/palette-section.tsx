import { BrandCanvas } from "@/components/kit/brand-canvas";
import { MonoLabel } from "@/components/ui/mono-label";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import type { ContrastReport } from "@/lib/site/types";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * La section Palette du kit — les six rôles de couleur (§3 du contrat), pas
 * cinq : `paper` et `light_neutral` sont deux surfaces distinctes, jamais
 * confondues (§3, "paper and light_neutral are not the same colour").
 *
 * La paire de contraste affichée (`cta_label_on_primary`) vient de
 * `site_spec_get`'s `contrast` block, TELLE QUELLE — jamais recalculée ici.
 * Le §4 du contrat est explicite : une implémentation flottante côté client
 * finit par ne pas être d'accord avec la base sur une frontière. Le libellé
 * du bouton est peint en `cta_ink`, la variante réelle — jamais un blanc
 * supposé.
 */
export function PaletteSection({
  tokens,
  contrast,
}: {
  tokens: SitePreviewTokens | null;
  contrast: ContrastReport | null;
}) {
  if (!tokens) {
    return (
      <p className="text-body text-ink-2">
        Your palette is still being set up. This section fills in as soon as it&rsquo;s ready.
      </p>
    );
  }

  const ctaPair = contrast?.pairs.find((p) => p.pair_id === "cta_label_on_primary") ?? null;

  const roles: { key: keyof typeof ROLE_LABEL; hex: string }[] = [
    { key: "primary", hex: tokens.primary },
    { key: "secondary", hex: tokens.secondary },
    { key: "accent", hex: tokens.accent },
    { key: "paper", hex: tokens.paper },
    { key: "light_neutral", hex: tokens.light_neutral },
    { key: "dark_neutral", hex: tokens.dark_neutral },
  ];

  return (
    <div className="flex items-start gap-12 max-xl:flex-col max-xl:gap-8">
      <div className="w-site-mock max-w-full flex-none">
        <div className="grid grid-cols-6">
          {roles.map(({ key, hex }) => (
            <div
              key={key}
              className="h-24"
              style={{
                background: hex,
                // A paper or light_neutral swatch with no rule disappears
                // against the app's own off-white ground.
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

      <BrandCanvas
        tokens={tokens}
        className="flex min-w-0 flex-1 items-center gap-5 p-6"
      >
        <span
          className="flex h-10 flex-none items-center whitespace-nowrap rounded-pill px-5"
          style={{
            background: "var(--brand-primary)",
            color: "var(--brand-cta-ink)",
            fontFamily: "var(--brand-body)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Book a consult
        </span>

        <span
          className="flex-none pb-0.5"
          style={{
            borderBottom: "1px solid var(--brand-primary-text)",
            color: "var(--brand-primary-text)",
            fontFamily: "var(--brand-body)",
            fontSize: 13,
          }}
        >
          About
        </span>

        <div
          className="min-w-0 flex-1 rounded-[12px] p-[16px_18px]"
          style={{ background: "var(--brand-light)" }}
        >
          <PlaceholderLines widths={[86, 70]} count={2} height={5} gap={7} opacity={0.5} />
        </div>

        {ctaPair ? (
          <span
            title={`Contrast ratio ${ctaPair.ratio}:1 between the button label and its fill.`}
            className={`brand-canvas-static flex-none rounded-pill border px-2.5 py-1 font-mono text-mono tracking-mono-10 ${
              ctaPair.level === "fail" ? "border-danger text-danger" : "border-line text-ink-2"
            }`}
          >
            {ctaPair.level === "fail" ? `AA fails · ${ctaPair.ratio}:1` : ctaPair.level.replace("_", " ").toUpperCase()}
            <span className="sr-only">
              {ctaPair.level === "fail"
                ? ` — the button label does not reach WCAG AA. It measures ${ctaPair.ratio} to 1.`
                : ` — the button label passes WCAG AA at ${ctaPair.ratio} to 1.`}
            </span>
          </span>
        ) : null}
      </BrandCanvas>
    </div>
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
