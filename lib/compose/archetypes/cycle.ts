import { CLEARANCE, figureShare } from "@/lib/compose/constants";
import { cell, rows } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { knot } from "@/lib/compose/illustrations";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type Cycle = { nodes: Item[] };

/** Toute épaisseur de trait sur cette carte, pour que le calcul de dégagement ait un seul nombre à lire. */
const STROKE = 4;

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

    /*
     * ⚠ EN GOUTTIÈRE, PAS EN BANDEAU — ET C'EST UNE MESURE QUI L'A DÉCIDÉ.
     *
     * Posé au-dessus de la liste, le dessin lui disputait la HAUTEUR, qui est
     * la seule chose dont cette carte manque. Trois nœuds glosés coûtent
     * 555px ; la bande en offre 637 ; une illustration au plancher de 25 %
     * en prend 159 plus 48 de dégagement. Il manquait 125px, et le résolveur
     * payait la différence de la seule façon qu'il connaît : en supprimant
     * les gloses des trois nœuds — exactement ce que le mois rendu montrait.
     *
     * Une gouttière coûte de la LARGEUR, que cette carte a. Le fil y descend
     * sur toute la hauteur — `knot` court sur le grand côté de sa boîte — et
     * les trois nœuds gardent leurs gloses.
     */
    const gutterW = round2(content.w * figureShare(figureScale));
    if (gutterW < 150) return null;

    /*
     * ⚠ RENTRÉ D'UNE DEMI-ÉPAISSEUR EN HAUT ET EN BAS. La boîte d'un tracé est
     * gonflée d'une demi-épaisseur de chaque côté — c'est ce qu'un lecteur
     * voit — donc un fil tracé jusqu'aux bords exacts de la bande a une boîte
     * qui les dépasse de 2px, et ces 2px tombent dans le dégagement de 64px du
     * pied de carte. La carte était refusée pour `aboveFooter@61.99`, une
     * mesure qui accuse le pied et vise le fil.
     */
    const half = STROKE / 2;
    const gutter = {
      x: content.x,
      y: round2(content.y + half),
      w: gutterW,
      h: round2(content.h - STROKE),
    };

    placed.push({
      role: "figure",
      band: "content",
      box: gutter,
      /*
       * ⚠ UN CERCLE FLÉCHÉ N'EST PAS UNE ILLUSTRATION DE LA RUMINATION.
       * C'en est le schéma : il dit « ça tourne » et rien d'autre. Le fil qui
       * revient sur lui-même et se serre dit ce que la carte raconte — une
       * pensée qui repasse au même endroit et ne se dénoue pas.
       */
      strokes: knot(gutter, palette.ink, STROKE),
    });

    const listBox = {
      x: round2(content.x + gutterW + CLEARANCE.fieldToField),
      y: content.y,
      w: round2(content.w - gutterW - CLEARANCE.fieldToField),
      h: content.h,
    };
    if (listBox.w < 340) return null;

    const boxes = rows(listBox, payload.nodes.length);
    for (let i = 0; i < payload.nodes.length; i += 1) {
      const built = cell("content", boxes[i], payload.nodes[i].label, payload.nodes[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
