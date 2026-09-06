import { createElement } from "react";
import satori from "satori";
import sharp, { type Sharp } from "sharp";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { svgToPng } from "@/lib/kit/render/rasterize";
import {
  CONTRAST_TARGET,
  contrastRatio,
  hexLuminance,
  measureRegionLuminance,
  solveScrimOpacity,
  type Region,
  type ScrimSolution,
} from "@/lib/kit/render/luminance";

/*
 * ── THE COMPOSITION LAYER (LOT 5.7) ─────────────────────────────────────
 *
 * Lives in `lib/kit/render/` and not in `lib/images/` for one hard reason:
 * every module that touches a native package belongs here, and
 * `app/__tests__/renderer-not-in-client-bundle.test.ts` enforces it. A native
 * binary reached from a client bundle is a build failure, not bloat.
 *
 * Four variations, two inputs. The variations are not four features; they are
 * four arrangements of the same photograph, the same colour ground, the same
 * headline and the same mark:
 *
 *   full      photo + scrim + headline + wordmark
 *   text      colour ground + headline + wordmark      (no photo)
 *   photo     photo + wordmark                          (no headline, no scrim)
 *   logo      colour ground + monogram                  (no photo, no headline)
 *
 * ⚠ THE HEADLINE COMES FROM SATORI. EVER, ONLY, ALWAYS.
 *
 * Never from the image model — the model is told "no text, no lettering, no
 * numbers" in every prompt, and a model that produced text would be producing
 * letterforms nobody chose in a typeface nobody licensed. Her headline is set
 * in her own heading font, by the same renderer that sets her wordmark.
 * `__tests__/composition.test.ts` asserts that this module never asks the
 * model for anything.
 *
 * ⚠ THE SCRIM IS SOLVED, NOT CHOSEN. See lib/images/luminance.ts.
 */

export type CompositionVariation = "full" | "text" | "photo" | "logo";

export type CompositionInput = {
  variation: CompositionVariation;
  /** The generated photograph. Required for `full` and `photo`, unused otherwise. */
  photo: Buffer | null;
  /** Where the headline sits, as fractions of the frame. Drives the scrim measurement. */
  textRegion: Region;
  width: number;
  height: number;
  headline: string;
  /** Her wordmark and monogram, already rendered as SVG by the asset pipeline. */
  wordmarkSvg: string;
  monogramSvg: string;
  tokens: {
    primary: string;
    paper: string;
    dark_neutral: string;
    heading_font: string;
  };
  googleFontsUrl: string;
};

export type Composition = {
  bytes: Buffer;
  contentType: string;
  /**
   * What the spec line reports. `contrastRatio` is null for the variations
   * that carry no headline — there is nothing to measure, and reporting a
   * number there would be inventing one.
   */
  spec: {
    scrimOpacity: number | null;
    contrastRatio: number | null;
    measuredLuminance: number | null;
    meetsTarget: boolean | null;
  };
};

const CONTENT_TYPE = "image/webp";

/** The headline and wordmark, as one transparent overlay. Text set by satori, never by the model. */
async function renderOverlay(input: CompositionInput, inkHex: string): Promise<Buffer> {
  const fontData = await getCachedFontBuffer(input.tokens.heading_font, input.googleFontsUrl);

  const showHeadline = input.variation === "full" || input.variation === "text";
  const mark = input.variation === "logo" ? input.monogramSvg : input.wordmarkSvg;

  const children = [
    showHeadline
      ? createElement(
          "div",
          {
            key: "headline",
            style: {
              display: "flex",
              fontFamily: input.tokens.heading_font,
              fontSize: Math.round(input.width * 0.062),
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: inkHex,
              maxWidth: `${Math.round(input.textRegion.width * 100)}%`,
            },
          },
          input.headline
        )
      : null,
    createElement("img", {
      key: "mark",
      src: `data:image/svg+xml;base64,${Buffer.from(mark, "utf8").toString("base64")}`,
      style: {
        width: input.variation === "logo" ? Math.round(input.width * 0.18) : Math.round(input.width * 0.22),
      },
    }),
  ].filter(Boolean);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: input.variation === "logo" ? "center" : "space-between",
        alignItems: input.variation === "logo" ? "center" : "flex-start",
        width: input.width,
        height: input.height,
        padding: Math.round(input.width * 0.055),
        // Transparent: the ground underneath is the photo or the colour field.
        backgroundColor: "transparent",
      },
    },
    children
  );

  const svg = await satori(tree, {
    width: input.width,
    height: input.height,
    fonts: [{ name: input.tokens.heading_font, data: fontData, weight: 500, style: "normal" }],
  });
  return svgToPng(svg);
}

/** A flat field of one of her colours, for the two variations that carry no photograph. */
function colourGround(hex: string, width: number, height: number): Sharp {
  return sharp({
    create: { width, height, channels: 3, background: hex },
  });
}

/**
 * Composes one variation.
 *
 * `full` is the only one that measures and solves: it is the only one with a
 * headline over a photograph. `text` sets the headline over a known colour, so
 * its contrast is computed directly rather than solved. `photo` and `logo`
 * carry no headline and report no ratio.
 */
export async function composeVariation(input: CompositionInput): Promise<Composition> {
  const { variation, width, height, tokens } = input;

  if ((variation === "full" || variation === "photo") && !input.photo) {
    throw new Error(`The ${variation} variation needs a photograph.`);
  }

  let scrim: ScrimSolution | null = null;
  let groundRatio: number | null = null;
  let base: Sharp;
  let inkHex: string;

  if (variation === "full") {
    // MEASURED, then solved. Never a fixed value.
    const measured = await measureRegionLuminance(input.photo as Buffer, input.textRegion);
    scrim = solveScrimOpacity(measured, tokens.dark_neutral, tokens.paper, CONTRAST_TARGET);
    inkHex = tokens.paper;

    const scrimSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="${tokens.dark_neutral}" stop-opacity="${scrim.opacity}"/>` +
        `<stop offset="${Math.round(input.textRegion.width * 100)}%" stop-color="${tokens.dark_neutral}" stop-opacity="${scrim.opacity}"/>` +
        `<stop offset="100%" stop-color="${tokens.dark_neutral}" stop-opacity="0"/>` +
        `</linearGradient></defs>` +
        `<rect width="${width}" height="${height}" fill="url(#s)"/></svg>`,
      "utf8"
    );

    base = sharp(input.photo as Buffer)
      .resize(width, height, { fit: "cover" })
      .composite([{ input: scrimSvg, top: 0, left: 0 }]);
  } else if (variation === "photo") {
    inkHex = tokens.paper;
    base = sharp(input.photo as Buffer).resize(width, height, { fit: "cover" });
  } else {
    /*
     * `text` and `logo` sit on a colour ground from her palette. The ink is
     * CHOSEN rather than assumed: whichever of paper and dark_neutral reads
     * better on her primary. A palette where paper-on-primary happens to fail
     * would otherwise ship unreadable type, and the product already picks ink
     * this way everywhere else (`cta_ink`, `site_spec_text_variant`).
     */
    const groundLuminance = hexLuminance(tokens.primary);
    const onPaper = contrastRatio(hexLuminance(tokens.paper), groundLuminance);
    const onDark = contrastRatio(hexLuminance(tokens.dark_neutral), groundLuminance);
    inkHex = onPaper >= onDark ? tokens.paper : tokens.dark_neutral;
    // Only `text` carries a headline over this ground. `logo` carries a
    // monogram, and a contrast ratio for a mark nobody reads as type would be
    // a number reported about nothing.
    groundRatio = variation === "text" ? Math.max(onPaper, onDark) : null;
    base = colourGround(tokens.primary, width, height);
  }

  const overlay = await renderOverlay(input, inkHex);
  const bytes = await base
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toBuffer();

  // `full` reports a SOLVED ratio, `text` a computed one, and the two
  // headline-free variations report nothing rather than a number they cannot
  // have measured.
  const ratio = scrim ? scrim.ratio : groundRatio;

  return {
    bytes,
    contentType: CONTENT_TYPE,
    spec: {
      scrimOpacity: scrim ? scrim.opacity : null,
      contrastRatio: ratio === null ? null : Math.round(ratio * 100) / 100,
      measuredLuminance: scrim ? Math.round(scrim.measuredLuminance * 1000) / 1000 : null,
      meetsTarget: ratio === null ? null : ratio >= CONTRAST_TARGET,
    },
  };
}

/** The spec line, in the product's own voice — a measured number, never a score. */
export function compositionSpecLine(spec: Composition["spec"]): string {
  if (spec.contrastRatio === null) return "No headline on this variation.";
  if (spec.scrimOpacity === null) return `Headline contrast ${spec.contrastRatio.toFixed(2)}:1.`;
  return `Headline contrast ${spec.contrastRatio.toFixed(2)}:1 over a ${Math.round(
    spec.scrimOpacity * 100
  )}% scrim.`;
}
