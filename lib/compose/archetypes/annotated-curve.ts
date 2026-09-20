import { CLEARANCE, FIGURE_COVERAGE, TYPE } from "@/lib/compose/constants";
import { cell, fitText, line, linesFrom, polyline, rows } from "@/lib/compose/layout";
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
    // ⚠ `min` AND NOT `max` COVERAGE. The plot is not the only thing in this
    // band: the two axis names each cost a `glyphToStroke` plus a line of
    // mono, and the named points cost a cell each. At 45% the band had 202px
    // left for two cells that need 131 apiece, and the archetype could not
    // compose at any scale. Coverage is a range, and this archetype lives at
    // the bottom of it — which the clearance rule says is the right way round
    // when the two disagree.
    const plotH = round2(content.h * FIGURE_COVERAGE.min * figureScale);
    if (plotH < 90) return null;

    const plot = { x: content.x, y: content.y, w: content.w, h: plotH };
    const baseY = round2(plot.y + plot.h);
    const leftX = plot.x;

    // The curve: one vertex per named point, so the drawing and the list are
    // the same length by construction rather than by agreement.
    const n = payload.points.length;
    const step = round2(plot.w / (n - 1 || 1));
    const vertices: Array<[number, number]> = payload.points.map((_, i) => {
      // A shape, deterministic from the count alone: down, then up.
      const t = n === 1 ? 0 : i / (n - 1);
      const dip = Math.sin(Math.PI * t);
      return [round2(leftX + i * step), round2(baseY - plot.h * (0.25 + 0.55 * (1 - dip)))];
    });

    const strokes: Stroke[] = [
      line(leftX, plot.y, leftX, baseY, palette.ink, STROKE),
      line(leftX, baseY, round2(plot.x + plot.w), baseY, palette.ink, STROKE),
      polyline(vertices, palette.tints[0], CURVE),
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

    const boxes = rows(listBox, n);
    for (let i = 0; i < n; i += 1) {
      const built = cell("content", boxes[i], payload.points[i].label, payload.points[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
