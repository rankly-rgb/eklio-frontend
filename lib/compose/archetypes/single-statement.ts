import { round2 } from "@/lib/compose/measure";
import { mark } from "@/lib/compose/illustrations";
import type { ArchetypeModule } from "@/lib/compose/archetypes/types";
import type { Placed } from "@/lib/compose/types";

export type SingleStatement = { statement: string };

/**
 * One sentence, set large, on paper.
 *
 * ⚠ NO ILLUSTRATION AT ALL, and that is the archetype rather than a gap in it.
 * A drawing beside a single sentence is a drawing competing with it; the whole
 * point of this card is that there is one thing on it.
 */
export const singleStatement: ArchetypeModule<SingleStatement> = {
  key: "single_statement",
  illustrationZone: "none",
  tintCount: 0,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p.statement !== "string") return null;
    return { statement: p.statement };
  },

  // The card's display line IS the statement. Taking a separate headline would
  // put two sentences of equal weight on a card whose rule is that it has one.
  displayText: (p) => p.statement,

  /*
   * ⚠ UNE BANDE DE CONTENU VIDE ÉTAIT « LA BONNE RÉPONSE », ET ELLE NE L'EST
   * PLUS. La phrase reste tout ce que la carte dit — mais une carte qui ne
   * porte QUE du texte, au milieu d'un mois de diagrammes, se lit comme une
   * carte inachevée. La spécification validée demande « une petite marque
   * dessinée ».
   *
   * Elle est posée en haut de la bande de contenu, sous la phrase, et elle ne
   * prétend rien illustrer : c'est la respiration qui dit que la phrase
   * s'arrête là.
   */
  compose({ palette, content, draw, illustrated, accent }) {
    const y = round2(content.y + 28);
    const box = { x: content.x, y: round2(y - 12), w: round2(Math.min(content.w, 220)), h: 24 };
    /*
     * ⚠ UN ACCENT DESSINÉ À LA PLACE DU MÊME TRAIT (2026-11-01). Chaque phrase
     * seule portait la même courbe de 220px ; avec un dessin de la
     * bibliothèque, elle prend un accent du pack (soulignement, vague,
     * pointillés), dans la même boîte.
     */
    const strokes = accent ? accent({ ...box, y: round2(y - 20), h: 40 }, palette.ink) : mark({ ...box, y }, palette.ink);
    const placed: Placed[] = [{ role: "figure", band: "content", box: accent ? { ...box, y: round2(y - 20), h: 40 } : box, strokes }];
    /*
     * ⚠ UNE PHRASE SEULE PORTE SON DESSIN (2026-11-01). Sans lui, c'était la
     * carte « titre et un trait » — sept sur trente en décembre, la première
     * chose qui se voit dans la grille. Il est posé sous la phrase, à droite,
     * dans ce qui reste de la bande de contenu.
     */
    if (illustrated) {
      const top = round2(content.y + 28 + 12 + 40);
      const side = round2(Math.min(content.y + content.h - top, content.w * 0.5, 420));
      if (side < 160) return null;
      const spot = { x: round2(content.x + content.w - side), y: round2(content.y + content.h - side), w: side, h: side };
      placed.push({ role: "figure", band: "content", box: spot, strokes: draw(spot, palette.ink) });
    }
    return placed;
  },
};
