import type { Palette } from "@/lib/compose/types";

/*
 * ── COLOUR: A PAPER TONE AND TWO OR THREE TINTS ─────────────────────────
 *
 * No gradients. No drop shadows. No semi-transparent overlay of any kind.
 *
 * Those three are one rule, not three preferences: each of them is a way of
 * making two things overlap without deciding which one is in front. A card
 * that never overlaps never needs any of them, and a card that needs one of
 * them has a layout problem the colour is being asked to hide.
 *
 * ⚠ A FLAT FIELD BEHIND EVERY TEXT BLOCK IS MANDATORY, and each part of a
 * multi-part diagram gets its own tint. That is what makes a quadrant read as
 * four things rather than as four labels near each other.
 */

/** The five roles a brand direction carries in this repo (`PALETTE_ROLES`). */
export type DirectionPalette = {
  primary: string;
  secondary: string;
  light: string;
  dark: string;
  paper: string;
};

/** sRGB relative luminance, the WCAG definition. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * (n & 255)
  );
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The better of two inks against this ground. Never a guess: it is whichever
 * of the two has the higher contrast ratio, computed.
 */
export function inkFor(ground: string, dark: string, light: string): string {
  return contrast(ground, dark) >= contrast(ground, light) ? dark : light;
}

/**
 * A card palette from a brand direction.
 *
 * `dark` picks the dark-ground variant. The planner decides how many cards in
 * a month get one (`DARK_CARD_RATIO`); this function only knows how to build
 * the one it is asked for.
 *
 * ⚠ THE TINTS ARE THE BRAND'S, NEVER DERIVED BY LIGHTENING. Mixing her primary
 * with white to make a "soft" version produces a colour she never chose, and
 * it produces a different one for every brand, which is how a system stops
 * looking like a system.
 */
export function cardPalette(
  key: string,
  direction: DirectionPalette,
  dark = false
): Palette {
  const paper = dark ? direction.dark : direction.paper;
  const tints = dark
    ? [direction.primary, direction.secondary, direction.light]
    : [direction.light, direction.secondary, direction.primary];

  return {
    key: dark ? `${key}_dark` : key,
    paper,
    // Three at most. A fourth tint is a second brand, and a diagram with four
    // parts has four tints only because it has four parts.
    tints: tints.slice(0, 3),
    ink: inkFor(paper, direction.dark, direction.paper),
    inkOnTint: inkFor(tints[0], direction.dark, direction.paper),
    dark,
  };
}

/**
 * The tint for part `i` of a multi-part diagram — each part its own, cycling
 * when there are more parts than tints.
 *
 * Cycling rather than generating: four rings on a three-tint palette repeat the
 * first, which reads as a pattern. Four rings on four generated tints reads as
 * a colour that got away from someone.
 */
export function tintFor(palette: Palette, i: number): string {
  return palette.tints[i % palette.tints.length];
}
