import { CLEARANCE, FIGURE_COVERAGE } from "@/lib/compose/constants";
import { cell, circle, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed, Stroke } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type ConcentricControl = { rings: Item[] };

/**
 * What is outside your hands, and what is inside them. Outermost first.
 *
 * ⚠ THIS IS THE `content_center` ARCHETYPE — the one exception the zone rule
 * names: an object drawn centred inside a shape that carries no text of its
 * own, with its labels outside it. The rings are drawn empty; the labels are a
 * list beneath, `fieldToField` clear of the outermost ring's box.
 */
export const concentricControl: ArchetypeModule<ConcentricControl> = {
  key: "concentric_control",
  illustrationZone: "content_center",
  tintCount: 3,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    const rings = parseItems(p?.rings, 2, 4);
    return rings ? { rings } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    const size = round2(Math.min(content.w, content.h * FIGURE_COVERAGE.max) * figureScale);
    if (size < 100) return null;

    const cx = round2(content.x + content.w / 2);
    const cy = round2(content.y + size / 2);
    const strokes: Stroke[] = [];

    // Outermost ring first, so ring i of the payload is ring i on the card.
    for (let i = 0; i < payload.rings.length; i += 1) {
      const r = round2((size / 2) * (1 - i / payload.rings.length));
      if (r < 12) return null;
      strokes.push(circle(cx, cy, r, palette.ink, 4));
    }

    placed.push({
      role: "figure",
      band: "content",
      box: { x: round2(cx - size / 2), y: content.y, w: size, h: size },
      strokes,
    });

    const listBox = {
      x: content.x,
      y: round2(content.y + size + CLEARANCE.fieldToField),
      w: content.w,
      h: round2(content.h - size - CLEARANCE.fieldToField),
    };
    if (listBox.h <= 0) return null;

    const boxes = rows(listBox, payload.rings.length);
    for (let i = 0; i < payload.rings.length; i += 1) {
      const built = cell("content", boxes[i], payload.rings[i].label, payload.rings[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
