import type { SitePreviewTokens } from "@/lib/site/types";
import {
  renderWordmarkDark,
  renderWordmarkLight,
  renderWordmarkMonoBlack,
  renderWordmarkMonoWhite,
} from "@/lib/kit/render/wordmark";
import { renderPaletteSheetPng } from "@/lib/kit/render/palette-sheet";
import { renderOgImage } from "@/lib/kit/render/og-image";
import { svgToPng, svgToPngAtWidth } from "@/lib/kit/render/rasterize";

/*
 * The extension point for Lot 4.4/4.5: one entry per `asset_catalog.key`,
 * each a pure function from the kit's current tokens/copy to rendered
 * bytes.
 *
 * `wordmark_png_dark` is deliberately the first PNG-kind entry: it exercises
 * `@resvg/resvg-js` (a native binary) for the first time, ahead of the rest
 * of the identity/web/color catalogue, so a native-binary deploy failure is
 * caught on one asset rather than after twenty-five.
 *
 * Every identity asset here is trimmed to its ink bounds with zero padding
 * (see rasterize.ts's trim rule) — the exception is a mark deliberately
 * inset in a fixed square (avatar_400, favicons), which renders through
 * `svgToPng` untrimmed instead.
 */

export type RenderContext = {
  tokens: SitePreviewTokens;
  practiceName: string | null;
  googleFontsUrl: string;
  /** Only asset renderers that need hero copy (og_image_1200x630) read this. */
  hero: { overline: string; headline: string } | null;
};

export type RenderedAsset = {
  bytes: Buffer;
  contentType: string;
  width?: number;
  height?: number;
};

type Renderer = (ctx: RenderContext) => Promise<RenderedAsset>;

const RENDERERS: Record<string, Renderer> = {
  wordmark_svg_dark: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_svg_dark needs a practice name to render");
    }
    const trimmed = await renderWordmarkDark({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      darkColor: ctx.tokens.dark_neutral,
    });
    return {
      bytes: Buffer.from(trimmed.svg, "utf8"),
      contentType: "image/svg+xml",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  wordmark_png_dark: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_png_dark needs a practice name to render");
    }
    const trimmed = await renderWordmarkDark({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      darkColor: ctx.tokens.dark_neutral,
    });
    return {
      bytes: trimmed.png,
      contentType: "image/png",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  wordmark_svg_light: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_svg_light needs a practice name to render");
    }
    const trimmed = await renderWordmarkLight({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      paperColor: ctx.tokens.paper,
    });
    return {
      bytes: Buffer.from(trimmed.svg, "utf8"),
      contentType: "image/svg+xml",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  wordmark_svg_mono_black: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_svg_mono_black needs a practice name to render");
    }
    const trimmed = await renderWordmarkMonoBlack({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
    });
    return {
      bytes: Buffer.from(trimmed.svg, "utf8"),
      contentType: "image/svg+xml",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  wordmark_svg_mono_white: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_svg_mono_white needs a practice name to render");
    }
    const trimmed = await renderWordmarkMonoWhite({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
    });
    return {
      bytes: Buffer.from(trimmed.svg, "utf8"),
      contentType: "image/svg+xml",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  wordmark_png_light_1200: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_png_light_1200 needs a practice name to render");
    }
    const trimmed = await renderWordmarkLight({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      paperColor: ctx.tokens.paper,
    });
    const png = svgToPngAtWidth(trimmed.svg, 1200);
    const scale = 1200 / trimmed.width;
    return {
      bytes: png,
      contentType: "image/png",
      width: 1200,
      height: Math.round(trimmed.height * scale),
    };
  },
  wordmark_png_light_2400: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_png_light_2400 needs a practice name to render");
    }
    const trimmed = await renderWordmarkLight({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      paperColor: ctx.tokens.paper,
    });
    const png = svgToPngAtWidth(trimmed.svg, 2400);
    const scale = 2400 / trimmed.width;
    return {
      bytes: png,
      contentType: "image/png",
      width: 2400,
      height: Math.round(trimmed.height * scale),
    };
  },
  palette_sheet_png: async (ctx) => {
    const svg = await renderPaletteSheetPng({
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
    });
    // Not trimmed: the layout already fills the canvas edge-to-edge (six
    // equal swatches, no designed-in margin), so trimToInk would be a
    // no-op here — svgToPng skips the pointless bbox computation.
    return {
      bytes: svgToPng(svg),
      contentType: "image/png",
      width: 1200,
      height: 600,
    };
  },
  og_image_1200x630: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("og_image_1200x630 needs a practice name to render");
    }
    if (!ctx.hero) {
      throw new Error("og_image_1200x630 needs hero copy to render");
    }
    const svg = await renderOgImage({
      practiceName: ctx.practiceName,
      overline: ctx.hero.overline,
      headline: ctx.hero.headline,
      headingFont: ctx.tokens.heading_font,
      bodyFont: ctx.tokens.body_font,
      googleFontsUrl: ctx.googleFontsUrl,
      primaryColor: ctx.tokens.primary,
      ctaInk: ctx.tokens.cta_ink,
      paperColor: ctx.tokens.paper,
      darkColor: ctx.tokens.dark_neutral,
    });
    // Deliberately NOT trimmed — see DECISIONS.md, "og_image_1200x630 is
    // not trimmed to ink bounds": platforms display this at exactly this
    // size, so a cropped file would be re-cropped unpredictably by
    // whichever platform renders it.
    return {
      bytes: svgToPng(svg),
      contentType: "image/png",
      width: 1200,
      height: 630,
    };
  },
};

export function getRenderer(key: string): Renderer | null {
  return RENDERERS[key] ?? null;
}
