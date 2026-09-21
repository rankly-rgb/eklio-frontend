import { CLEARANCE, figureShare } from "@/lib/compose/constants";
import { cell } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { surfacing } from "@/lib/compose/illustrations";
import type { Placed } from "@/lib/compose/types";
import { parseItem, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type SurfaceAndBeneath = { surface: Item; beneath: Item };

/*
 * Ce qui se dit, et ce qu'il y a dessous.
 *
 * ⚠ LE TRAIT N'ÉTAIT PAS UNE ILLUSTRATION, ET IL A FINI PAR DÉFINIR LE
 * PRODUIT. Cette carte portait une ligne horizontale entre deux aplats, avec
 * un commentaire qui disait que « la distance EST l'illustration ». C'était
 * vrai comme intention et faux comme dessin : une ligne ne dit rien de ce qui
 * se passe sous la surface.
 *
 * Et comme le repli envoyait ici tout ce qui ne tenait pas ailleurs, un mois
 * entier a fini en « deux boîtes séparées par un trait » — neuf cartes sur
 * trente le 2026-09-21b.
 *
 * Le trait est devenu une LIGNE D'EAU que la forme traverse : un arc net
 * au-dessus, une masse deux fois plus profonde en dessous. C'est le sujet de
 * la carte, dessiné.
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

    /*
     * ⚠ LA BANDE DU DESSIN EST UNE VRAIE SURFACE, pas un interstice. Elle
     * prend sa part de la bande de contenu — entre 25 et 45 %, la règle de
     * `FIGURE_COVERAGE` — et `figureScale` la réduit comme n'importe quelle
     * illustration quand la place manque.
     */
    const drawH = round2(content.h * figureShare(figureScale));
    const gap = CLEARANCE.fieldToField;
    const half = round2((content.h - drawH - gap * 2) / 2);
    if (half < 120 || drawH < 90) return null;

    const top = { x: content.x, y: content.y, w: content.w, h: half };
    /*
     * ⚠ NI TOUTE LA LARGEUR NI UNE FRACTION FIXE : UNE PROPORTION.
     *
     * Confinée à 64 % de la largeur, la forme rapetissait deux fois — une fois
     * par la boîte, une fois par son propre calcul de rayon. Lâchée sur la
     * bande entière, elle faisait l'inverse : dans une boîte de 936 × 236, la
     * masse immergée s'étalait sur 510px pour 132 de haut et se lisait comme
     * une soucoupe posée sur un trait.
     *
     * La ligne d'eau court sur toute la bande — c'est une surface, elle n'a
     * pas de raison de s'arrêter — mais la forme qui la traverse tient dans
     * une boîte au plus deux fois et demie plus large que haute.
     */
    const drawW = round2(Math.min(content.w, drawH * 2.5));
    const draw = {
      x: round2(content.x + (content.w - drawW) / 2),
      y: round2(content.y + half + gap),
      w: drawW,
      h: drawH,
    };
    const bottom = { x: content.x, y: round2(draw.y + drawH + gap), w: content.w, h: half };

    const a = cell("content", top, payload.surface.label, payload.surface.gloss, palette, 0, secondaryMax);
    const b = cell("content", bottom, payload.beneath.label, payload.beneath.gloss, palette, 1, secondaryMax);
    if (!a || !b) return null;

    placed.push(...a);
    placed.push({ role: "figure", band: "content", box: draw, strokes: surfacing(draw, palette.ink) });
    placed.push(...b);
    return placed;
  },
};
