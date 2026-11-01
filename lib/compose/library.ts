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
    const { d, fitted } = placeVector(v, box);
    return [{ kind: "path", d, box: fitted, stroke: "none", strokeWidth: 0, fill: colour, fillRule: "evenodd", library: id }];
  };
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
