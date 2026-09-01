/*
 * Utilitaires de couleur — module pur, aucun I/O.
 *
 * Ils servent deux choses : DÉRIVER les couleurs de texte d'une prévisualisation
 * à partir de la palette de l'utilisateur (§4), et CALCULER honnêtement le
 * contraste affiché par le badge AA du kit de marque (§5).
 *
 * Aucune de ces couleurs n'est un token de l'app : ce sont des couleurs de
 * MARQUE, dérivées de données. C'est la seule catégorie de couleur autorisée
 * hors de `styles/tokens.css`.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

const HEX = /^#?([0-9a-f]{6})$/i;

/** `#B4674A` → `{r,g,b}` en 0–255. Renvoie null si ce n'est pas un hex à 6 chiffres. */
export function hexToRgb(hex: string): Rgb | null {
  const match = HEX.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b))
    .toString(16)
    .slice(1)
    .toUpperCase()}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Applique une transformation dans l'espace HSL, en repassant par l'hex. */
function mapHsl(hex: string, transform: (hsl: Hsl) => Hsl): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(hslToRgb(transform(rgbToHsl(rgb))));
}

/** Descend la clarté de `points` (en points de pourcentage), sans passer sous 0. */
export function darkenLightness(hex: string, points: number): string {
  return mapHsl(hex, (hsl) => ({ ...hsl, l: Math.max(0, hsl.l - points) }));
}

/** Force la clarté à `max` au plus — laisse intacte une couleur déjà sombre. */
export function capLightness(hex: string, max: number): string {
  return mapHsl(hex, (hsl) => ({ ...hsl, l: Math.min(hsl.l, max) }));
}

/** Réécrit saturation et clarté en gardant la teinte. */
export function toneOf(hex: string, saturationMax: number, lightness: number): string {
  return mapHsl(hex, (hsl) => ({
    ...hsl,
    s: Math.min(hsl.s, saturationMax),
    l: lightness,
  }));
}

/** `#B4674A` + 0.18 → `rgba(180, 103, 74, 0.18)`. Pour les filets teintés. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

/** Luminance relative WCAG. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type AaSize = "normal" | "large";

/**
 * Vrai si la paire passe WCAG AA — 4.5:1 en texte courant, 3:1 en grand texte
 * (≥ 24px, ou ≥ 18.66px en gras).
 *
 * Le badge du kit rapporte le résultat HONNÊTEMENT, y compris quand la palette
 * de l'utilisateur échoue : cacher un échec serait lui faire publier un site
 * illisible en croyant l'inverse.
 */
export function meetsAA(
  foreground: string,
  background: string,
  size: AaSize = "normal"
): boolean {
  return contrastRatio(foreground, background) >= (size === "large" ? 3 : 4.5);
}
