import { createElement } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { monogramLetters } from "@/lib/kit/render/monogram";

/*
 * The shared square icon geometry behind favicon_16, favicon_32,
 * apple_touch_icon_180, icon_512, and avatar_400 — all five are the same
 * rule (POST_PURCHASE_BRIEF.md, "Web" / "Social"): "monogram on primary,
 * inset inside a 78% inscribed circle so a circular crop never clips it."
 *
 * WHY A TWO-PASS RENDER. satori lays out text in a flex box; it has no
 * notion of "make this glyph's ink fit inside a circle of a given size." To
 * actually satisfy that geometrically rather than eyeball a font-size
 * constant, this measures the glyph's real rendered ink bounds once (pass
 * 1, at a large reference font size, via resvg's innerBBox — the same
 * primitive `trimToInk` uses), computes the diagonal of that bounding box
 * (the smallest circle guaranteed to contain a rotated/irregular glyph
 * shape is bounded by its bbox diagonal — a conservative, not exact, fit,
 * which is the right direction to be conservative in for "never clips"),
 * and scales the font size so that diagonal equals the target inset
 * diameter before the real, final render (pass 2). Deterministic — same
 * inputs, same two renders, same output, every time.
 *
 * The one imprecision worth naming: satori centers the text's LAYOUT box,
 * not its visual ink centroid — for a one- or two-character monogram the
 * difference is a few pixels of baseline offset, not a design defect this
 * renderer claims to have solved. Same honesty bar as wordmark.ts's
 * tracking note.
 */

const MEASURE_CANVAS = 1024;
const MEASURE_FONT_SIZE = 640;
const ICON_WEIGHT = 600;
const REFERENCE_CANVAS = 512;
const DEFAULT_INSET_RATIO = 0.78;

async function measureGlyphDiagonal(
  letters: string,
  headingFont: string,
  fontData: ArrayBuffer
): Promise<number> {
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
          fontFamily: headingFont,
          fontSize: MEASURE_FONT_SIZE,
          fontWeight: ICON_WEIGHT,
          color: "#000000",
        },
      },
      letters
    )
  );

  const svg = await satori(tree, {
    width: MEASURE_CANVAS,
    height: MEASURE_CANVAS,
    fonts: [{ name: headingFont, data: fontData, weight: ICON_WEIGHT, style: "normal" }],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
  const bbox = resvg.innerBBox();
  if (!bbox) {
    throw new Error(`monogram-icon: no visible ink measuring "${letters}"`);
  }
  return Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
}

export type MonogramIconInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  /** `tokens.primary` — every icon in this family fills on primary. */
  background: string;
  /** `tokens.cta_ink` — the contrast-safe ink already computed for text/marks on `primary`. */
  ink: string;
  /** true for favicon_16/favicon_32 only — the brief's single-letter exception. */
  forceSingleLetter?: boolean;
  insetRatio?: number;
};

/**
 * One square SVG (512x512 reference canvas, untrimmed — a fixed-canvas
 * asset keeps its canvas), the monogram inset inside a 78%-diameter circle.
 * Callers rasterize this SAME svg at whichever pixel widths they need via
 * `svgToPngAtWidth` — the geometry is resolution-independent, so a 16px and
 * a 512px icon share one render.
 */
export async function renderMonogramIconSvg(input: MonogramIconInput): Promise<string> {
  const letters = monogramLetters(input.practiceName, input.forceSingleLetter ?? false);
  const insetRatio = input.insetRatio ?? DEFAULT_INSET_RATIO;
  const fontData = await getCachedFontBuffer(input.headingFont, input.googleFontsUrl);

  const diagonal = await measureGlyphDiagonal(letters, input.headingFont, fontData);
  const targetDiagonal = REFERENCE_CANVAS * insetRatio;
  const scale = targetDiagonal / diagonal;
  const fontSize = MEASURE_FONT_SIZE * scale;

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: input.background,
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: input.headingFont,
          fontSize,
          fontWeight: ICON_WEIGHT,
          color: input.ink,
        },
      },
      letters
    )
  );

  return satori(tree, {
    width: REFERENCE_CANVAS,
    height: REFERENCE_CANVAS,
    fonts: [{ name: input.headingFont, data: fontData, weight: ICON_WEIGHT, style: "normal" }],
  });
}
