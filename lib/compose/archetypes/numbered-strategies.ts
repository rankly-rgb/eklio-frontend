import { CLEARANCE, FIGURE_COVERAGE } from "@/lib/compose/constants";
import { cell, line, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed, Stroke } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type NumberedStrategies = { items: Item[] };

/**
 * Three to five things to try, on a drawn spine.
 *
 * ⚠ THE ORDINALS ARE TICKS, NOT NUMERALS. A "1." set in type beside a label is
 * a second text element competing with it at the same size; a tick on a spine
 * says the same thing with no words at all, and it never collides with the
 * label because it is on the other side of a 48px gutter.
 */
const STROKE = 4;

export const numberedStrategies: ArchetypeModule<NumberedStrategies> = {
  key: "numbered_strategies",
  illustrationZone: "content",
  tintCount: 3,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    const items = parseItems(p?.items, 3, 5);
    return items ? { items } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    const spineW = round2(content.w * FIGURE_COVERAGE.min * figureScale * 0.4);
    if (spineW < 24) return null;

    const spineX = round2(content.x + spineW / 2);
    const cellsBox = {
      x: round2(content.x + spineW + CLEARANCE.fieldToField),
      y: content.y,
      w: round2(content.w - spineW - CLEARANCE.fieldToField),
      h: content.h,
    };
    if (cellsBox.w < 300) return null;

    const boxes = rows(cellsBox, payload.items.length);
    // Inset by half the stroke width, for the same reason as the rule in
    // comparison-pair.ts: the box is wider than the path.
    const half = STROKE / 2;
    const strokes: Stroke[] = [
      line(spineX, round2(content.y + half), spineX, round2(content.y + content.h - half), palette.ink, STROKE),
    ];
    for (const b of boxes) {
      const midY = round2(b.y + b.h / 2);
      strokes.push(
        line(round2(spineX - spineW / 2), midY, round2(spineX + spineW / 2), midY, palette.ink, STROKE)
      );
    }

    placed.push({
      role: "figure",
      band: "content",
      box: { x: content.x, y: content.y, w: spineW, h: content.h },
      strokes,
    });

    for (let i = 0; i < payload.items.length; i += 1) {
      const built = cell("content", boxes[i], payload.items[i].label, payload.items[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
