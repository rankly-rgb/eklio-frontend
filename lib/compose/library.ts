import vectorsJson from "@/lib/visual-library/vectors.generated.json";
import type { Vector } from "@/lib/visual-library/vectors";
import type { Box, Stroke } from "@/lib/compose/types";
import { round2 } from "@/lib/compose/measure";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN DESSIN DE LA BIBLIOTHÈQUE, POSÉ DANS UNE BOÎTE — EN VECTEURS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ JAMAIS RASTÉRISÉ AU MOMENT DE COMPOSER. Le dessin entre dans la carte comme
 * un tracé, à la couleur que l'archétype lui donne (l'encre de SA palette) : le
 * même fichier sort en terracotta chez l'une, en vert sauge chez l'autre.
 *
 * ⚠ `fill-rule="evenodd"`, COMME DANS LE PACK. Sans lui, les creux d'un dessin
 * vectorisé se remplissent — une tasse devient une tache.
 *
 * ⚠ UN IDENTIFIANT INCONNU LÈVE. Le moteur ne déduit jamais l'existence d'un
 * dessin de son nom : ce qui n'est pas dans `vectors.generated.json` n'existe pas.
 */
const VECTORS = vectorsJson as Record<string, Vector>;

export class UnknownLibraryDrawing extends Error {}

export function hasLibraryDrawing(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(VECTORS, id);
}

export function libraryVector(id: string): Vector {
  const v = VECTORS[id];
  if (!v) throw new UnknownLibraryDrawing(`dessin inconnu de la bibliothèque : « ${id} »`);
  return v;
}

/** Le tracé, contenu et centré dans `box`, sans déformation. */
export function placeVector(v: Vector, box: Box): { d: string; fitted: Box; scale: number } {
  const scale = Math.min(box.w / v.w, box.h / v.h);
  const fw = v.w * scale;
  const fh = v.h * scale;
  const ox = box.x + (box.w - fw) / 2;
  const oy = box.y + (box.h - fh) / 2;
  let axis = 0;
  const d = v.d.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const value = Number(n);
    const out = axis % 2 === 0 ? ox + value * scale : oy + value * scale;
    axis += 1;
    return String(round2(out));
  });
  return { d, fitted: { x: round2(ox), y: round2(oy), w: round2(fw), h: round2(fh) }, scale };
}

/**
 * Le dessin `id` comme un `Drawing` : même signature que les dessins faits main
 * (`lib/compose/illustrations.ts`), pour que chaque archétype le pose là où il
 * posait le sien.
 */
export function libraryDrawing(id: string) {
  const v = libraryVector(id);
  return (box: Box, colour: string): Stroke[] => {
    const plain = placeVector(v, box);
    const added = strokeToHarmonise(v, plain.fitted);
    if (added === 0) {
      return [{ kind: "path", d: plain.d, box: plain.fitted, stroke: "none", strokeWidth: 0, fill: colour, fillRule: "evenodd", library: id }];
    }
    /*
     * ⚠ L'ENCRE RESTE DANS LA PLACE ALLOUÉE. Le contour ajouté déborde de la
     * moitié de sa largeur ; le dessin est donc posé dans la boîte RENTRÉE
     * d'autant, et la boîte déclarée est celle de l'encre. Posé dans la boîte
     * entière, il débordait sur le dégagement du pied et le moteur refusait la
     * carte (planche du 2026-11-01).
     */
    const half = added / 2;
    const inset = { x: box.x + half, y: box.y + half, w: Math.max(1, box.w - added), h: Math.max(1, box.h - added) };
    const { d, fitted } = placeVector(v, inset);
    const inked = { x: round2(fitted.x - half), y: round2(fitted.y - half), w: round2(fitted.w + added), h: round2(fitted.h + added) };
    return [{ kind: "path", d, box: inked, stroke: colour, strokeWidth: added, fill: colour, fillRule: "evenodd", library: id }];
  };
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN TRAIT HARMONISÉ — PAR LE BAS SEULEMENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Les dessins du pack ont été vectorisés un par un : posés à 400px de côté,
 * leur trait moyen va de 2,6px (`mem-returning-tide`) à 47px
 * (`practice-notebook`, un des six à reprendre), médiane 7,4px. Côte à côte
 * dans un mois, le fin paraît effacé.
 *
 * ⚠ ÉPAISSIR, JAMAIS AMINCIR. Un trait trop fin est épaissi par un contour de
 * la même encre jusqu'à `LIBRARY_STROKE_TARGET` rendus. Amincir un aplat
 * voudrait dire le redessiner : les dessins trop épais restent ce qu'ils sont,
 * et ceux qui le sont parce qu'ils sont défectueux sont listés (F94).
 *
 * 5px : le trait des dessins faits main est de 4 (`STROKE_WIDTH`), et un
 * dessin rempli lu à côté d'un trait de 4 paraît plus léger que lui.
 */
export const LIBRARY_STROKE_TARGET = 5;

export function renderedWeight(v: Vector, fitted: Box): number {
  return (v.weight ?? 0) * Math.max(fitted.w, fitted.h);
}

function strokeToHarmonise(v: Vector, fitted: Box): number {
  if (!v.weight) return 0;
  const missing = LIBRARY_STROKE_TARGET - renderedWeight(v, fitted);
  return missing > 0.05 ? round2(missing) : 0;
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  ZÉRO CARTE VIDE — CE QU'UNE CARTE DOIT PORTER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Une illustration de la bibliothèque, une forme, ou un fond photographique.
 * Un titre et un trait ne suffisent pas : décembre 2026 en portait sept sur
 * trente, et c'est la première chose qui se voit dans la grille.
 *
 * ⚠ LU DANS LE SVG LIVRÉ, PAS DANS UNE INTENTION. Les trois portent un marqueur
 * que le sérialiseur écrit (`data-library`, `data-shape`, `data-photo`) : ce
 * contrôle regarde ce qui sort, pas ce qui a été demandé.
 */
export function cardHasVisual(svg: string): boolean {
  return /\sdata-(library|shape|photo)="[^"]+"/.test(svg);
}

export class EmptyCard extends Error {}

/**
 * Un dessin d'UN SEUL trait ouvert (un sous-chemin) : un arc, une vague, un fil.
 *
 * ⚠ IL NE SE POSE PAS SUR UNE PHOTO (2026-11-04). En blanc sur la matière d'une
 * photo, un trait seul se lit comme une rayure, pas comme une intention (planche
 * du 2026-11-02, carte 9 : `priv-partial-outline`). Sur un aplat il tient — la
 * carte au trait nu sur fond blush en est un. Le plan des fonds le lit.
 */
export function isLoneStroke(id: string): boolean {
  if (!hasLibraryDrawing(id)) return false;
  return (libraryVector(id).d.match(/[Mm]/g) ?? []).length === 1;
}
