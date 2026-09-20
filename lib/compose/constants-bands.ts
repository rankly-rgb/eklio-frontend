import { CANVAS, CLEARANCE, EYEBROW_HEIGHT, FOOTER_HEIGHT, MARGIN } from "@/lib/compose/constants";

/**
 * The four named vertical bands.
 *
 * Separate from `constants.ts` only to keep that file free of derivation: the
 * numbers there are decisions, the boxes here are arithmetic over them, and
 * mixing the two makes it impossible to tell which is which when one changes.
 */
export type Band = "eyebrow" | "headline" | "content" | "footer";

export type BandBox = { x: number; y: number; w: number; h: number };

const INNER_WIDTH = CANVAS.width - MARGIN * 2;

export const EYEBROW: BandBox = {
  x: MARGIN,
  y: MARGIN,
  w: INNER_WIDTH,
  h: EYEBROW_HEIGHT,
};

export const FOOTER: BandBox = {
  x: MARGIN,
  y: CANVAS.height - MARGIN - FOOTER_HEIGHT,
  w: INNER_WIDTH,
  h: FOOTER_HEIGHT,
};

/**
 * Everything between the eyebrow and the footer's clearance. `headline` and
 * `content` share it, and how they share it is the layout's decision, not a
 * constant — which is why this is one box and not two.
 */
export const BODY: BandBox = {
  x: MARGIN,
  y: EYEBROW.y + EYEBROW.h,
  w: INNER_WIDTH,
  h: FOOTER.y - CLEARANCE.aboveFooter - (EYEBROW.y + EYEBROW.h),
};

export const BANDS = { eyebrow: EYEBROW, body: BODY, footer: FOOTER } as const;
