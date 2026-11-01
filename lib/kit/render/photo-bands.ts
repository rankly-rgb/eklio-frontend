import sharp from "sharp";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES BORNES DE PIXELS D'UN FOND, BANDE PAR BANDE — MESURÉES UNE FOIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le voile d'un fond photo n'est plus uniforme (2026-11-01, troisième
 * session) : il est résolu ligne de texte par ligne de texte, contre les pixels
 * qui sont RÉELLEMENT sous cette ligne. Ce module les mesure, au build, et le
 * moteur lit le résultat (`lib/visual-library/photo-bands.generated.json`) — il
 * ne décode jamais un JPEG en composant.
 *
 * ⚠ DES BORNES PAR CANAL, PAS UNE LUMINANCE. La luminance d'un pixel mêlé au
 * papier croît avec chacun de ses canaux : un pixel fait des trois minima est
 * plus sombre que tout pixel réel de la bande, un pixel fait des trois maxima
 * plus clair. Résoudre contre ces deux bornes est donc une GARANTIE pour toute
 * la bande, pas une moyenne.
 *
 * ⚠ LA GÉOMÉTRIE EST CELLE DE LA CARTE. Le fond est posé en
 * `preserveAspectRatio="xMidYMid slice"` sur 1080 × 1350 : un carré est agrandi
 * à 1350 et rogné au centre. Une bande de la carte couvre donc des lignes et des
 * colonnes précises de la source ; on les prend avec `REACH` lignes et colonnes de
 * plus de chaque côté et une marge de `MARGIN` niveaux.
 *
 * ⚠ 2 ET 12, PAS 1 ET 4 : MESURÉ SUR LE RENDU. resvg agrandit l'image avec un
 * filtre cubique, qui DÉPASSE ses voisins sur un contour net (branches sombres sur
 * ciel clair, `bg-branch-sky`) ; avec 1 et 4, des lignes y sortaient à 4,47:1.
 */
export const BAND = 10;
const MARGIN = 12;
/** Le support d'un filtre cubique : deux pixels source de chaque côté. */
const REACH = 2;

export type PhotoBands = { band: number; min: number[][]; max: number[][] };

export async function measurePhotoBands(jpeg: Buffer, canvas = { width: 1080, height: 1350 }): Promise<PhotoBands> {
  const { data, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const scale = Math.max(canvas.width / W, canvas.height / H);
  const offX = (canvas.width - W * scale) / 2;
  const offY = (canvas.height - H * scale) / 2;
  const x0 = Math.max(0, Math.floor((0 - offX) / scale) - REACH);
  const x1 = Math.min(W - 1, Math.ceil((canvas.width - offX) / scale) + REACH);
  const min: number[][] = [];
  const max: number[][] = [];
  for (let y = 0; y < canvas.height; y += BAND) {
    const s0 = Math.max(0, Math.floor((y - offY) / scale) - REACH);
    const s1 = Math.min(H - 1, Math.ceil((Math.min(canvas.height, y + BAND) - offY) / scale) + REACH);
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (let sy = s0; sy <= s1; sy += 1) {
      for (let sx = x0; sx <= x1; sx += 1) {
        const i = (sy * W + sx) * C;
        for (let c = 0; c < 3; c += 1) {
          if (data[i + c] < lo[c]) lo[c] = data[i + c];
          if (data[i + c] > hi[c]) hi[c] = data[i + c];
        }
      }
    }
    min.push(lo.map((v) => Math.max(0, v - MARGIN)));
    max.push(hi.map((v) => Math.min(255, v + MARGIN)));
  }
  return { band: BAND, min, max };
}
