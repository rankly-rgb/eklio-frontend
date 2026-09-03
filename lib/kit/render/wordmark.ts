import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";

/*
 * wordmark_svg_dark — the one asset Lot 4.1–4.3 ships end to end. A pure
 * function: same input, same SVG, every time (given the same cached font
 * bytes) — no LLM, no image model, nothing non-deterministic.
 *
 * `createElement` rather than JSX: this file is plain `.ts`, not `.tsx` —
 * vitest's config here has no JSX transform configured (`vitest.config.ts`'s
 * own comment says so), and satori only needs the element-tree shape
 * `createElement` already produces, no real React render involved.
 */

export const WORDMARK_WIDTH = 960;
export const WORDMARK_HEIGHT = 240;

export type WordmarkInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  /** `tokens.dark_neutral` — the ink colour, never a supposed black. */
  darkColor: string;
};

export async function renderWordmarkSvgDark(input: WordmarkInput): Promise<string> {
  const fontData = await getCachedFontBuffer(input.headingFont, input.googleFontsUrl);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: input.headingFont,
          fontSize: 84,
          color: input.darkColor,
          letterSpacing: "-0.02em",
        },
      },
      input.practiceName
    )
  );

  return satori(tree, {
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
    fonts: [
      {
        name: input.headingFont,
        data: fontData,
        weight: 500,
        style: "normal",
      },
    ],
  });
}
