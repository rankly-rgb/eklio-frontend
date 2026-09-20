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

  compose() {
    // Everything this archetype has is in the display line, which the engine
    // sets in the headline band. An empty content band is the correct answer,
    // not an omission — and returning `[]` says so, where returning `null`
    // would tell the resolver the card did not fit.
    return [];
  },
};
