import { CLEARANCE, figureShare } from "@/lib/compose/constants";
import { cell, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { bubble } from "@/lib/compose/illustrations";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type ComparisonPair = { left: Item[]; right: Item[] };

/**
 * Two columns, the same height, under two bubbles that face each other.
 *
 * ⚠ THE TWO SIDES CARRY THE SAME NUMBER OF ROWS, enforced in `parse` as it is
 * in the database. A comparison whose left column has one more line than its
 * right reads as an imbalance rather than as a contrast, and no amount of
 * layout fixes that — the copy is what is wrong.
 *
 * ── ⚠ ET LE TRAIT VERTICAL N'A JAMAIS ÉTÉ UNE ILLUSTRATION ──────────────
 *
 * Cette carte portait une règle verticale entre les deux colonnes, et rien
 * d'autre. Une règle dit « ces deux choses sont séparées », ce que l'écart de
 * 48px dit déjà ; elle ne dit pas ce que la carte compare. Sur la planche du
 * mois rendu, c'est l'une des cartes qui se lisait comme « deux boîtes
 * séparées par un trait », et c'était exact.
 *
 * Deux bulles qui se font face, en haut de la bande, disent le sujet : la même
 * situation, énoncée de deux façons. Elles sont l'illustration, elles prennent
 * leur part de la bande, et le trait a disparu parce qu'il ne manquait à
 * personne.
 */
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
    const gap = CLEARANCE.fieldToField;
    const colW = round2((content.w - gap) / 2);
    if (colW < 220) return null;

    /*
     * La bande du haut : deux bulles, tournées l'une vers l'autre. La queue
     * compte dans la hauteur — `bubble` la trace SOUS la boîte qu'on lui donne
     * — donc la boîte des bulles vaut la bande moins ce que la queue descend.
     */
    const stripH = round2(content.h * figureShare(figureScale));
    if (stripH < 130) return null;
    const bubbleH = round2(stripH / 1.16);
    const bubbleW = round2(Math.min(colW, bubbleH * 1.9));

    const strip = { x: content.x, y: content.y, w: content.w, h: stripH };
    const leftBubble = {
      x: round2(content.x + (colW - bubbleW) / 2),
      y: content.y,
      w: bubbleW,
      h: bubbleH,
    };
    const rightBubble = {
      x: round2(content.x + colW + gap + (colW - bubbleW) / 2),
      y: content.y,
      w: bubbleW,
      h: bubbleH,
    };
    placed.push({
      role: "figure",
      band: "content",
      box: strip,
      /*
       * ⚠ LES QUEUES SE TOURNENT L'UNE VERS L'AUTRE. Pointées vers
       * l'extérieur, les deux bulles regardaient hors de la carte et se
       * lisaient comme deux formes posées côte à côte. Tournées vers le
       * centre, elles se répondent — c'est ce que la carte compare.
       */
      strokes: [
        ...bubble(leftBubble, palette.ink, false),
        ...bubble(rightBubble, palette.ink, true),
      ],
    });

    const below = {
      y: round2(content.y + stripH + CLEARANCE.fieldToField),
      h: round2(content.h - stripH - CLEARANCE.fieldToField),
    };
    if (below.h <= 0) return null;

    const leftCol = { x: content.x, y: below.y, w: colW, h: below.h };
    const rightCol = { x: round2(content.x + colW + gap), y: below.y, w: colW, h: below.h };

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
