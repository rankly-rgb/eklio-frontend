import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * cover_linkedin_1584x396 / cover_facebook_1640x624 (Lot 4.4, "Social").
 *
 * Both platforms overlay the profile photo on the BOTTOM-LEFT of the cover
 * (LinkedIn) or bottom-left-ish (Facebook, exact offset varies by viewport)
 * — content is deliberately kept clear of that corner rather than centred,
 * so a real upload doesn't get the practice name hidden behind the avatar.
 * Same full-bleed, tokens-driven language as `og_image_1200x630`: practice
 * name in the heading font, the selected direction's hero overline as a
 * supporting line, on the paper background.
 */

export type CoverInput = {
  practiceName: string;
  overline: string | null;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  primaryColor: string;
  ctaInk: string;
  paperColor: string;
  darkColor: string;
};

/** The avatar overlay zone to keep clear, as a fraction of the shorter (height) dimension. */
const AVATAR_CLEARANCE_RATIO = 1.6;

async function renderCover(width: number, height: number, input: CoverInput): Promise<Buffer> {
  const [headingFontData, bodyFontData] = await Promise.all([
    getCachedFontBuffer(input.headingFont, input.googleFontsUrl),
    getCachedFontBuffer(input.bodyFont, input.googleFontsUrl),
  ]);

  const avatarClearance = Math.round(height * AVATAR_CLEARANCE_RATIO);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: input.paperColor,
        alignItems: "center",
        paddingLeft: avatarClearance,
        paddingRight: Math.round(height * 0.6),
      },
    },
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      input.overline
        ? createElement(
            "div",
            {
              style: {
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                borderRadius: 999,
                padding: "8px 20px",
                backgroundColor: input.primaryColor,
                color: input.ctaInk,
                fontFamily: input.bodyFont,
                fontSize: Math.round(height * 0.05),
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
            marginTop: input.overline ? Math.round(height * 0.06) : 0,
            fontFamily: input.headingFont,
            fontWeight: 500,
            fontSize: Math.round(height * 0.16),
            color: input.darkColor,
          },
        },
        input.practiceName
      )
    )
  );

  const svg = await satori(tree, {
    width,
    height,
    fonts: [
      { name: input.headingFont, data: headingFontData, weight: 500, style: "normal" },
      { name: input.bodyFont, data: bodyFontData, weight: 700, style: "normal" },
    ],
  });
  return svgToPng(svg);
}

export const LINKEDIN_COVER_WIDTH = 1584;
export const LINKEDIN_COVER_HEIGHT = 396;
export function renderLinkedInCover(input: CoverInput): Promise<Buffer> {
  return renderCover(LINKEDIN_COVER_WIDTH, LINKEDIN_COVER_HEIGHT, input);
}

export const FACEBOOK_COVER_WIDTH = 1640;
export const FACEBOOK_COVER_HEIGHT = 624;
export function renderFacebookCover(input: CoverInput): Promise<Buffer> {
  return renderCover(FACEBOOK_COVER_WIDTH, FACEBOOK_COVER_HEIGHT, input);
}
