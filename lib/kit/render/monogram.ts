import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { trimToInk, svgToPng, type TrimmedRender } from "@/lib/kit/render/rasterize";

/*
 * monogram_svg / monogram_png_512 (Lot 4.4, "Identity, remaining").
 *
 * `monogramLetters` is shared with every other monogram-based asset in the
 * catalogue (the favicons, icon_512, avatar_400 — see monogram-icon.ts): one
 * or two letters from the practice name, first letters of the first two
 * words, or one letter if the name is a single word. `forceSingleLetter`
 * exists only for the two smallest favicon sizes, per the brief's explicit
 * exception ("At 16 and 32 use the first letter only").
 */
export function monogramLetters(practiceName: string, forceSingleLetter = false): string {
  const words = practiceName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (forceSingleLetter || words.length === 1) {
    return words[0][0].toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

const MONOGRAM_CANVAS = 512;
const MONOGRAM_FONT_SIZE = 260;
const MONOGRAM_WEIGHT = 600;

async function renderMonogramSquareSvg(
  letters: string,
  headingFont: string,
  fontData: ArrayBuffer,
  ink: string,
  background: string | undefined
): Promise<string> {
  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        ...(background ? { backgroundColor: background } : {}),
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: headingFont,
          fontSize: MONOGRAM_FONT_SIZE,
          fontWeight: MONOGRAM_WEIGHT,
          color: ink,
        },
      },
      letters
    )
  );

  return satori(tree, {
    width: MONOGRAM_CANVAS,
    height: MONOGRAM_CANVAS,
    fonts: [{ name: headingFont, data: fontData, weight: MONOGRAM_WEIGHT, style: "normal" }],
  });
}

export type MonogramInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  /** `tokens.primary` — the standalone SVG's one ink treatment. */
  primaryColor: string;
};

/**
 * `monogram_svg` — the one standalone vector treatment: ink `tokens.primary`,
 * no background, trimmed to ink bounds (the brief's trim rule applies to
 * "the standalone monogram SVG only" among the fixed-canvas monogram
 * assets — see the file header on rasterize.ts).
 */
export async function renderMonogramSvg(input: MonogramInput): Promise<TrimmedRender> {
  const letters = monogramLetters(input.practiceName);
  const fontData = await getCachedFontBuffer(input.headingFont, input.googleFontsUrl);
  const svg = await renderMonogramSquareSvg(letters, input.headingFont, fontData, input.primaryColor, undefined);
  return trimToInk(svg);
}

export type MonogramPngInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  ink: string;
  /** Omit for the transparent treatment. */
  background?: string;
};

/**
 * `monogram_png_512` in its three treatments (on `primary`, on `paper`,
 * transparent) — a fixed 512x512 canvas, kept whole (never trimmed): "every
 * fixed-canvas asset keeps it" (POST_PURCHASE_BRIEF.md). Each treatment is a
 * separate `asset_catalog` key (`monogram_png_512_primary`/`_paper`/
 * `_transparent`) — see DECISIONS.md for why one row can't hold three files.
 */
export async function renderMonogramPng512(input: MonogramPngInput): Promise<Buffer> {
  const letters = monogramLetters(input.practiceName);
  const fontData = await getCachedFontBuffer(input.headingFont, input.googleFontsUrl);
  const svg = await renderMonogramSquareSvg(
    letters,
    input.headingFont,
    fontData,
    input.ink,
    input.background
  );
  return svgToPng(svg);
}
