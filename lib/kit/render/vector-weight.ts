import { Resvg } from "@resvg/resvg-js";
import type { Vector } from "@/lib/visual-library/vectors";

/** Le côté auquel l'épaisseur est mesurée. Assez grand pour qu'un pixel de bord pèse peu. */
const WEIGHT_SIDE = 400;

/**
 * ⚠ RASTÉRISÉ ICI, POUR MESURER, JAMAIS AU MOMENT DE COMPOSER. Épaisseur
 * moyenne = 2 × aire encrée / pixels de bord : exact pour un trait de largeur
 * constante, une moyenne honnête pour un dessin. Rendu en fraction du plus
 * grand côté, pour valoir à toute taille de pose.
 */
export function measureWeight(v: Vector): number {
  const s = WEIGHT_SIDE / Math.max(v.w, v.h);
  const W = Math.max(1, Math.round(v.w * s));
  const H = Math.max(1, Math.round(v.h * s));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${v.w} ${v.h}"><path d="${v.d}" fill-rule="evenodd" fill="#000"/></svg>`;
  const px = new Resvg(svg, { background: "#fff" }).render().pixels;
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4] < 128;
  let area = 0;
  let edge = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!ink(x, y)) continue;
      area += 1;
      if (!ink(x + 1, y) || !ink(x - 1, y) || !ink(x, y + 1) || !ink(x, y - 1)) edge += 1;
    }
  }
  return edge === 0 ? 0 : Math.round(((2 * area) / edge / WEIGHT_SIDE) * 1e5) / 1e5;
}

