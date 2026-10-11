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

const rgbOf = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * La distance perceptuelle entre deux couleurs — ΔE76, dans l'espace Lab.
 *
 * ── ⚠ LA DISTANCE RGB DISAIT « 43 » LÀ OÙ L'ŒIL VOIT « PRESQUE PAREIL » ──
 *
 * Le contrôle mesurait une distance euclidienne en RGB, avec un seuil de 24.
 * `#DDC096` et `#D1AA73` en sont à 43 : il les déclarait distinctes. Un
 * évaluateur indépendant les a pourtant relevées comme « quasi identiques,
 * même teinte », et il avait raison — en ΔE76 elles ne sont qu'à **11,7**.
 *
 * Le RGB n'est pas perceptuel : il compte les bits, pas ce qu'on voit. Deux
 * jaunes séparés de 43 unités RGB se ressemblent beaucoup plus que deux bleus
 * séparés d'autant. Lab est fait pour cette question-là, et c'est l'unité dans
 * laquelle la remarque a été formulée.
 */
function toLab(hex: string): [number, number, number] | null {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  // sRGB → XYZ (D65), puis XYZ → Lab.
  const x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047;
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function colourDistance(a: string, b: string): number {
  const x = toLab(a);
  const y = toLab(b);
  if (!x || !y) return Number.POSITIVE_INFINITY;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
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

/** Deux aplats d'une même carte en dessous de cet écart (ΔE76) se lisent comme un seul. */
export const TINT_MIN_DISTANCE = 15;

/**
 * Le plancher de lisibilité de l'encre posée sur un aplat : 3:1, le seuil WCAG
 * du texte large et des éléments graphiques.
 *
 * ⚠ IL N'EXISTAIT PAS. Mesuré le 2026-10-11 sur la palette de référence
 * (clay_sand) : en fond sombre, l'encre papier tombait à 1,34:1 sur l'aplat tiré
 * de `light`. Le 4,5:1 du texte courant n'est pas tenable sans changer la
 * marque : la référence elle-même mesure 3,59 en fond clair (FOLLOWUP F72).
 */
export const TINT_INK_MIN_CONTRAST = 3;

/** Un aplat plus proche que ça du fond ne se voit pas (la référence citée plus haut sépare de 6,5). */
const TINT_GROUND_MIN_DISTANCE = 6.5;

/** Les écarts visés, du plus confortable au seuil : le premier tenable est retenu. */
const TINT_TARGETS = [TINT_MIN_DISTANCE + 1, TINT_MIN_DISTANCE] as const;

const RATES = Array.from({ length: 37 }, (_, i) => Math.round((0.05 + i * 0.025) * 1000) / 1000);

/** `away` : le second sens permis, sur fond sombre seulement (voir `cardPalette`). */
type Slot = { source: string; towards: string; away?: string; rate: number };

/**
 * Les quatre aplats d'une carte.
 *
 * ── ⚠ DES TAUX FIXES NE TENAIENT QUE SUR LA PALETTE DE RÉFÉRENCE (F72) ────
 *
 * `SOFTEN_LIGHT` et `SOFTEN_DARK` avaient été réglés sur clay_sand. Sur les
 * six familles du catalogue, trois échouaient le contrôle de teintes en fond
 * clair et quatre en fond sombre : quand le primaire et le secondaire sont déjà
 * presque l'encre (plum, slate, ink blue, olive), les adoucir tous du même côté
 * ne crée aucun écart, et les diagrammes tombaient au portillon.
 *
 * Chaque emplacement garde donc SA couleur de marque et son taux de départ ;
 * s'ils ne tiennent pas, le taux bouge (et, sur fond sombre seulement, la
 * couleur peut s'éclaircir vers le papier) — toujours une version adoucie de
 * la marque, jamais une couleur inventée. Les taux restent différents d'un emplacement à l'autre :
 * c'est l'écart entre aplats qui est cherché.
 *
 * Contraintes, toutes mesurées sur l'hexadécimal écrit : chaque paire d'aplats
 * à `TINT_MIN_DISTANCE` au moins, l'encre à `TINT_INK_MIN_CONTRAST` sur chacun,
 * chacun visible sur le fond, aucun égal à une couleur brute. Le résultat est
 * déterministe et mis en cache par palette.
 */
function solveTints(slots: Slot[], ground: string, inks: [string, string], raw: string[]): string[] | null {
  const forbidden = new Set(raw.map((c) => c.toUpperCase()));
  const candidates = slots.map((slot) => {
    const ordered = [
      ...RATES.map((r) => ({ r, towards: slot.towards, cost: Math.abs(r - slot.rate) })),
      ...(slot.away ? RATES.map((r) => ({ r, towards: slot.away!, cost: 1 + r })) : []),
    ].sort((a, b) => a.cost - b.cost);
    const seen = new Set<string>();
    const out: Array<{ hex: string; lab: [number, number, number] }> = [];
    for (const c of ordered) {
      const hex = mix(slot.source, c.towards, c.r);
      if (seen.has(hex) || forbidden.has(hex)) continue;
      seen.add(hex);
      if (contrast(inkFor(hex, inks[0], inks[1]), hex) < TINT_INK_MIN_CONTRAST) continue;
      if (colourDistance(hex, ground) < TINT_GROUND_MIN_DISTANCE) continue;
      out.push({ hex, lab: toLab(hex)! });
    }
    return out;
  });
  const far = (a: [number, number, number], b: [number, number, number], t: number) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= t;
  for (const target of TINT_TARGETS) {
    const picked: Array<{ hex: string; lab: [number, number, number] }> = [];
    const place = (i: number): boolean => {
      if (i === candidates.length) return true;
      for (const c of candidates[i]) {
        if (!picked.every((p) => far(p.lab, c.lab, target))) continue;
        picked.push(c);
        if (place(i + 1)) return true;
        picked.pop();
      }
      return false;
    };
    if (place(0)) return picked.map((p) => p.hex);
  }
  return null;
}

const solved = new Map<string, string[]>();

/**
 * A card palette from a brand direction.
 *
 * `dark` picks the dark-ground variant. The planner decides how many cards in
 * a month get one (`DARK_CARD_RATIO`); this function only knows how to build
 * the one it is asked for.
 *
 * ⚠ LES TEINTES RESTENT CELLES DE LA MARQUE, ADOUCIES — jamais vers le blanc,
 * jamais vers une couleur choisie ici. Voir `solveTints`.
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
   * FOND. C'est le point de départ ; `solveTints` ne bouge que les taux.
   *
   * ⚠ SUR FOND SOMBRE SEULEMENT, UN APLAT PEUT AUSSI S'ÉCLAIRCIR VERS LE PAPIER.
   * Adoucir une couleur déjà presque aussi sombre que le fond (le primaire de
   * plum, de slate, d'ink blue) ne la sépare de rien : sur ces familles, aucun
   * taux vers le fond ne tient. Sur fond clair, l'adoucissement seul suffit
   * aux six familles, et on ne fonce donc jamais la marque vers le noir.
   */
  const slots: Slot[] = dark
    ? [
        { source: direction.primary, towards: paper, away: ink, rate: SOFTEN_DARK[0] },
        { source: direction.secondary, towards: paper, away: ink, rate: SOFTEN_DARK[1] },
        { source: direction.light, towards: paper, away: ink, rate: SOFTEN_DARK[2] },
        { source: direction.primary, towards: paper, away: ink, rate: SOFTEN_DARK[3] },
      ]
    : [
        { source: direction.light, towards: ink, rate: DEEPEN_FIRST },
        { source: direction.secondary, towards: paper, rate: SOFTEN_LIGHT[0] },
        { source: direction.primary, towards: paper, rate: SOFTEN_LIGHT[1] },
        { source: direction.dark, towards: paper, rate: SOFTEN_LIGHT[2] },
      ];

  const cacheKey = JSON.stringify([direction, dark]);
  let tints = solved.get(cacheKey);
  if (!tints) {
    /*
     * ⚠ SANS SOLUTION, LES TAUX DE DÉPART — ET LE CONTRÔLE REFUSERA. Rien
     * n'est maquillé ici : `palette-catalogue.test.ts` échoue si une famille du
     * catalogue tombe dans ce cas.
     */
    tints =
      solveTints(slots, paper, [ink, paper], [direction.primary, direction.secondary]) ??
      slots.map((s) => mix(s.source, s.towards, s.rate));
    solved.set(cacheKey, tints);
  }

  return {
    key: dark ? `${key}_dark` : key,
    paper,
    tints,
    ink: inkFor(paper, direction.dark, direction.paper),
    /*
     * ⚠ UNE ENCRE PAR APLAT, CALCULÉE SUR CET APLAT. Une encre unique, choisie
     * sur l'aplat le plus sombre, tombait à 1,34:1 sur l'aplat clair d'une carte
     * sombre ; et sur les familles sombres (slate, plum), aucun jeu de quatre
     * aplats distincts ne porte une seule encre. `solveTints` a garanti
     * `TINT_INK_MIN_CONTRAST` pour la meilleure des deux encres de la marque.
     */
    inkOnTints: tints.map((t) => inkFor(t, direction.dark, direction.paper)),
    dark,
  };
}

export function tintFor(palette: Palette, i: number): string {
  return palette.tints[i % palette.tints.length];
}

/** L'encre du texte posé sur `tintFor(palette, i)`. */
export function inkOnTintFor(palette: Palette, i: number): string {
  return palette.inkOnTints[i % palette.inkOnTints.length];
}
