import { CLEARANCE, FIGURE_COVERAGE, TYPE } from "@/lib/compose/constants";
import { cell, fitText, linesFrom, polyline, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type LetteredTechnique = { acronym: string; items: Item[] };

const STROKE = 4;

/**
 * An acronym, and what each letter stands for.
 *
 * ⚠ `parse` CHECKS THE LETTERS AGAINST THE ACRONYM, IN ORDER — the same check
 * the database makes. A RAIN whose items run R, I, A, N is a card that teaches
 * a mnemonic wrong, and it is the kind of wrong nobody catches in review
 * because each line is individually correct.
 *
 * ── ⚠ THE BRACE IS ON THE LEFT, AND THE FIRST VERSION PUT IT ON TOP ─────
 *
 * A horizontal bracket over the whole set, with the acronym beneath it, cost
 * 207px of the 575px content band before a single label was set — bracket,
 * clearance, acronym, clearance — and three rows then had 90px each where they
 * need 131 with their glosses. The archetype could not be composed at any
 * figure scale and at any content length: the suite reported it as "does not
 * fit, break to a carousel", which was true and useless.
 *
 * A vertical brace in a 40px gutter costs 40px of WIDTH, which this card has,
 * and none of the height, which it does not.
 */
export const letteredTechnique: ArchetypeModule<LetteredTechnique> = {
  key: "lettered_technique",
  illustrationZone: "content",
  tintCount: 3,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p.acronym !== "string") return null;
    const acronym = p.acronym;
    if (acronym.length < 3 || acronym.length > 5) return null;
    const items = parseItems(p.items, 3, 5);
    if (!items || items.length !== acronym.length) return null;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].label.charAt(0).toUpperCase() !== acronym.charAt(i).toUpperCase()) return null;
    }
    return { acronym, items };
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];

    const acroRange = { min: TYPE.mono.min, max: Math.min(TYPE.mono.max, secondaryMax), floor: TYPE.mono.floor };
    if (acroRange.max < acroRange.floor) return null;
    const acroFit = fitText(payload.acronym, "mono", content.w * 0.5, TYPE.mono.max * 1.4, acroRange);
    if (!acroFit) return null;

    // The acronym sits at the top of the content band, on paper.
    placed.push({
      role: "text",
      band: "content",
      box: { x: content.x, y: content.y, w: content.w, h: acroFit.height },
      lines: linesFrom(acroFit, content.x, content.y, content.w, "mono", 500, palette.ink, "start"),
    });

    const braceW = round2(content.w * FIGURE_COVERAGE.min * figureScale * 0.18);
    if (braceW < 16) return null;

    const cellsBox = {
      x: round2(content.x + braceW + CLEARANCE.fieldToField),
      y: round2(content.y + acroFit.height + CLEARANCE.fieldToField),
      w: round2(content.w - braceW - CLEARANCE.fieldToField),
      h: round2(content.h - acroFit.height - CLEARANCE.fieldToField),
    };
    if (cellsBox.w < 300 || cellsBox.h <= 0) return null;

    // The brace spans exactly the rows it groups, and starts a full
    // `glyphToStroke` below the acronym's box — it is a drawn stroke and the
    // acronym is a glyph, so that is the clearance that applies.
    const half = STROKE / 2;
    const braceTop = round2(cellsBox.y + half);
    const braceBottom = round2(cellsBox.y + cellsBox.h - half);
    if (braceTop - (content.y + acroFit.height) < CLEARANCE.glyphToStroke) return null;

    const bx = round2(content.x + braceW);
    placed.push({
      role: "figure",
      band: "content",
      box: { x: content.x, y: braceTop, w: braceW, h: round2(braceBottom - braceTop) },
      strokes: [
        polyline(
          [
            [bx, braceTop],
            [content.x, braceTop],
            [content.x, braceBottom],
            [bx, braceBottom],
          ],
          palette.ink,
          STROKE
        ),
      ],
    });

    const boxes = rows(cellsBox, payload.items.length);
    for (let i = 0; i < payload.items.length; i += 1) {
      const built = cell("content", boxes[i], payload.items[i].label, payload.items[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
