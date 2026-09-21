import { CLEARANCE, figureShare } from "@/lib/compose/constants";
import { cell, circle, columns } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { seated } from "@/lib/compose/illustrations";
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
    const size = round2(Math.min(content.w, content.h * figureShare(figureScale)));
    if (size < 190) return null;

    const cx = round2(content.x + content.w / 2);
    const cy = round2(content.y + size / 2);
    const strokes: Stroke[] = [];

    // Outermost ring first, so ring i of the payload is ring i on the card.
    /*
     * ⚠ LES RAYONS NE DESCENDENT PAS JUSQU'À ZÉRO. Le pas valait `i / n`, ce
     * qui laissait à l'anneau intérieur `1/n` du rayon — 17 % pour trois
     * anneaux. La silhouette au centre n'avait alors que 58px de diamètre et
     * le garde-fou `inner >= 44` la laissait passer, illisible.
     *
     * Le pas est maintenant `0.72 / n` : les anneaux restent nettement
     * distincts et le plus petit garde plus de la moitié du rayon.
     */
    for (let i = 0; i < payload.rings.length; i += 1) {
      const r = round2((size / 2) * (1 - (i * 0.72) / payload.rings.length));
      if (r < 12) return null;
      strokes.push(circle(cx, cy, r, palette.ink, 4));
    }

    /*
     * ⚠ DES ANNEAUX VIDES NE DISENT PAS QUI EST AU CENTRE. Le sujet de cette
     * carte est ce qui reste à soi quand le reste échappe ; la silhouette
     * assise au milieu est ce « soi », et sans elle les anneaux sont une
     * cible.
     */
    const inner = round2((size / 2) * (1 - ((payload.rings.length - 1) * 0.72) / payload.rings.length));
    if (inner >= 60) {
      strokes.push(
        ...seated({ x: round2(cx - inner * 0.62), y: round2(cy - inner * 0.62), w: round2(inner * 1.24), h: round2(inner * 1.24) },
          palette.ink, 3)
      );
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

    /*
     * ⚠ EN COLONNES : DE L'EXTÉRIEUR VERS L'INTÉRIEUR, DE GAUCHE À DROITE.
     * Empilés, les deux à quatre anneaux nommés coûtaient `n × 153px` et les
     * cercles retombaient à 236px — une cible de la taille d'un timbre au
     * milieu d'une carte de 1080. En colonnes la liste coûte une hauteur de
     * cellule quel que soit `n`, et l'ordre de lecture reste celui du dessin.
     */
    const boxes = columns(listBox, payload.rings.length);
    for (let i = 0; i < payload.rings.length; i += 1) {
      const built = cell("content", boxes[i], payload.rings[i].label, payload.rings[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }
    return placed;
  },
};
