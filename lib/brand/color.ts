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

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA SEULE COLORIMÉTRIE DU PRODUIT (F99, 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Luminance, contraste et Lab vivent ICI et nulle part ailleurs. Le moteur de
 * composition en portait une copie dont la luminance ne linéarisait pas le bleu
 * (`0.0722 * (n & 255)`) : `contrast("#2B2A27", "#000000")` y valait 57,7 au lieu
 * de 1,5, et plum_bone sombre posait une encre à 2,59:1 sous un plancher de 3:1.
 * Le rendu des fichiers en avait une deuxième copie, juste, mais recopiée.
 *
 * `lib/__tests__/one-colorimetry.test.ts` lit le code source et échoue si une
 * autre implémentation apparaît. Le jumeau SQL (`site_spec_relative_luminance`)
 * ne peut pas importer ce module ; il porte le même seuil, 0,04045.
 */

/** Un canal sRGB (0–255) → linéaire. La fonction de transfert sRGB (seuil 0,04045). */
export function linearChannel(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG à partir de canaux déjà linéaires. */
export function luminanceOfLinear(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Luminance relative WCAG d'une couleur hex. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return luminanceOfLinear(linearChannel(rgb.r), linearChannel(rgb.g), linearChannel(rgb.b));
}

/** Rapport de contraste WCAG entre deux luminances relatives, de 1 à 21. */
export function contrastOfLuminances(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  return contrastOfLuminances(relativeLuminance(a), relativeLuminance(b));
}

/** CIE Lab (D65) d'une couleur hex, pour les distances perçues (ΔE76). */
export function labOf(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = [linearChannel(rgb.r), linearChannel(rgb.g), linearChannel(rgb.b)];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = luminanceOfLinear(r, g, b);
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
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

/* ── LE VOILE DE LA SURIMPRESSION ───────────────────────────────────────── */

/** Au-delà, la photographie cesse d'être une photographie. */
export const MAX_OVERLAY_SCRIM = 0.92;

export type OverlayScrim = {
  /** 0–1, l'opacité à laquelle poser le voile. */
  alpha: number;
  /** Le rapport de contraste GARANTI à cette opacité, quelle que soit la photo. */
  ratio: number;
  /** Faux quand même l'opacité maximale ne suffit pas. */
  meetsTarget: boolean;
};

/**
 * L'opacité du voile sous une surimpression posée sur une photographie
 * INCONNUE.
 *
 * ⚠ CE N'EST PAS `solveScrimOpacity` DE `lib/kit/render/luminance.ts`, ET LA
 * DIFFÉRENCE COMPTE. Celui-là résout le voile contre la luminance MESURÉE
 * d'une région de l'image : il prend un `Buffer` décodé, appelle `sharp`, et
 * appartient au pipeline de rendu des fichiers téléchargeables. Rien ne
 * persiste sa valeur — `brand_images` n'a pas de colonne de luminance — donc
 * s'en servir sur un chemin de LECTURE voudrait dire télécharger et décoder la
 * photographie à chaque affichage de l'accueil.
 *
 * Celui-ci résout le même voile SANS mesurer, en prenant le pire cas : un
 * pixel blanc dessous. Le contraste obtenu est alors un PLANCHER — n'importe
 * quelle photographie réelle, plus sombre que du blanc, ne peut que faire
 * mieux. Le nombre est garanti, pas mesuré, et le commentaire le dit plutôt
 * que de laisser croire à une mesure.
 */
export function solveOverlayScrim(
  scrimHex: string,
  textHex: string,
  target = 4.5
): OverlayScrim {
  const scrim = hexToRgb(scrimHex);
  if (!scrim) return { alpha: MAX_OVERLAY_SCRIM, ratio: 1, meetsTarget: false };

  // Le pire fond possible : blanc. Tout pixel réel est plus sombre, donc
  // contraste MIEUX avec un texte clair une fois le voile posé.
  const worstCase = 255;
  const blend = (channel: number, alpha: number) =>
    worstCase * (1 - alpha) + channel * alpha;

  let best: OverlayScrim = { alpha: 0, ratio: 1, meetsTarget: false };

  for (let step = 1; step <= Math.round(MAX_OVERLAY_SCRIM * 100); step += 1) {
    const alpha = step / 100;
    const blended = rgbToHex({
      r: blend(scrim.r, alpha),
      g: blend(scrim.g, alpha),
      b: blend(scrim.b, alpha),
    });
    const ratio = contrastRatio(textHex, blended);
    if (ratio > best.ratio) best = { alpha, ratio, meetsTarget: ratio >= target };
    if (ratio >= target) return { alpha, ratio, meetsTarget: true };
  }

  return best;
}
