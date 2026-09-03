import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * business_card_front / business_card_back (Lot 4.4, "Print").
 *
 * 3.5×2in at 300dpi, 0.125in bleed, crop marks (brief's exact spec). Front
 * mirrors the existing on-screen preview (`BusinessCard` in
 * components/preview/brand-preview.tsx): practice name near the top, a
 * primary-colour hairline rule, `practitioner_line` beneath it — same
 * content, same relative layout, scaled to print size rather than
 * reinvented. The back has no spec in the brief; it carries the standalone
 * monogram centred on the primary colour (see DECISIONS.md) — a plain,
 * common back-of-card treatment, and consistent with how the monogram is
 * already used as a mark-alone surface elsewhere in the catalogue.
 *
 * RGB only, no CMYK conversion attempted (brief's own caveat) — noted again
 * in the zip README, not silently dropped.
 */

const DPI = 300;
const TRIM_WIDTH_IN = 3.5;
const TRIM_HEIGHT_IN = 2;
const BLEED_IN = 0.125;

export const CARD_WIDTH = Math.round((TRIM_WIDTH_IN + BLEED_IN * 2) * DPI); // 1125
export const CARD_HEIGHT = Math.round((TRIM_HEIGHT_IN + BLEED_IN * 2) * DPI); // 675

const TRIM_INSET = Math.round(BLEED_IN * DPI); // 38px: bleed edge -> trim line
const SAFE_MARGIN = TRIM_INSET + Math.round(0.2 * DPI); // trim line -> where content actually sits

const CROP_MARK_LENGTH = 24;
const CROP_MARK_THICKNESS = 2;
const CROP_MARK_COLOR = "#000000";

/**
 * Eight short ticks, two per corner, spanning from the bleed edge to the
 * trim line (this canvas has no margin beyond the declared bleed to extend
 * a traditional printer's mark into — see the file header).
 */
function cropMarks() {
  const marks: ReturnType<typeof createElement>[] = [];
  const positions: { x: "left" | "right"; y: "top" | "bottom" }[] = [
    { x: "left", y: "top" },
    { x: "right", y: "top" },
    { x: "left", y: "bottom" },
    { x: "right", y: "bottom" },
  ];

  for (const pos of positions) {
    const left = pos.x === "left" ? 0 : CARD_WIDTH - CROP_MARK_LENGTH;
    const top = pos.y === "top" ? 0 : CARD_HEIGHT - CROP_MARK_THICKNESS;
    marks.push(
      createElement("div", {
        key: `${pos.x}-${pos.y}-h`,
        style: {
          display: "flex",
          position: "absolute",
          left,
          top: pos.y === "top" ? TRIM_INSET : CARD_HEIGHT - TRIM_INSET - CROP_MARK_THICKNESS,
          width: CROP_MARK_LENGTH,
          height: CROP_MARK_THICKNESS,
          backgroundColor: CROP_MARK_COLOR,
        },
      })
    );
    marks.push(
      createElement("div", {
        key: `${pos.x}-${pos.y}-v`,
        style: {
          display: "flex",
          position: "absolute",
          left: pos.x === "left" ? TRIM_INSET : CARD_WIDTH - TRIM_INSET - CROP_MARK_THICKNESS,
          top,
          width: CROP_MARK_THICKNESS,
          height: CROP_MARK_LENGTH,
          backgroundColor: CROP_MARK_COLOR,
        },
      })
    );
  }
  return marks;
}

export type BusinessCardFrontInput = {
  practiceName: string;
  practitionerLine: string | null;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  paperColor: string;
  darkColor: string;
  primaryColor: string;
};

export async function renderBusinessCardFront(input: BusinessCardFrontInput): Promise<Buffer> {
  const [headingFontData, bodyFontData] = await Promise.all([
    getCachedFontBuffer(input.headingFont, input.googleFontsUrl),
    getCachedFontBuffer(input.bodyFont, input.googleFontsUrl),
  ]);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: input.paperColor,
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "absolute",
          left: SAFE_MARGIN,
          top: SAFE_MARGIN,
          right: SAFE_MARGIN,
          bottom: SAFE_MARGIN,
        },
      },
      createElement(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: input.headingFont,
            fontWeight: 600,
            fontSize: 42,
            letterSpacing: "-0.01em",
            color: input.darkColor,
          },
        },
        input.practiceName
      ),
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        createElement("div", {
          style: { display: "flex", width: 90, height: 3, backgroundColor: input.primaryColor },
        }),
        input.practitionerLine
          ? createElement(
              "div",
              {
                style: {
                  display: "flex",
                  marginTop: 14,
                  fontFamily: input.bodyFont,
                  fontSize: 24,
                  color: input.darkColor,
                  opacity: 0.75,
                },
              },
              input.practitionerLine
            )
          : null
      )
    ),
    ...cropMarks()
  );

  const svg = await satori(tree, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: input.headingFont, data: headingFontData, weight: 600, style: "normal" },
      { name: input.bodyFont, data: bodyFontData, weight: 400, style: "normal" },
    ],
  });

  return svgToPng(svg);
}

export type BusinessCardBackInput = {
  practiceName: string;
  headingFont: string;
  googleFontsUrl: string;
  primaryColor: string;
  ctaInk: string;
};

export async function renderBusinessCardBack(input: BusinessCardBackInput): Promise<Buffer> {
  const words = input.practiceName.trim().split(/\s+/).filter(Boolean);
  const letters = words.length <= 1 ? (words[0]?.[0] ?? "").toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
  const fontData = await getCachedFontBuffer(input.headingFont, input.googleFontsUrl);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: input.primaryColor,
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
          fontWeight: 600,
          fontSize: 120,
          color: input.ctaInk,
        },
      },
      letters
    ),
    ...cropMarks()
  );

  const svg = await satori(tree, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [{ name: input.headingFont, data: fontData, weight: 600, style: "normal" }],
  });

  return svgToPng(svg);
}
