import type { CSSProperties } from "react";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * `<BrandCanvas>`'s tokens — the six roles, the four derived variants, and the
 * two fonts, posed as `--brand-*` custom properties.
 *
 * Reuses `SitePreviewTokens` (`lib/site/types.ts`) rather than a second copy
 * of the same shape: the six roles and four variants are computed once, by
 * the database, and `site_spec_get`/`site_spec_patch` already return them in
 * `preview.tokens`. This is the same data `lib/site/tokens.ts`'s
 * `siteTokenVariables` reads for the site editor's own mockup (`--s-*`); this
 * file exists because the canvas is used across the whole paid space, not
 * only the site editor, and needs its own prefix so the two never collide on
 * a page that renders both.
 *
 * THE RULE, everywhere a `--brand-*` value is consumed:
 *   TEXT  -> the variant (`--brand-primary-text`, `--brand-secondary-text`,
 *            `--brand-accent-text`, and `--brand-cta-ink` for a CTA label)
 *   FILL  -> the brand color (`--brand-primary`, `--brand-secondary`,
 *            `--brand-accent`) — background, button, band, rule, border, chip
 *
 * `--brand-paper` and `--brand-light` are never the same job: paper is the
 * canvas's own background (the whole page, inside the frame); light is a
 * tinted band or card drawn ON TOP of it. Neither is a fill target for a
 * contrast fix, and neither has a text variant — they are surfaces.
 */
export function brandCanvasVariables(tokens: SitePreviewTokens): CSSProperties {
  return {
    "--brand-primary": tokens.primary,
    "--brand-secondary": tokens.secondary,
    "--brand-accent": tokens.accent,
    "--brand-paper": tokens.paper,
    "--brand-light": tokens.light_neutral,
    "--brand-dark": tokens.dark_neutral,
    "--brand-primary-text": tokens.primary_text,
    "--brand-secondary-text": tokens.secondary_text,
    "--brand-accent-text": tokens.accent_text,
    "--brand-cta-ink": tokens.cta_ink,
    "--brand-heading": `"${tokens.heading_font}", Georgia, serif`,
    "--brand-body": `"${tokens.body_font}", system-ui, sans-serif`,
  } as CSSProperties;
}
