import { CLEARANCE, FIGURE_COVERAGE } from "@/lib/compose/constants";
import { cell, circle, polyline, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type Cycle = { nodes: Item[] };

/**
 * Three to six steps that come back round.
 *
 * ⚠ THE RING IS DRAWN ONCE AND THE STEPS ARE LISTED, rather than the steps
 * being placed around the ring. Labels on a circle are the layout that forces
 * either radial text — unreadable — or six different clearance problems, one
 * per angle. The ring says "this repeats"; the list says what repeats.
 */
export const cycle: ArchetypeModule<Cycle> = {
  key: "cycle",
  illustrationZone: "content",
  tintCount: 3,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    const nodes = parseItems(p?.nodes, 3, 6);
    return nodes ? { nodes } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    const stripH = round2(content.h * FIGURE_COVERAGE.min * figureScale);
    if (stripH < 56) return null;

    const strip = { x: content.x, y: content.y, w: content.w, h: stripH };
    const cx = round2(strip.x + strip.w / 2);
    const cy = round2(strip.y + strip.h / 2);
    const r = round2(Math.min(strip.h, strip.w) * 0.38);

    placed.push({
      role: "figure",
      band: "content",
      box: strip,
      strokes: [
        circle(cx, cy, r, palette.ink, 4),
        // The arrowhead that makes it a cycle rather than a circle.
        polyline(
          [
            [round2(cx + r - 10), round2(cy - 12)],
            [round2(cx + r), round2(cy)],
            [round2(cx + r - 10), round2(cy + 12)],
          ],
          palette.ink,
          4
        ),
      ],
    });

    const listBox = {
      x: content.x,
      y: round2(strip.y + strip.h + CLEARANCE.fieldToField),
      w: content.w,
      h: round2(content.h - strip.h - CLEARANCE.fieldToField),
    };
    if (listBox.h <= 0) return null;

    const boxes = rows(listBox, payload.nodes.length);
    for (let i = 0; i < payload.nodes.length; i += 1) {
      const built = cell("content", boxes[i], payload.nodes[i].label, payload.nodes[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
