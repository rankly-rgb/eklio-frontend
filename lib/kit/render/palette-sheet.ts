import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";

/*
 * palette_sheet_png — the six color roles (§3 of the contract), as swatches
 * with their role name and hex value. A pure function: same input, same
 * PNG, every time.
 */

export const PALETTE_SHEET_WIDTH = 1200;
export const PALETTE_SHEET_HEIGHT = 600;

const ROLE_LABEL: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  paper: "Paper",
  light_neutral: "Light neutral",
  dark_neutral: "Dark neutral",
};

const ROLE_ORDER = ["primary", "secondary", "accent", "paper", "light_neutral", "dark_neutral"] as const;

export type PaletteSheetInput = {
  tokens: {
    primary: string;
    secondary: string;
    accent: string;
    paper: string;
    light_neutral: string;
    dark_neutral: string;
  };
  bodyFont: string;
  googleFontsUrl: string;
};

export async function renderPaletteSheetPng(input: PaletteSheetInput): Promise<string> {
  const fontData = await getCachedFontBuffer(input.bodyFont, input.googleFontsUrl);

  const swatchWidth = PALETTE_SHEET_WIDTH / ROLE_ORDER.length;
  const labelBandHeight = 96;
  const swatchHeight = PALETTE_SHEET_HEIGHT - labelBandHeight;

  const swatches = ROLE_ORDER.map((role) =>
    createElement(
      "div",
      {
        key: role,
        style: {
          display: "flex",
          flexDirection: "column",
          width: swatchWidth,
          height: "100%",
        },
      },
      createElement("div", {
        style: {
          display: "flex",
          width: "100%",
          height: swatchHeight,
          backgroundColor: input.tokens[role],
          // A swatch this light or this pale needs a visible edge against a
          // white satori canvas background, or it reads as a gap, not a color.
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
        },
      }),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: labelBandHeight,
            alignItems: "center",
            justifyContent: "center",
            fontFamily: input.bodyFont,
            color: "#26211C",
          },
        },
        createElement("div", { style: { display: "flex", fontSize: 20, fontWeight: 700 } }, ROLE_LABEL[role]),
        createElement(
          "div",
          { style: { display: "flex", fontSize: 16, opacity: 0.7, marginTop: 4 } },
          input.tokens[role].toUpperCase()
        )
      )
    )
  );

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#FFFFFF",
      },
    },
    ...swatches
  );

  return satori(tree, {
    width: PALETTE_SHEET_WIDTH,
    height: PALETTE_SHEET_HEIGHT,
    fonts: [
      {
        name: input.bodyFont,
        data: fontData,
        weight: 700,
        style: "normal",
      },
    ],
  });
}
