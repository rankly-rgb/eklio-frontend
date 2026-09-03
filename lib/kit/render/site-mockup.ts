import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * A representative site-hero mockup — built for the brand guide PDF's
 * "site mockup, full width" page (Lot 5). Not a pixel copy of
 * `<BrandPreview size="full">` (a React/CSS component, not something this
 * server-side pipeline re-renders) — a satori composition using the same
 * hero copy and tokens: a nav bar, the overline/headline/subhead, and a CTA
 * button, full-bleed on paper. Close enough to "what the site looks like"
 * for a print reference; the real, interactive mockup lives in the site
 * editor, which this page's own copy should point back to.
 */

export const SITE_MOCKUP_WIDTH = 1600;
export const SITE_MOCKUP_HEIGHT = 1000;

export type SiteMockupInput = {
  practiceName: string;
  overline: string | null;
  headline: string;
  subhead: string;
  ctaLabel: string;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  primaryColor: string;
  ctaInk: string;
  paperColor: string;
  darkColor: string;
  lightColor: string;
};

export async function renderSiteMockup(input: SiteMockupInput): Promise<Buffer> {
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
      },
    },
    // Nav bar
    createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 72px",
          height: 96,
          borderBottom: `1px solid ${input.lightColor}`,
        },
      },
      createElement(
        "div",
        { style: { display: "flex", fontFamily: input.headingFont, fontSize: 26, fontWeight: 500, color: input.darkColor } },
        input.practiceName
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "10px 28px",
            backgroundColor: input.primaryColor,
            color: input.ctaInk,
            fontFamily: input.bodyFont,
            fontSize: 18,
            fontWeight: 700,
          },
        },
        input.ctaLabel
      )
    ),
    // Hero
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          padding: "0 72px",
          maxWidth: 1100,
        },
      },
      input.overline
        ? createElement(
            "div",
            {
              style: {
                display: "flex",
                alignSelf: "flex-start",
                borderRadius: 999,
                padding: "8px 22px",
                backgroundColor: input.primaryColor,
                color: input.ctaInk,
                fontFamily: input.bodyFont,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.02em",
              },
            },
            input.overline
          )
        : null,
      createElement(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 28,
            fontFamily: input.headingFont,
            fontSize: 76,
            fontWeight: 500,
            lineHeight: 1.05,
            color: input.darkColor,
          },
        },
        input.headline
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 24,
            fontFamily: input.bodyFont,
            fontSize: 26,
            color: input.darkColor,
            opacity: 0.75,
            maxWidth: 760,
          },
        },
        input.subhead
      )
    )
  );

  const svg = await satori(tree, {
    width: SITE_MOCKUP_WIDTH,
    height: SITE_MOCKUP_HEIGHT,
    fonts: [
      { name: input.headingFont, data: headingFontData, weight: 500, style: "normal" },
      { name: input.bodyFont, data: bodyFontData, weight: 700, style: "normal" },
    ],
  });

  return svgToPng(svg);
}
