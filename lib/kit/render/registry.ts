import type { SitePreviewTokens } from "@/lib/site/types";
import { renderWordmarkDark } from "@/lib/kit/render/wordmark";

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
};

export function getRenderer(key: string): Renderer | null {
  return RENDERERS[key] ?? null;
}
