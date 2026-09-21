import { CLEARANCE, figureShare, TYPE } from "@/lib/compose/constants";
import { cell, columns, fitText, line, linesFrom, polyline } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed, Stroke } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type AnnotatedCurve = { axis_x: string; axis_y: string; points: Item[] };

/**
 * A shape over time, with two or four moments named.
 *
 * ⚠ NO NUMBERS ON EITHER AXIS, and none in the payload to put there. This is a
 * card about a shape — "it dips before it steadies" — and a scale would make it
 * a claim about magnitudes nobody measured. The axes are named, not graduated.
 */
const STROKE = 4;
/** The curve itself is heavier than its axes: it is the subject, they are the frame. */
const CURVE = 6;

export const annotatedCurve: ArchetypeModule<AnnotatedCurve> = {
  key: "annotated_curve",
  illustrationZone: "content",
  tintCount: 3,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p.axis_x !== "string" || typeof p.axis_y !== "string") return null;
    const points = parseItems(p.points, 2, 4);
    return points ? { axis_x: p.axis_x, axis_y: p.axis_y, points } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    /*
     * ⚠ LA FOURCHETTE ENTIÈRE, ET C'EST L'ÉCHELLE QUI ARBITRE. Cette ligne
     * était figée sur `FIGURE_COVERAGE.min` avec, en commentaire, une mesure
     * exacte : à 45 % il ne restait que 202px pour deux cellules qui en
     * demandent 131 chacune. La mesure était juste, la conclusion trop large
     * — elle valait pour QUATRE points nommés, pas pour deux.
     *
     * `figureShare` part du haut et redescend cran par cran : une courbe à
     * deux points obtient ses 45 %, une courbe à quatre points retombe d'elle
     * -même vers 25 % au lieu d'y être clouée d'avance.
     */
    const plotH = round2(content.h * figureShare(figureScale));
    if (plotH < 150) return null;

    const plot = { x: content.x, y: content.y, w: content.w, h: plotH };
    const baseY = round2(plot.y + plot.h);
    const leftX = plot.x;

    // The curve: one vertex per named point, so the drawing and the list are
    // the same length by construction rather than by agreement.
    const n = payload.points.length;
    /*
     * ⚠ `sin(πt)` DONNAIT UNE DROITE HORIZONTALE À DEUX POINTS. Avec n = 2 les
     * abscisses valent t = 0 et t = 1, où le sinus vaut zéro des deux côtés :
     * les deux sommets se posaient exactement à la même hauteur. La carte
     * « la charge retombe puis se stabilise » sortait avec une courbe plate,
     * et une courbe plate est un démenti, pas une illustration.
     *
     * Le profil est maintenant explicite — haut, creux au premier tiers,
     * remontée partielle — et interpolé linéairement, donc chaque nombre de
     * points en prélève un échantillon qui garde la forme.
     */
    const levelAt = (t: number) =>
      t <= 0.45 ? 0.94 - (0.78 * t) / 0.45 : 0.16 + (0.46 * (t - 0.45)) / 0.55;
    const at = (t: number): [number, number] => [
      round2(leftX + plot.w * t),
      round2(baseY - plot.h * (0.06 + 0.86 * levelAt(t))),
    ];

    /*
     * ⚠ LA COURBE EST ÉCHANTILLONNÉE, PAS JOINTE POINT À POINT. Un sommet par
     * point nommé, reliés au segment : avec deux points nommés — le cas
     * courant — cela donne DEUX sommets, donc une droite. La carte « la charge
     * retombe puis se stabilise » sortait avec un trait qui penche, et un
     * trait qui penche dément son propre titre.
     *
     * Le tracé prend 40 échantillons du profil ; les points nommés gardent
     * leur abscisse, et leur colonne se lit dessous. Ce que la carte dessine
     * et ce qu'elle nomme restent la même chose, sans que l'un impose à
     * l'autre sa résolution.
     */
    const SAMPLES = 40;
    const vertices: Array<[number, number]> = Array.from({ length: SAMPLES + 1 }, (_, i) =>
      at(i / SAMPLES)
    );

    const strokes: Stroke[] = [
      line(leftX, plot.y, leftX, baseY, palette.ink, STROKE),
      line(leftX, baseY, round2(plot.x + plot.w), baseY, palette.ink, STROKE),
      /*
       * ⚠ À L'ENCRE, PAS À LA TEINTE. Les teintes sont des aplats adoucis,
       * faits pour porter du texte derrière lui ; la courbe passait dessus en
       * `tints[0]` et disparaissait sur le papier. Elle est le sujet de la
       * carte : elle se trace comme tous les autres objets de la
       * bibliothèque.
       */
      polyline(vertices, palette.ink, CURVE),
    ];

    placed.push({ role: "figure", band: "content", box: plot, strokes });

    const nameRange = { min: TYPE.mono.min, max: Math.min(TYPE.mono.max, secondaryMax), floor: TYPE.mono.floor };
    if (nameRange.max < nameRange.floor) return null;
    const xFit = fitText(payload.axis_x, "mono", plot.w * 0.4, 40, nameRange);
    const yFit = fitText(payload.axis_y, "mono", plot.w * 0.4, 40, nameRange);
    if (!xFit || !yFit) return null;

    // Both names sit a full `glyphToStroke` clear of the axis they belong to:
    // x below the baseline, y above the top of the vertical.
    // Clear of the stroke's BOX, which is inflated by half the stroke width —
    // see the note on the same arithmetic in quadrant-model.ts.
    const half = STROKE / 2;
    const xY = round2(baseY + half + CLEARANCE.glyphToStroke);
    const yY = round2(plot.y - half - CLEARANCE.glyphToStroke - yFit.height);
    placed.push({
      role: "text",
      band: "content",
      box: { x: plot.x, y: yY, w: plot.w, h: round2(xY + xFit.height - yY) },
      lines: [
        ...linesFrom(xFit, round2(plot.x + plot.w - xFit.width), xY, plot.w, "mono", 500, palette.ink, "start"),
        ...linesFrom(yFit, plot.x, yY, plot.w, "mono", 500, palette.ink, "start"),
      ],
    });

    /*
     * ⚠ THE HEIGHT IS THE DISTANCE TO THE BAND'S BOTTOM, NOT THE SUM OF WHAT
     * IS ABOVE IT SUBTRACTED FROM THE BAND.
     *
     * Written as a subtraction it has to name every term that pushed this box
     * down, and the first version forgot one: the half stroke width added to
     * `xY`. The list ran 2px past the content band, into the footer's
     * clearance — and the failure surfaced as `aboveFooter@61.99`, which
     * points at the footer and not at the line that was actually wrong.
     */
    const listY = round2(xY + xFit.height + CLEARANCE.fieldToField);
    const listBox = {
      x: content.x,
      y: listY,
      w: content.w,
      h: round2(content.y + content.h - listY),
    };
    if (listBox.h <= 0) return null;

    /*
     * ⚠ EN COLONNES, PAS EN LIGNES. Chaque point nommé a une abscisse sur la
     * courbe ; empilé en lignes il perdait ce lien, et surtout il coûtait
     * `n × 153px` de hauteur — ce qui clouait le tracé au dernier cran de
     * l'échelle, 159px pour 936 de large. Une courbe de 159px de haut est un
     * trait qui penche, pas une courbe.
     *
     * En colonnes la liste coûte UNE hauteur de cellule quel que soit `n`, le
     * tracé reprend sa part de la fourchette, et le point i se lit sous le
     * sommet i.
     */
    const boxes = columns(listBox, n);
    for (let i = 0; i < n; i += 1) {
      const built = cell("content", boxes[i], payload.points[i].label, payload.points[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
