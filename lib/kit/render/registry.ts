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
import { renderMonogramSvg, renderMonogramPng512 } from "@/lib/kit/render/monogram";
import { renderMonogramIconSvg } from "@/lib/kit/render/monogram-icon";
import { renderPaletteAse, renderTokensJson, renderColorsCss } from "@/lib/kit/render/color-exports";
import {
  renderStatementOrQuestionPost,
  renderNotesPost,
  renderSignature,
} from "@/lib/kit/render/social-posts";
import { renderLinkedInCover, renderFacebookCover } from "@/lib/kit/render/covers";
import { renderBusinessCardFront, renderBusinessCardBack } from "@/lib/kit/render/business-card";
import type { SocialTemplates } from "@/lib/brand/shapes";

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
  /** Only asset renderers that need hero copy (og_image_1200x630, the covers) read this. */
  hero: { overline: string; headline: string } | null;
  /** Only the social post renderers read this — the kit-level 4-tuple (statement/question/notes/signature). */
  socialTemplates: SocialTemplates | null;
  /** Only the signature social renderers and the print/document renderers read this. */
  practitionerLine: string | null;
};

export type RenderedAsset = {
  bytes: Buffer;
  contentType: string;
  width?: number;
  height?: number;
};

type Renderer = (ctx: RenderContext) => Promise<RenderedAsset>;

function socialTokens(ctx: RenderContext) {
  return {
    primary: ctx.tokens.primary,
    secondary: ctx.tokens.secondary,
    paper: ctx.tokens.paper,
    light_neutral: ctx.tokens.light_neutral,
    dark_neutral: ctx.tokens.dark_neutral,
    heading_font: ctx.tokens.heading_font,
    body_font: ctx.tokens.body_font,
  };
}

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
  monogram_svg: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("monogram_svg needs a practice name to render");
    }
    const trimmed = await renderMonogramSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      primaryColor: ctx.tokens.primary,
    });
    return {
      bytes: Buffer.from(trimmed.svg, "utf8"),
      contentType: "image/svg+xml",
      width: trimmed.width,
      height: trimmed.height,
    };
  },
  monogram_png_512_primary: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("monogram_png_512_primary needs a practice name to render");
    }
    const png = await renderMonogramPng512({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      ink: ctx.tokens.cta_ink,
      background: ctx.tokens.primary,
    });
    return { bytes: png, contentType: "image/png", width: 512, height: 512 };
  },
  monogram_png_512_paper: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("monogram_png_512_paper needs a practice name to render");
    }
    const png = await renderMonogramPng512({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      ink: ctx.tokens.primary,
      background: ctx.tokens.paper,
    });
    return { bytes: png, contentType: "image/png", width: 512, height: 512 };
  },
  monogram_png_512_transparent: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("monogram_png_512_transparent needs a practice name to render");
    }
    const png = await renderMonogramPng512({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      ink: ctx.tokens.primary,
    });
    return { bytes: png, contentType: "image/png", width: 512, height: 512 };
  },
  favicon_16: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("favicon_16 needs a practice name to render");
    }
    const svg = await renderMonogramIconSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
      forceSingleLetter: true,
    });
    return { bytes: svgToPngAtWidth(svg, 16), contentType: "image/png", width: 16, height: 16 };
  },
  favicon_32: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("favicon_32 needs a practice name to render");
    }
    const svg = await renderMonogramIconSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
      forceSingleLetter: true,
    });
    return { bytes: svgToPngAtWidth(svg, 32), contentType: "image/png", width: 32, height: 32 };
  },
  apple_touch_icon_180: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("apple_touch_icon_180 needs a practice name to render");
    }
    const svg = await renderMonogramIconSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
    });
    return { bytes: svgToPngAtWidth(svg, 180), contentType: "image/png", width: 180, height: 180 };
  },
  icon_512: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("icon_512 needs a practice name to render");
    }
    const svg = await renderMonogramIconSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
    });
    return { bytes: svgToPngAtWidth(svg, 512), contentType: "image/png", width: 512, height: 512 };
  },
  avatar_400: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("avatar_400 needs a practice name to render");
    }
    const svg = await renderMonogramIconSvg({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      background: ctx.tokens.primary,
      ink: ctx.tokens.cta_ink,
    });
    return { bytes: svgToPngAtWidth(svg, 400), contentType: "image/png", width: 400, height: 400 };
  },
  manifest_values_json: async (ctx) => {
    if (!ctx.practiceName) {
      throw new Error("manifest_values_json needs a practice name to render");
    }
    // The PWA manifest spec recommends short_name stay short enough to fit
    // under a home-screen icon (~12 characters is the usual guidance) —
    // trimmed to the nearest whole word rather than mid-word.
    const shortName =
      ctx.practiceName.length <= 12
        ? ctx.practiceName
        : ctx.practiceName.slice(0, 12).replace(/\s+\S*$/, "");
    const manifest = {
      name: ctx.practiceName,
      short_name: shortName || ctx.practiceName.slice(0, 12),
      theme_color: ctx.tokens.primary,
      background_color: ctx.tokens.paper,
      icons: [
        { src: "icon_512.png", sizes: "512x512", type: "image/png" },
        { src: "apple_touch_icon_180.png", sizes: "180x180", type: "image/png" },
      ],
    };
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    return { bytes, contentType: "application/json" };
  },
  palette_ase: async (ctx) => {
    const bytes = renderPaletteAse({
      primary: ctx.tokens.primary,
      secondary: ctx.tokens.secondary,
      accent: ctx.tokens.accent,
      paper: ctx.tokens.paper,
      light_neutral: ctx.tokens.light_neutral,
      dark_neutral: ctx.tokens.dark_neutral,
      primary_text: ctx.tokens.primary_text,
      secondary_text: ctx.tokens.secondary_text,
      accent_text: ctx.tokens.accent_text,
      cta_ink: ctx.tokens.cta_ink,
    });
    return { bytes, contentType: "application/octet-stream" };
  },
  tokens_json: async (ctx) => {
    const bytes = renderTokensJson({
      primary: ctx.tokens.primary,
      secondary: ctx.tokens.secondary,
      accent: ctx.tokens.accent,
      paper: ctx.tokens.paper,
      light_neutral: ctx.tokens.light_neutral,
      dark_neutral: ctx.tokens.dark_neutral,
      primary_text: ctx.tokens.primary_text,
      secondary_text: ctx.tokens.secondary_text,
      accent_text: ctx.tokens.accent_text,
      cta_ink: ctx.tokens.cta_ink,
    });
    return { bytes, contentType: "application/json" };
  },
  colors_css: async (ctx) => {
    const bytes = renderColorsCss({
      primary: ctx.tokens.primary,
      secondary: ctx.tokens.secondary,
      accent: ctx.tokens.accent,
      paper: ctx.tokens.paper,
      light_neutral: ctx.tokens.light_neutral,
      dark_neutral: ctx.tokens.dark_neutral,
      primary_text: ctx.tokens.primary_text,
      secondary_text: ctx.tokens.secondary_text,
      accent_text: ctx.tokens.accent_text,
      cta_ink: ctx.tokens.cta_ink,
    });
    return { bytes, contentType: "text/css" };
  },
  post_statement_1080: async (ctx) => {
    const template = ctx.socialTemplates?.[0];
    if (!template) throw new Error("post_statement_1080 needs socialTemplates to render");
    const bytes = await renderStatementOrQuestionPost({
      template,
      tokens: socialTokens(ctx),
      googleFontsUrl: ctx.googleFontsUrl,
    });
    return { bytes, contentType: "image/png", width: 1080, height: 1080 };
  },
  post_question_1080: async (ctx) => {
    const template = ctx.socialTemplates?.[1];
    if (!template) throw new Error("post_question_1080 needs socialTemplates to render");
    const bytes = await renderStatementOrQuestionPost({
      template,
      tokens: socialTokens(ctx),
      googleFontsUrl: ctx.googleFontsUrl,
    });
    return { bytes, contentType: "image/png", width: 1080, height: 1080 };
  },
  post_notes_1080: async (ctx) => {
    const template = ctx.socialTemplates?.[2];
    if (!template) throw new Error("post_notes_1080 needs socialTemplates to render");
    const bytes = await renderNotesPost({
      template,
      tokens: socialTokens(ctx),
      googleFontsUrl: ctx.googleFontsUrl,
    });
    return { bytes, contentType: "image/png", width: 1080, height: 1080 };
  },
  post_signature_1080: async (ctx) => {
    const template = ctx.socialTemplates?.[3];
    if (!template) throw new Error("post_signature_1080 needs socialTemplates to render");
    const bytes = await renderSignature({
      template,
      tokens: socialTokens(ctx),
      practitionerLine: ctx.practitionerLine,
      googleFontsUrl: ctx.googleFontsUrl,
      shape: "square",
    });
    return { bytes, contentType: "image/png", width: 1080, height: 1080 };
  },
  story_1080x1920: async (ctx) => {
    const template = ctx.socialTemplates?.[3];
    if (!template) throw new Error("story_1080x1920 needs socialTemplates to render");
    const bytes = await renderSignature({
      template,
      tokens: socialTokens(ctx),
      practitionerLine: ctx.practitionerLine,
      googleFontsUrl: ctx.googleFontsUrl,
      shape: "story",
    });
    return { bytes, contentType: "image/png", width: 1080, height: 1920 };
  },
  cover_linkedin_1584x396: async (ctx) => {
    if (!ctx.practiceName) throw new Error("cover_linkedin_1584x396 needs a practice name to render");
    const bytes = await renderLinkedInCover({
      practiceName: ctx.practiceName,
      overline: ctx.hero?.overline ?? null,
      headingFont: ctx.tokens.heading_font,
      bodyFont: ctx.tokens.body_font,
      googleFontsUrl: ctx.googleFontsUrl,
      primaryColor: ctx.tokens.primary,
      ctaInk: ctx.tokens.cta_ink,
      paperColor: ctx.tokens.paper,
      darkColor: ctx.tokens.dark_neutral,
    });
    return { bytes, contentType: "image/png", width: 1584, height: 396 };
  },
  cover_facebook_1640x624: async (ctx) => {
    if (!ctx.practiceName) throw new Error("cover_facebook_1640x624 needs a practice name to render");
    const bytes = await renderFacebookCover({
      practiceName: ctx.practiceName,
      overline: ctx.hero?.overline ?? null,
      headingFont: ctx.tokens.heading_font,
      bodyFont: ctx.tokens.body_font,
      googleFontsUrl: ctx.googleFontsUrl,
      primaryColor: ctx.tokens.primary,
      ctaInk: ctx.tokens.cta_ink,
      paperColor: ctx.tokens.paper,
      darkColor: ctx.tokens.dark_neutral,
    });
    return { bytes, contentType: "image/png", width: 1640, height: 624 };
  },
  business_card_front: async (ctx) => {
    if (!ctx.practiceName) throw new Error("business_card_front needs a practice name to render");
    const bytes = await renderBusinessCardFront({
      practiceName: ctx.practiceName,
      practitionerLine: ctx.practitionerLine,
      headingFont: ctx.tokens.heading_font,
      bodyFont: ctx.tokens.body_font,
      googleFontsUrl: ctx.googleFontsUrl,
      paperColor: ctx.tokens.paper,
      darkColor: ctx.tokens.dark_neutral,
      primaryColor: ctx.tokens.primary,
    });
    return { bytes, contentType: "image/png", width: 1125, height: 675 };
  },
  business_card_back: async (ctx) => {
    if (!ctx.practiceName) throw new Error("business_card_back needs a practice name to render");
    const bytes = await renderBusinessCardBack({
      practiceName: ctx.practiceName,
      headingFont: ctx.tokens.heading_font,
      googleFontsUrl: ctx.googleFontsUrl,
      primaryColor: ctx.tokens.primary,
      ctaInk: ctx.tokens.cta_ink,
    });
    return { bytes, contentType: "image/png", width: 1125, height: 675 };
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
