import sharp from "sharp";

/*
 * ── THE SCRIM IS NOT DECORATION ─────────────────────────────────────────
 *
 * A headline over a photograph is legible or it is not, and which one it is
 * depends on the photograph. A fixed opacity is a guess that happens to work
 * on the images you tried it on; on a bright frame the text disappears and on
 * a dark one the scrim buries a photograph she paid for.
 *
 * So the opacity is SOLVED, from the measured mean luminance of the region
 * the text actually occupies, against a 4.5:1 target — and the ratio that was
 * actually achieved is reported in the asset's spec line, the way every other
 * measured number in this product is.
 *
 * ── WHY THE MEASUREMENT LINEARIZES ──────────────────────────────────────
 *
 * `sharp().stats()` would be one call, but it averages GAMMA-ENCODED channel
 * values, and the mean of encoded values is not the encoded mean luminance —
 * it overstates dark regions badly. WCAG relative luminance is defined on
 * LINEARIZED channels, so the pixels are linearized first and averaged after.
 * The region is downsampled before that, because averaging a million pixels
 * and averaging four thousand of them give the same answer for far less work.
 */

/** A fraction-of-the-frame rectangle, so a region survives any output size. */
export type Region = { x: number; y: number; width: number; height: number };

/** The whole frame — for a photo used as a ground with text anywhere over it. */
export const WHOLE_FRAME: Region = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Where a headline actually sits, per slot shape. These mirror the briefs:
 * the hero reserves its left third, the post backgrounds reserve their upper
 * two thirds. A scrim solved against the wrong rectangle is a scrim solved
 * against a region the text was never in.
 */
export const HERO_TEXT_REGION: Region = { x: 0, y: 0, width: 1 / 3, height: 1 };
export const POST_TEXT_REGION: Region = { x: 0, y: 0, width: 1, height: 2 / 3 };

/** sRGB channel (0–255) → linear. The WCAG transfer function, not an approximation. */
function linearize(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance from linear channels. */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `#B4674A` → WCAG relative luminance. */
export function hexLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const value = parseInt(match[1], 16);
  return relativeLuminance(
    linearize((value >> 16) & 0xff),
    linearize((value >> 8) & 0xff),
    linearize(value & 0xff)
  );
}

/** WCAG contrast ratio between two relative luminances. Order-independent. */
export function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The mean relative luminance of one region of a photograph, measured from
 * its pixels.
 *
 * Works on whatever `sharp` can decode, which includes the webp this pipeline
 * stores. The region is given in fractions of the frame so the caller never
 * has to know the output size.
 */
export async function measureRegionLuminance(photo: Buffer, region: Region): Promise<number> {
  const image = sharp(photo);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Could not read the photograph's dimensions.");

  const left = Math.max(0, Math.min(width - 1, Math.round(region.x * width)));
  const top = Math.max(0, Math.min(height - 1, Math.round(region.y * height)));
  const cropWidth = Math.max(1, Math.min(width - left, Math.round(region.width * width)));
  const cropHeight = Math.max(1, Math.min(height - top, Math.round(region.height * height)));

  // Downsample before averaging: same answer, a fraction of the pixels.
  const { data, info } = await sharp(photo)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 64, height: 64, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let total = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    total += relativeLuminance(linearize(data[i]), linearize(data[i + 1]), linearize(data[i + 2]));
  }
  return total / pixels;
}

/** The alpha-composite of one channel: what the pixel will actually be. */
function blendChannel(base8: number, scrim8: number, alpha: number): number {
  return base8 * (1 - alpha) + scrim8 * alpha;
}

export type ScrimSolution = {
  /** 0–1, the opacity to composite the scrim at. */
  opacity: number;
  /** The contrast ratio actually achieved at that opacity, for the spec line. */
  ratio: number;
  /** The measured mean luminance of the region, before any scrim. */
  measuredLuminance: number;
  /** False when even the maximum opacity could not reach the target. */
  meetsTarget: boolean;
};

/** WCAG AA for large text is 3:1; a headline is large, but 4.5:1 is the product's floor. */
export const CONTRAST_TARGET = 4.5;

/** Past this the photograph stops being a photograph. */
export const MAX_SCRIM_OPACITY = 0.92;

/**
 * The lowest scrim opacity at which the headline clears the target — or the
 * best that could be reached, honestly reported.
 *
 * Solved on the MEAN luminance of the text region, as specified. That is a
 * mean: a small very bright highlight inside the region can still fall below
 * the reported ratio locally. The number in the spec line is the mean-based
 * one, and it says so.
 *
 * Search is a 1%-step climb rather than a binary search because blending is
 * not guaranteed monotonic for every palette — a `dark_neutral` lighter than
 * the photograph makes raising the scrim *reduce* contrast, and a climb finds
 * the real first crossing where a bisection could miss it.
 */
export function solveScrimOpacity(
  measuredLuminance: number,
  scrimHex: string,
  textHex: string,
  target: number = CONTRAST_TARGET
): ScrimSolution {
  const textLuminance = hexLuminance(textHex);

  // The region's mean, expressed back as an 8-bit grey of the same luminance,
  // so it can be alpha-blended with the scrim the way the pixels will be.
  const meanGrey = luminanceToChannel8(measuredLuminance);
  const scrim = hexChannels(scrimHex);

  let best: ScrimSolution = {
    opacity: 0,
    ratio: contrastRatio(textLuminance, measuredLuminance),
    measuredLuminance,
    meetsTarget: false,
  };
  if (best.ratio >= target) return { ...best, meetsTarget: true };

  for (let step = 1; step <= Math.round(MAX_SCRIM_OPACITY * 100); step += 1) {
    const opacity = step / 100;
    const blended = relativeLuminance(
      linearize(blendChannel(meanGrey, scrim.r, opacity)),
      linearize(blendChannel(meanGrey, scrim.g, opacity)),
      linearize(blendChannel(meanGrey, scrim.b, opacity))
    );
    const ratio = contrastRatio(textLuminance, blended);
    if (ratio > best.ratio) best = { opacity, ratio, measuredLuminance, meetsTarget: ratio >= target };
    if (ratio >= target) return { opacity, ratio, measuredLuminance, meetsTarget: true };
  }
  return best;
}

function hexChannels(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/** The 8-bit grey whose relative luminance is `target`. Inverse of the transfer function. */
function luminanceToChannel8(target: number): number {
  const clamped = Math.max(0, Math.min(1, target));
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}
