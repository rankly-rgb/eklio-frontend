import { CLEARANCE } from "@/lib/compose/constants";
import { cell, line, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type ComparisonPair = { left: Item[]; right: Item[] };

/**
 * Two columns, the same height, separated by a drawn rule.
 *
 * ⚠ THE TWO SIDES CARRY THE SAME NUMBER OF ROWS, enforced in `parse` as it is
 * in the database. A comparison whose left column has one more line than its
 * right reads as an imbalance rather than as a contrast, and no amount of
 * layout fixes that — the copy is what is wrong.
 */
const STROKE = 4;

export const comparisonPair: ArchetypeModule<ComparisonPair> = {
  key: "comparison_pair",
  illustrationZone: "content",
  tintCount: 2,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    const left = parseItems(p?.left, 2, 4);
    const right = parseItems(p?.right, 2, 4);
    if (!left || !right || left.length !== right.length) return null;
    return { left, right };
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    const ruleGap = round2(CLEARANCE.fieldToField * (1 + figureScale));
    const colW = round2((content.w - ruleGap) / 2);
    if (colW < 220) return null;

    const leftCol = { x: content.x, y: content.y, w: colW, h: content.h };
    const rightCol = { x: round2(content.x + colW + ruleGap), y: content.y, w: colW, h: content.h };
    const ruleX = round2(content.x + colW + ruleGap / 2);

    // ⚠ INSET BY HALF THE STROKE WIDTH AT BOTH ENDS. Drawn to the band's
    // exact edges, the rule's BOX extends 2px past them, and the bottom 2px
    // land inside the footer's clearance.
    const half = STROKE / 2;
    const ruleTop = round2(content.y + half);
    const ruleBottom = round2(content.y + content.h - half);
    placed.push({
      role: "figure",
      band: "content",
      box: { x: round2(ruleX - half), y: content.y, w: STROKE, h: content.h },
      strokes: [line(ruleX, ruleTop, ruleX, ruleBottom, palette.ink, STROKE)],
    });

    const leftBoxes = rows(leftCol, payload.left.length);
    const rightBoxes = rows(rightCol, payload.right.length);

    for (let i = 0; i < payload.left.length; i += 1) {
      const a = cell("content", leftBoxes[i], payload.left[i].label, payload.left[i].gloss, palette, 0, secondaryMax);
      const b = cell("content", rightBoxes[i], payload.right[i].label, payload.right[i].gloss, palette, 1, secondaryMax);
      if (!a || !b) return null;
      placed.push(...a, ...b);
    }
    return placed;
  },
};
