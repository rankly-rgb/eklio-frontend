import type { SitePreviewTokens } from "@/lib/site/types";
import {
  renderWordmarkSvgDark,
  WORDMARK_WIDTH,
  WORDMARK_HEIGHT,
} from "@/lib/kit/render/wordmark";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * The extension point for Lot 4.4/4.5: one entry per `asset_catalog.key`,
 * each a pure function from the kit's current tokens/copy to rendered
 * bytes.
 *
 * `wordmark_png_dark` is deliberately the first PNG-kind entry: it exercises
 * `@resvg/resvg-js` (a native binary) for the first time, ahead of the rest
 * of the identity/web/color catalogue, so a native-binary deploy failure is
 * caught on one asset rather than after twenty-five.
 */

export type RenderContext = {
  tokens: SitePreviewTokens;
  practiceName: string | null;
  googleFontsUrl: string;
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
    const svg = await renderWordmarkSvgDark({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      darkColor: ctx.tokens.dark_neutral,
    });
    return { bytes: Buffer.from(svg, "utf8"), contentType: "image/svg+xml" };
  },
  wordmark_png_dark: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("wordmark_png_dark needs a practice name to render");
    }
    const svg = await renderWordmarkSvgDark({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      darkColor: ctx.tokens.dark_neutral,
    });
    const png = svgToPng(svg);
    return {
      bytes: png,
      contentType: "image/png",
      width: WORDMARK_WIDTH,
      height: WORDMARK_HEIGHT,
    };
  },
};

export function getRenderer(key: string): Renderer | null {
  return RENDERERS[key] ?? null;
}
