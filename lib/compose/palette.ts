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
 * De combien une teinte de marque est ramenée vers le papier.
 *
 * ── ⚠ CE MODULE REFUSAIT DE LE FAIRE, ET IL AVAIT TORT ─────────────────
 *
 * Le commentaire disait : « LES TEINTES SONT CELLES DE LA MARQUE, JAMAIS
 * OBTENUES EN ÉCLAIRCISSANT. Mélanger son primaire avec du blanc produit une
 * couleur qu'elle n'a jamais choisie, et une différente pour chaque marque,
 * ce qui est la façon dont un système cesse de ressembler à un système. »
 *
 * L'objection est réelle et la conclusion était fausse, pour deux raisons que
 * le rendu du 2026-10 a rendues visibles :
 *
 * 1. `tints` valait `[light, secondary, primary]`, et sur un vrai kit cela
 *    donne `[#F4EEE3, #C08A3E, #B4674A]` — une teinte presque blanche et DEUX
 *    APLATS DE MARQUE À PLEINE SATURATION. Un contrôle indépendant du mois
 *    rendu l'a noté sur les dix-neuf cartes-diagrammes : « brand ochre et
 *    brand terracotta près de la saturation maximale, la plupart des cartes se
 *    lisent comme des bandes lourdes ».
 * 2. `inkOnTint` est calculé UNE fois, sur `tints[0]`, puis posé sur les trois.
 *    Avec une première teinte presque blanche et une troisième saturée, l'encre
 *    choisie pour la première perd son contraste sur la troisième.
 *
 * Adoucir vers le PAPIER, et non vers le blanc, répond à l'objection : le
 * résultat reste sur l'axe de la marque, la proportion est la même pour tous
 * les kits — donc le système reste un système — et les trois teintes
 * redeviennent claires, ce qui résout aussi (2) sans toucher à l'encre.
 *
 * La valeur est fixée par la spécification validée, qui demande « 2-3 teintes
 * du kit adoucies en aplats (pas les couleurs de marque saturées) ».
 */
export const SOFTEN_TOWARD_PAPER = 0.62;

/**
 * Une seconde adoucissure, pour la quatrième partie d'un diagramme.
 *
 * ⚠ QUATRE PARTIES EXISTENT — `quadrant_model` en a exactement quatre — ET IL
 * N'Y AVAIT QUE TROIS TEINTES. `tintFor` repartait donc sur la première, et le
 * contrôle indépendant a relevé exactement ça sur trois cartes : « la
 * quatrième case reprend la teinte de la première, deux des quatre parties ne
 * se distinguent pas ».
 *
 * Une quatrième COULEUR serait une seconde marque. Une quatrième LUMINOSITÉ
 * d'une teinte déjà présente ne l'est pas.
 *
 * ⚠ ET ELLE ÉTAIT PLUS PÂLE, CE QUI LA RAMENAIT SUR LA PREMIÈRE. Adoucir la
 * troisième à 0.82 donnait un ton presque papier, voisin de `light` : un
 * contrôle indépendant l'a relevé sur une carte à quatre parties, « la
 * quatrième teinte est une reprise délavée de la première, deux champs se
 * lisent comme une seule couleur ». Elle est donc une seconde LUMINOSITÉ, plus
 * SOUTENUE, de la deuxième — encore un aplat doux, mais du côté opposé des
 * trois autres.
 */
const SOFTEN_FOURTH = 0.42;

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
 * Déjà assez proche du fond pour qu'adoucir la ferait disparaître.
 *
 * ⚠ SANS CE GARDE-FOU, LA PREMIÈRE TEINTE S'ÉVAPORE. `light` vaut #F4EEE3 sur
 * un papier #FAF6EE : elle est déjà un aplat doux, et la ramener encore de
 * 62 % vers le papier la rendrait indistinguable de lui. Un champ invisible
 * n'est pas un champ.
 */
const ALREADY_SOFT = 1.6;

function soften(tint: string, paper: string, amount: number): string {
  return contrast(tint, paper) <= ALREADY_SOFT ? tint : mix(tint, paper, amount);
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
 * `SOFTEN_TOWARD_PAPER` pour ce que cette distinction règle.
 */
export function cardPalette(
  key: string,
  direction: DirectionPalette,
  dark = false
): Palette {
  const paper = dark ? direction.dark : direction.paper;
  const brand = dark
    ? [direction.primary, direction.secondary, direction.light]
    : [direction.light, direction.secondary, direction.primary];

  /*
   * ⚠ LA QUATRIÈME EST LA TROISIÈME, PLUS PÂLE — pas une couleur de plus. Elle
   * n'est posée que sur un diagramme qui a vraiment quatre parties ; ailleurs
   * `tintFor` ne l'atteint jamais.
   */
  const tints = [
    ...brand.map((t) => soften(t, paper, SOFTEN_TOWARD_PAPER)),
    soften(brand[1], paper, SOFTEN_FOURTH),
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
