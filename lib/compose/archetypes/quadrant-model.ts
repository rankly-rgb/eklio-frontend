import { CLEARANCE, FIGURE_COVERAGE, TYPE } from "@/lib/compose/constants";
import { cell, columns, fitText, line, linesFrom, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type QuadrantModel = { axis_x: string; axis_y: string; items: Item[] };

/**
 * Four cells around a drawn cross, with the two axes named.
 *
 * ⚠ THE AXIS NAMES ARE MONO AND SIT OUTSIDE THE STROKES' CLEARANCE, not on
 * them. A label riding a line is the single most common way this layout goes
 * wrong, and it goes wrong invisibly: it reads fine at the size a designer
 * looks at it and collides at the size it ships.
 */
/** Every stroke on this card, so the clearance arithmetic has one number to read. */
const STROKE = 4;

export const quadrantModel: ArchetypeModule<QuadrantModel> = {
  key: "quadrant_model",
  illustrationZone: "content",
  tintCount: 4,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p.axis_x !== "string" || typeof p.axis_y !== "string") return null;
    const items = parseItems(p.items, 4, 4);
    return items ? { axis_x: p.axis_x, axis_y: p.axis_y, items } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];

    // The axis strip at the top of the content band: the cross, and the two
    // names. Its height is the illustration's share, scaled by the resolver.
    const stripH = round2(content.h * FIGURE_COVERAGE.max * figureScale);
    if (stripH < 60) return null;

    const strip = { x: content.x, y: content.y, w: content.w, h: stripH };
    const cx = round2(strip.x + strip.w / 2);
    const cy = round2(strip.y + strip.h / 2);
        // ⚠ 0.32 AND NOT 0.42. The axis names sit a full `glyphToStroke` beyond
    // the arms they label, so the strip has to hold 2×arm + 40 + a line of
    // mono. At 0.42 it did not, and the y name landed 38px from the vertical —
    // two pixels inside the clearance, which is exactly the kind of miss that
    // reads as fine and measures as wrong.
    const arm = round2(Math.min(strip.w, strip.h) * 0.32);

    // ⚠ THE CLEARANCE IS FROM THE STROKE'S BOX, WHICH IS WIDER THAN ITS PATH.
    // A 4px line's box is inflated by 2px on each side (that is what a reader
    // sees), so a name placed 40px beyond the arm END measures 38px from the
    // box. Two pixels, invisible to anyone reading the code, and the suite
    // caught it on three archetypes at once.
    const half = STROKE / 2;

    placed.push({
      role: "figure",
      band: "content",
      box: strip,
      strokes: [
        line(cx - arm, cy, cx + arm, cy, palette.ink, STROKE),
        line(cx, cy - arm, cx, cy + arm, palette.ink, STROKE),
      ],
    });

    // The names, kept a full `glyphToStroke` clear of the arms they label.
    const nameRange = { min: TYPE.mono.min, max: Math.min(TYPE.mono.max, secondaryMax), floor: TYPE.mono.floor };
    if (nameRange.max < nameRange.floor) return null;
    const xFit = fitText(payload.axis_x, "mono", strip.w * 0.3, 40, nameRange);
    const yFit = fitText(payload.axis_y, "mono", strip.w * 0.3, 40, nameRange);
    if (!xFit || !yFit) return null;

    placed.push({
      role: "text",
      band: "content",
      box: strip,
      lines: [
        ...linesFrom(
          xFit,
          round2(cx + arm + half + CLEARANCE.glyphToStroke),
          round2(cy - xFit.size * 0.6),
          strip.w * 0.3, "mono", 500, palette.ink, "start"
        ),
        // ⚠ ABOVE THE VERTICAL, NOT BESIDE IT. Beside it, the only separation
        // available is horizontal, and the name would have to start 40px to
        // the right of a line that runs through the middle of the card —
        // which reads as belonging to the quadrant it lands in.
        ...linesFrom(
          yFit,
          round2(cx + 12),
          round2(cy - arm - half - CLEARANCE.glyphToStroke - yFit.height),
          strip.w * 0.3, "mono", 500, palette.ink, "start"
        ),
      ],
    });

    // The four cells, below the strip, `fieldToField` clear of it.
    const grid = {
      x: content.x,
      y: round2(strip.y + strip.h + CLEARANCE.fieldToField),
      w: content.w,
      h: round2(content.h - strip.h - CLEARANCE.fieldToField),
    };
    if (grid.h <= 0) return null;

    const [top, bottom] = rows(grid, 2);
    const boxes = [...columns(top, 2), ...columns(bottom, 2)];

    for (let i = 0; i < 4; i += 1) {
      const built = cell("content", boxes[i], payload.items[i].label, payload.items[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }

    return placed;
  },
};
