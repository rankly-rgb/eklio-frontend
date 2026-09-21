import { round2 } from "@/lib/compose/measure";
import { mark } from "@/lib/compose/illustrations";
import type { ArchetypeModule } from "@/lib/compose/archetypes/types";

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
  compose({ palette, content }) {
    const y = round2(content.y + 28);
    const box = { x: content.x, y: round2(y - 12), w: round2(Math.min(content.w, 220)), h: 24 };
    return [{ role: "figure", band: "content", box, strokes: mark({ ...box, y }, palette.ink) }];
  },
};
