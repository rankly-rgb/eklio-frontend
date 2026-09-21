import { CLEARANCE } from "@/lib/compose/constants";
import { cell, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type ComparisonPair = { left: Item[]; right: Item[] };

/**
 * Two columns of bubbles, facing each other.
 *
 * ⚠ THE TWO SIDES CARRY THE SAME NUMBER OF ROWS, enforced in `parse` as it is
 * in the database. A comparison whose left column has one more line than its
 * right reads as an imbalance rather than as a contrast, and no amount of
 * layout fixes that — the copy is what is wrong.
 *
 * ── ⚠ DEUX BULLES VIDES À CÔTÉ DU TEXTE NE SONT PAS UNE ILLUSTRATION ────
 *
 * Cette carte a porté successivement deux non-illustrations. D'abord une règle
 * verticale entre les colonnes — qui dit « ces deux choses sont séparées », ce
 * que l'écart de 48px dit déjà. Puis, en correction, deux bulles DESSINÉES
 * AU-DESSUS des colonnes : un contrôle indépendant du mois rendu les a notées
 * 2 sur 5, « de grandes boîtes arrondies vides, de la décoration », et la
 * spécification le dit elle-même — « un cercle vide n'est pas une
 * illustration ».
 *
 * Les deux versions faisaient la même erreur : mettre la forme À CÔTÉ de ce
 * qu'elle était censée porter. Une bulle veut dire « quelqu'un dit ceci » ;
 * vide, elle ne dit rien, et elle coûtait 30 % de la bande — assez pour que le
 * résolveur supprime les gloses des quatre champs, ce que le même contrôle a
 * relevé à part.
 *
 * Le champ teinté EST la bulle. Elle porte le texte, les queues des deux
 * premières se font face, et la bande entière revient aux cellules.
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

  compose({ payload, palette, content, secondaryMax }) {
    const placed: Placed[] = [];
    const gap = CLEARANCE.fieldToField;
    const colW = round2((content.w - gap) / 2);
    if (colW < 220) return null;

    const leftCol = { x: content.x, y: content.y, w: colW, h: content.h };
    const rightCol = { x: round2(content.x + colW + gap), y: content.y, w: colW, h: content.h };

    const leftBoxes = rows(leftCol, payload.left.length);
    const rightBoxes = rows(rightCol, payload.right.length);

    for (let i = 0; i < payload.left.length; i += 1) {
      /*
       * ⚠ LA QUEUE N'EST QUE SUR LA PREMIÈRE LIGNE DE CHAQUE COLONNE. Quatre
       * bulles à queue empilées se lisent comme quatre personnes qui parlent
       * en même temps ; deux qui se font face, suivies de ce qui en découle,
       * se lisent comme la comparaison que la carte fait.
       */
      const a = cell(
        "content", leftBoxes[i], payload.left[i].label, payload.left[i].gloss,
        palette, 0, secondaryMax, i === 0 ? "right" : undefined
      );
      const b = cell(
        "content", rightBoxes[i], payload.right[i].label, payload.right[i].gloss,
        palette, 1, secondaryMax, i === 0 ? "left" : undefined
      );
      if (!a || !b) return null;
      placed.push(...a, ...b);
    }
    return placed;
  },
};
