import { describe, expect, it } from "vitest";
import * as library from "@/lib/compose/illustrations";
import { DRAWING_FOR, bubble, STROKE_WIDTH, type Drawing } from "@/lib/compose/illustrations";
import type { Box, Stroke } from "@/lib/compose/types";

/*
 * ── POURQUOI UNE BOÎTE FAUSSE EST PIRE QU'UN DESSIN LAID ────────────────
 *
 * Le contrôle de dégagement ne lit jamais un chemin : il lit la BOÎTE que le
 * dessin déclare (voir `types.ts` — « the box is computed by whoever drew it,
 * not parsed back out of the path »). Un tracé qui sort de sa boîte passe donc
 * le contrôle avec 40px de marge annoncés et touche quand même le glyphe d'à
 * côté, sans qu'aucune suite ne s'en aperçoive.
 *
 * Trois dessins le faisaient le 2026-09-21 : les deux feuilles de la plante
 * débordaient par le haut, et la jambe de la silhouette assise par la droite.
 * Cette suite est la raison pour laquelle cela ne peut plus arriver en
 * silence.
 */

const DRAWINGS: Array<[string, Drawing]> = [
  ["surfacing", library.surfacing],
  ["anchor", library.anchor],
  ["wave", library.wave],
  ["profile", library.profile],
  ["plant", library.plant],
  ["clouds", library.clouds],
  ["window_", library.window_],
  ["knot", library.knot],
  ["seated", library.seated],
  ["door", library.door],
  ["mark", library.mark],
];

/** Les proportions de boîte qu'une bande de contenu produit vraiment. */
const BOXES: Array<[string, Box]> = [
  ["bandeau large", { x: 72, y: 500, w: 936, h: 280 }],
  ["gouttière haute", { x: 72, y: 500, w: 300, h: 620 }],
  ["carré", { x: 72, y: 500, w: 320, h: 320 }],
  ["petit", { x: 72, y: 500, w: 160, h: 160 }],
];

/**
 * Les extrémités d'un chemin, plus ses points de contrôle.
 *
 * ⚠ LES POINTS DE CONTRÔLE D'UNE BÉZIER SONT HORS DE LA COURBE, et les
 * inclure rend ce test PLUS strict que la géométrie réelle — jamais moins.
 * C'est le bon sens de l'erreur : une boîte qui contient les points de
 * contrôle contient la courbe.
 */
function pointsOf(d: string): Array<[number, number]> {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const points: Array<[number, number]> = [];
  // Les commandes `a`/`A` portent des rayons et des drapeaux qui ne sont pas
  // des coordonnées ; les arcs sont donc contrôlés par leur boîte seule.
  if (/[aA]/.test(d)) return points;
  for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return points;
}

function outside(strokes: Stroke[]): string[] {
  const bad: string[] = [];
  for (const s of strokes) {
    const half = s.strokeWidth / 2;
    for (const [px, py] of pointsOf(s.d)) {
      const dx = Math.min(px - s.box.x, s.box.x + s.box.w - px);
      const dy = Math.min(py - s.box.y, s.box.y + s.box.h - py);
      // Une tolérance d'un centième de pixel : `round2` arrondit les deux côtés.
      if (dx < half - 0.01 || dy < half - 0.01) bad.push(`(${px}, ${py}) hors de sa boîte`);
    }
  }
  return bad;
}

describe("la bibliothèque de dessins", () => {
  it.each(DRAWINGS)("%s garde chaque tracé dans la boîte qu'il déclare", (_name, draw) => {
    for (const [, box] of BOXES) expect(outside(draw(box, "#000", STROKE_WIDTH))).toEqual([]);
  });

  it("la bulle aussi, queue comprise, des deux côtés", () => {
    for (const [, box] of BOXES) {
      expect(outside(bubble(box, "#000", true))).toEqual([]);
      expect(outside(bubble(box, "#000", false))).toEqual([]);
    }
  });

  it.each(DRAWINGS)("%s trace sans remplissage, sans dégradé et dans la fourchette 3-5px", (_n, draw) => {
    for (const [, box] of BOXES) {
      for (const s of draw(box, "#2B2A27", STROKE_WIDTH)) {
        expect(s.fill).toBe("none");
        expect(s.stroke).toBe("#2B2A27");
        expect(s.strokeWidth).toBeGreaterThanOrEqual(3);
        expect(s.strokeWidth).toBeLessThanOrEqual(5);
      }
    }
  });

  it.each(DRAWINGS)("%s remplit sa boîte plutôt que de s'y loger", (_n, draw) => {
    /*
     * ⚠ C'EST LA MESURE QUI MANQUAIT LE 2026-09-21. Chaque objet était dessiné
     * correctement et chacun était minuscule : l'ancre occupait 4 % de la
     * bande, le fil noué 16 %. Aucune suite ne posait la question, parce
     * qu'aucune suite ne regardait une image.
     */
    for (const [label, box] of BOXES) {
      const strokes = draw(box, "#000", STROKE_WIDTH);
      const xs = strokes.flatMap((s) => [s.box.x, s.box.x + s.box.w]);
      const ys = strokes.flatMap((s) => [s.box.y, s.box.y + s.box.h]);
      const span = Math.max(...xs) - Math.min(...xs);
      const rise = Math.max(...ys) - Math.min(...ys);
      // `mark` est une respiration sous une phrase, pas un objet : elle est
      // la seule à ne prendre qu'une fraction de sa boîte, et la spécification
      // la nomme « une petite marque dessinée ».
      const floor = _n === "mark" ? 0.1 : 0.55;
      expect(
        Math.max(span / box.w, rise / box.h),
        `${_n} dans une boîte « ${label} »`
      ).toBeGreaterThanOrEqual(floor);
    }
  });

  it("chaque archétype illustré nomme un dessin qui existe", () => {
    for (const [key, drawing] of Object.entries(DRAWING_FOR)) {
      expect(typeof drawing, key).toBe("function");
    }
  });
});
