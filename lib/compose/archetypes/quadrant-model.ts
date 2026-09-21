import { CLEARANCE, figureShare, TYPE } from "@/lib/compose/constants";
import { cell, columns, fitText, linesFrom, rows } from "@/lib/compose/layout";
import { profile } from "@/lib/compose/illustrations";
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
    const stripH = round2(content.h * figureShare(figureScale));
    if (stripH < 150) return null;

    const strip = { x: content.x, y: content.y, w: content.w, h: stripH };
    const cx = round2(strip.x + strip.w / 2);
    const cy = round2(strip.y + strip.h / 2);

    /*
     * ⚠ LA CROIX N'ÉTAIT PAS UNE ILLUSTRATION, ET LES QUATRE CASES DISAIENT
     * DÉJÀ CE QU'ELLE DISAIT. Deux segments perpendiculaires au-dessus d'une
     * grille 2×2 répètent la grille : c'est de l'échafaudage, et la
     * spécification le nomme — « un cercle vide n'est pas une illustration ».
     *
     * Un modèle en quatre cases décrit ce qui se passe dans une tête. La tête
     * de profil, ouverte à l'arrière, est ce sujet dessiné ; les deux axes
     * restent NOMMÉS, à gauche et au-dessus, puisque ce sont eux qui disent
     * comment lire la grille.
     */
    const half = STROKE / 2;
    const headW = round2(Math.min(strip.w * 0.42, strip.h * 0.92));
    const head = {
      x: round2(cx - headW / 2),
      y: round2(cy - headW / 2),
      w: headW,
      h: headW,
    };
    placed.push({
      role: "figure",
      band: "content",
      box: head,
      strokes: profile(head, palette.ink, STROKE),
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
        // Le nom de l'axe horizontal, à droite du profil, à hauteur d'yeux.
        ...linesFrom(
          xFit,
          round2(head.x + head.w + half + CLEARANCE.glyphToStroke),
          round2(cy - xFit.size * 0.6),
          strip.w * 0.3, "mono", 500, palette.ink, "start"
        ),
        // Celui de l'axe vertical en haut à gauche, du même côté que la
        // grille qu'il ordonne, et dégagé du tracé du profil.
        ...linesFrom(
          yFit,
          strip.x,
          strip.y,
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
