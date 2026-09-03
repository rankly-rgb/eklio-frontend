import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";

/*
 * og_image_1200x630 — the social-share preview card. Deliberately NOT
 * trimmed to ink bounds (see DECISIONS.md, "og_image_1200x630 is not
 * trimmed"): platforms that read `og:image` display it at exactly this
 * size, so the canvas is designed full-bleed on purpose.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type OgImageInput = {
  practiceName: string;
  overline: string;
  headline: string;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  primaryColor: string;
  ctaInk: string;
  paperColor: string;
  darkColor: string;
};

export async function renderOgImage(input: OgImageInput): Promise<string> {
  // Both fonts come from the same direction's google_fonts_url — one CSS
  // fetch per family, exactly like the wordmark renderer.
  const [headingFontData, bodyFontData] = await Promise.all([
    getCachedFontBuffer(input.headingFont, input.googleFontsUrl),
    getCachedFontBuffer(input.bodyFont, input.googleFontsUrl),
  ]);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: input.paperColor,
        padding: 80,
        justifyContent: "center",
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          borderRadius: 999,
          padding: "10px 24px",
          backgroundColor: input.primaryColor,
          color: input.ctaInk,
          fontFamily: input.bodyFont,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.02em",
        },
      },
      input.overline
    ),
    createElement(
      "div",
      {
        style: {
          display: "flex",
          marginTop: 36,
          fontFamily: input.headingFont,
          fontSize: 64,
          fontWeight: 500,
          lineHeight: 1.1,
          color: input.darkColor,
          maxWidth: 900,
        },
      },
      input.headline
    ),
    createElement(
      "div",
      {
        style: {
          display: "flex",
          marginTop: 28,
          fontFamily: input.bodyFont,
          fontSize: 28,
          color: input.darkColor,
          opacity: 0.75,
        },
      },
      input.practiceName
    )
  );

  return satori(tree, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: [
      { name: input.headingFont, data: headingFontData, weight: 500, style: "normal" },
      { name: input.bodyFont, data: bodyFontData, weight: 700, style: "normal" },
    ],
  });
}
