import { CLEARANCE } from "@/lib/compose/constants";
import { cell, line } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItem, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type SurfaceAndBeneath = { surface: Item; beneath: Item };

/**
 * What is said, and what is underneath it.
 *
 * The rule is drawn, not described: one horizontal line between the two, with
 * its own clearance on both sides. The card is about the distance between
 * them, so the distance is the illustration.
 */
export const surfaceAndBeneath: ArchetypeModule<SurfaceAndBeneath> = {
  key: "surface_and_beneath",
  illustrationZone: "content",
  tintCount: 2,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    const surface = parseItem(p?.surface);
    const beneath = parseItem(p?.beneath);
    return surface && beneath ? { surface, beneath } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];
    // The rule is a line, so the illustration's "share" is a gap, not an area.
    // It shrinks with figureScale like any other illustration.
    const ruleGap = round2(CLEARANCE.fieldToField * (1 + figureScale));
    const half = round2((content.h - ruleGap) / 2);
    if (half < 120) return null;

    const top = { x: content.x, y: content.y, w: content.w, h: half };
    const bottom = { x: content.x, y: round2(content.y + half + ruleGap), w: content.w, h: half };
    const ruleY = round2(content.y + half + ruleGap / 2);

    const a = cell("content", top, payload.surface.label, payload.surface.gloss, palette, 0, secondaryMax);
    const b = cell("content", bottom, payload.beneath.label, payload.beneath.gloss, palette, 1, secondaryMax);
    if (!a || !b) return null;

    placed.push(...a);
    placed.push({
      role: "figure",
      band: "content",
      box: { x: content.x, y: round2(ruleY - 2), w: content.w, h: 4 },
      strokes: [line(content.x, ruleY, round2(content.x + content.w), ruleY, palette.ink, 4)],
    });
    placed.push(...b);
    // The two halves are separated by the rule gap rather than by
    // `fieldToField`, so `rows` is deliberately not used here.
    return placed;
  },
};
