import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { trimToInk, type TrimmedRender } from "@/lib/kit/render/rasterize";

/*
 * wordmark_svg_dark / wordmark_png_dark — the first two assets shipped end
 * to end. Pure functions: same input, same output, every time (given the
 * same cached font bytes) — no LLM, no image model, nothing
 * non-deterministic.
 *
 * `createElement` rather than JSX: this file is plain `.ts`, not `.tsx` —
 * vitest's config here has no JSX transform configured (`vitest.config.ts`'s
 * own comment says so), and satori only needs the element-tree shape
 * `createElement` already produces, no real React render involved.
 *
 * TRACKING — an honest note, not a claim. `letterSpacing: -0.02em` below is
 * a reasonable default for a display-size serif wordmark (metric tracking
 * reads loose at this size for most typefaces), chosen by this renderer,
 * not a value read off the brief: the brief's exact "optical tracking"
 * wording and any target ratio it specified are not in hand while writing
 * this. If the brief named a specific method or number, this does not
 * implement it — say so and it gets corrected.
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

/**
 * Renders the wordmark at a given ink colour. Shared by every ink treatment
 * (`dark`, `light`, `mono_black`, `mono_white`) — same layout, same font
 * weight, only the fill differs, so the four treatments stay visually
 * identical apart from ink.
 */
async function renderWordmarkSvgWithInk(
  input: Omit<WordmarkInput, "darkColor">,
  ink: string
): Promise<string> {
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
          color: ink,
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

/** The raw satori output — full 960x240 canvas, untrimmed. Use `renderWordmarkDark` below unless you specifically need this. */
export async function renderWordmarkSvgDark(input: WordmarkInput): Promise<string> {
  return renderWordmarkSvgWithInk(input, input.darkColor);
}

/**
 * The wordmark, trimmed to its ink bounds (see rasterize.ts's trim rule) —
 * one render, one crop, so the svg and png outputs stay pixel-consistent.
 * `wordmark_svg_dark` and `wordmark_png_dark` both call this and pick the
 * field they need, rather than each re-rendering from scratch.
 */
export async function renderWordmarkDark(input: WordmarkInput): Promise<TrimmedRender> {
  const svg = await renderWordmarkSvgDark(input);
  return trimToInk(svg);
}

/**
 * `wordmark_svg_light` / `wordmark_png_light` — the counterpart treatment
 * for a dark background. Ink is `tokens.paper`, the kit's own light colour,
 * not a literal white — same reasoning as `darkColor` never being a
 * supposed black: the mark stays on-brand at either end of the palette.
 */
export type WordmarkLightInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  /** `tokens.paper` — the ink colour for the light treatment. */
  paperColor: string;
};

export async function renderWordmarkLight(input: WordmarkLightInput): Promise<TrimmedRender> {
  const svg = await renderWordmarkSvgWithInk(input, input.paperColor);
  return trimToInk(svg);
}

/**
 * `wordmark_svg_mono_black` / `wordmark_svg_mono_white` — single-colour
 * treatments for contexts that can't carry brand colour at all (engraving,
 * a one-colour print run, a stamp). Ink is a literal black or white on
 * purpose here: "mono" means fixed, not brand-token-derived.
 */
export type WordmarkMonoInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
};

export async function renderWordmarkMonoBlack(input: WordmarkMonoInput): Promise<TrimmedRender> {
  const svg = await renderWordmarkSvgWithInk(input, "#000000");
  return trimToInk(svg);
}

export async function renderWordmarkMonoWhite(input: WordmarkMonoInput): Promise<TrimmedRender> {
  const svg = await renderWordmarkSvgWithInk(input, "#FFFFFF");
  return trimToInk(svg);
}
