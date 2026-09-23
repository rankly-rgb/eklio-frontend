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
 * De combien chaque emplacement est adouci, et vers quoi.
 *
 * ── ⚠ UN TAUX UNIQUE ÉCRASE LA MARQUE SUR ELLE-MÊME ────────────────────
 *
 * L'or `#C08A3E` et la terracotta `#B4674A` sont à 39 de distance RGB.
 * Ramenés tous deux de 62 % vers le papier, l'écart tombait à 15 : les deux
 * aplats devenaient indistinguables. Adoucir de quantités DIFFÉRENTES
 * conserve l'écart.
 *
 * ── ⚠ ET LA QUATRIÈME NE PEUT PAS ÊTRE UNE SECONDE LUMINOSITÉ DE LA
 *      DEUXIÈME, CE QUI A ÉTÉ LA CORRECTION SUIVANTE ────────────────────
 *
 * Elle l'a été, et une notation indépendante l'a relevée : `#DDC096` et
 * `#D1AA73` sont **à 11,7 en ΔE76**, même teinte. Le contrôle les déclarait
 * distinctes parce qu'il mesurait en RGB, où elles sont à 43 — le RGB compte
 * les bits, pas ce qu'on voit.
 *
 * Il fallait donc une quatrième TEINTE, pas une quatrième luminosité, et sans
 * inventer de couleur. `dark` est l'un des cinq rôles du kit : adouci vers le
 * papier il donne un neutre chaud, franchement séparé de l'or et de la
 * terracotta, et il reste à elle.
 *
 * ── ⚠ LE PREMIER APLAT SE FONÇAIT, IL NE S'ADOUCISSAIT PAS ─────────────
 *
 * `light` vaut `#F4EEE3` sur un papier `#FAF6EE` : **ΔE 3,2**, soit un champ
 * qu'on ne voit pas. La même notation l'a relevé, en citant la référence qui
 * sépare de 6,5. Il est donc mêlé vers l'ENCRE, pas vers le papier, ce qui
 * porte l'écart à 9,8.
 *
 * Mesuré sur un vrai kit : l'écart minimal entre deux aplats d'une carte
 * vaut 15,1 en fond clair et 19,3 en fond sombre.
 */
const DEEPEN_FIRST = 0.1;
const SOFTEN_LIGHT = [0.42, 0.52, 0.62] as const;

/**
 * Sur fond sombre, la quatrième est une seconde luminosité du PRIMAIRE.
 *
 * ⚠ ET NON LE NEUTRE, QUI Y COLLAPSE. Le fond sombre tire ses aplats de
 * `[primaire, secondaire, clair]` : le neutre issu du papier et le `clair`
 * adouci y sont tous deux des gris (ΔE 6,4 l'un de l'autre). La terracotta
 * assombrie, elle, tient à 19,3 de tout le reste.
 */
const SOFTEN_DARK = [0.25, 0.25, 0.25, 0.65] as const;

/** Mélange linéaire de deux couleurs, `amount` étant la part de `towards`. */
export function mix(colour: string, towards: string, amount: number): string {
  const read = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    return m ? parseInt(m[1], 16) : 0;
  };
  const a = read(colour);
  const b = read(towards);
  const channel = (shift: number) => {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    return Math.round(ca + (cb - ca) * amount);
  };
  const out = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${out.toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * A card palette from a brand direction.
 *
 * `dark` picks the dark-ground variant. The planner decides how many cards in
 * a month get one (`DARK_CARD_RATIO`); this function only knows how to build
 * the one it is asked for.
 *
 * ⚠ LES TEINTES RESTENT CELLES DE LA MARQUE, ADOUCIES VERS LE PAPIER — jamais
 * vers le blanc, jamais vers une couleur choisie ici. Voir
 * `DEEPEN_FIRST` et `SOFTEN_LIGHT` pour ce que cette distinction règle.
 */
export function cardPalette(
  key: string,
  direction: DirectionPalette,
  dark = false
): Palette {
  const paper = dark ? direction.dark : direction.paper;
  const ink = dark ? direction.paper : direction.dark;

  /*
   * ⚠ LE PREMIER APLAT EST FONCÉ VERS L'ENCRE, LES AUTRES ADOUCIS VERS LE
   * FOND. C'est la seule façon d'obtenir quatre champs qu'on distingue à
   * partir de cinq couleurs dont deux sont presque le papier.
   */
  const tints = dark
    ? [
        mix(direction.primary, paper, SOFTEN_DARK[0]),
        mix(direction.secondary, paper, SOFTEN_DARK[1]),
        mix(direction.light, paper, SOFTEN_DARK[2]),
        mix(direction.primary, paper, SOFTEN_DARK[3]),
      ]
    : [
        mix(direction.light, ink, DEEPEN_FIRST),
        mix(direction.secondary, paper, SOFTEN_LIGHT[0]),
        mix(direction.primary, paper, SOFTEN_LIGHT[1]),
        mix(direction.dark, paper, SOFTEN_LIGHT[2]),
      ];

  return {
    key: dark ? `${key}_dark` : key,
    paper,
    tints,
    ink: inkFor(paper, direction.dark, direction.paper),
    /*
     * ⚠ UNE SEULE ENCRE POUR LES QUATRE, ET C'EST MAINTENANT VRAI. Elle était
     * calculée sur `tints[0]` et posée sur des teintes qui pouvaient être trois
     * fois plus sombres. Adoucies vers le papier, les quatre sont désormais du
     * même côté de l'axe clair/sombre : l'encre qui va sur la plus claire va
     * sur toutes. Le choix reste calculé, jamais supposé.
     */
    inkOnTint: inkFor(
      tints.reduce((darkest, t) => (luminance(t) < luminance(darkest) ? t : darkest), tints[0]),
      direction.dark,
      direction.paper
    ),
    dark,
  };
}

export function tintFor(palette: Palette, i: number): string {
  return palette.tints[i % palette.tints.length];
}
