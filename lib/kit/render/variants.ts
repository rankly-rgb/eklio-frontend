import type { RenderContext, RenderedAsset } from "@/lib/kit/render/registry";
import { renderWordmarkDark, renderWordmarkLight } from "@/lib/kit/render/wordmark";
import { renderMonogramIconSvg } from "@/lib/kit/render/monogram-icon";
import { renderPaletteSheetPng } from "@/lib/kit/render/palette-sheet";
import { renderOgImage } from "@/lib/kit/render/og-image";
import { svgToPngAtWidth } from "@/lib/kit/render/rasterize";

/*
 * ── SIZES AND FORMATS ON DEMAND ─────────────────────────────────────────
 *
 * A width she asks for after the fact is the SAME rendering she already
 * paid for, re-rasterized from the same vector. It is not a generation:
 * nothing in this file, and nothing on the route that calls it, touches
 * `consume_generation_credit` — see
 * `app/__tests__/download-is-never-a-generation.test.ts`, which enumerates
 * this path and fails if that ever stops being true.
 *
 * Only keys whose PIXELS COME FROM A VECTOR THIS REPO CAN REBUILD appear
 * here, and the catalogue's `available_sizes` / `available_formats` are
 * seeded to match exactly this map (migration 20260905185500). Renderers
 * that hand back a Buffer with no SVG behind it — `business_card_*`,
 * `monogram_png_512_*`, the social posts — are deliberately absent: they
 * would have to be re-laid-out, not re-rasterized, and a menu entry that
 * fails on click is worse than no menu entry.
 *
 * The registry is untouched. Every builder below calls the same exported
 * SVG function its `registry.ts` entry already calls, so the native
 * rendition and a variant of it can never drift apart.
 */

/** The vector a variant is rasterized from, with its own intrinsic proportions. */
type VariantSource = {
  svg: string;
  /** Intrinsic height ÷ width — the only thing needed to report a variant's height. */
  aspect: number;
};

type SourceBuilder = (ctx: RenderContext) => Promise<VariantSource>;

function requirePracticeName(ctx: RenderContext, key: string): string {
  if (!ctx.practiceName) {
    throw new Error(`${key} needs a practice name to render`);
  }
  return ctx.practiceName;
}

/**
 * The icon mark, square by construction. `forceSingleLetter` is what
 * separates the two favicons from the larger marks in `registry.ts`, and it
 * has to stay separated here too — a favicon that gained a second letter at
 * 48px would not be the same mark she approved at 32.
 */
function iconSource(key: string, forceSingleLetter: boolean): SourceBuilder {
  return async (ctx) => ({
    svg: await renderMonogramIconSvg({
      practiceName: requirePracticeName(ctx, key),
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
      forceSingleLetter,
    }),
    aspect: 1,
  });
}

function wordmarkDarkSource(key: string): SourceBuilder {
  return async (ctx) => {
    const trimmed = await renderWordmarkDark({
      practiceName: requirePracticeName(ctx, key),
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      darkColor: ctx.tokens.dark_neutral,
    });
    return { svg: trimmed.svg, aspect: trimmed.height / trimmed.width };
  };
}

function wordmarkLightSource(key: string): SourceBuilder {
  return async (ctx) => {
    const trimmed = await renderWordmarkLight({
      practiceName: requirePracticeName(ctx, key),
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      paperColor: ctx.tokens.paper,
    });
    return { svg: trimmed.svg, aspect: trimmed.height / trimmed.width };
  };
}

const SOURCES: Record<string, SourceBuilder> = {
  favicon_16: iconSource("favicon_16", true),
  favicon_32: iconSource("favicon_32", true),
  apple_touch_icon_180: iconSource("apple_touch_icon_180", false),
  icon_512: iconSource("icon_512", false),
  avatar_400: iconSource("avatar_400", false),
  wordmark_png_dark: wordmarkDarkSource("wordmark_png_dark"),
  wordmark_png_light_1200: wordmarkLightSource("wordmark_png_light_1200"),
  wordmark_png_light_2400: wordmarkLightSource("wordmark_png_light_2400"),
  palette_sheet_png: async (ctx) => ({
    svg: await renderPaletteSheetPng({
      tokens: {
        primary: ctx.tokens.primary,
        secondary: ctx.tokens.secondary,
        accent: ctx.tokens.accent,
        paper: ctx.tokens.paper,
        light_neutral: ctx.tokens.light_neutral,
        dark_neutral: ctx.tokens.dark_neutral,
      },
      bodyFont: ctx.tokens.body_font,
      googleFontsUrl: ctx.googleFontsUrl,
    }),
    aspect: 600 / 1200,
  }),
  og_image_1200x630: async (ctx) => {
    const practiceName = requirePracticeName(ctx, "og_image_1200x630");
    if (!ctx.hero) {
      throw new Error("og_image_1200x630 needs hero copy to render");
    }
    return {
      svg: await renderOgImage({
        practiceName,
        overline: ctx.hero.overline,
        headline: ctx.hero.headline,
        headingFont: ctx.tokens.heading_font,
        bodyFont: ctx.tokens.body_font,
        googleFontsUrl: ctx.googleFontsUrl,
        primaryColor: ctx.tokens.primary,
        ctaInk: ctx.tokens.cta_ink,
        paperColor: ctx.tokens.paper,
        darkColor: ctx.tokens.dark_neutral,
      }),
      aspect: 630 / 1200,
    };
  },
};

/** The catalogue keys that can be re-rendered at another width or in another format. */
export function hasVariants(key: string): boolean {
  return key in SOURCES;
}

export type VariantRequest = {
  /** A pixel width, or 0 for the catalogue row's own native rendition. */
  size: number;
  /** An alternative format, or "" for the catalogue row's own kind. */
  format: string;
};

/**
 * Renders one variant. Returns `null` for a key with no vector source —
 * the caller falls back to the registry's native renderer, which is also
 * what a request for `{ size: 0, format: "" }` should go through.
 *
 * A `size` alongside `format: "svg"` is ignored on purpose rather than
 * refused: an SVG has no pixel width to render at, and the storage path the
 * database hands back for that pair is the same either way.
 */
export async function renderVariant(
  key: string,
  ctx: RenderContext,
  { size, format }: VariantRequest
): Promise<RenderedAsset | null> {
  const build = SOURCES[key];
  if (!build) return null;
  // The native rendition belongs to the registry, whose entry may trim,
  // pad or inset in ways this file deliberately knows nothing about.
  if (size === 0 && format === "") return null;

  const source = await build(ctx);

  if (format === "svg") {
    return {
      bytes: Buffer.from(source.svg, "utf8"),
      contentType: "image/svg+xml",
    };
  }

  return {
    bytes: svgToPngAtWidth(source.svg, size),
    contentType: "image/png",
    width: size,
    height: Math.round(size * source.aspect),
  };
}
