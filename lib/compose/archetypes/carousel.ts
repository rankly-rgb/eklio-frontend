import type { Placed } from "@/lib/compose/types";
import type { ArchetypeModule } from "@/lib/compose/archetypes/types";

export type CarouselCard = { archetype_key: string; payload: unknown };
export type Carousel = { cards: CarouselCard[] };

/**
 * Three to eight cards in a row.
 *
 * ⚠ A CAROUSEL IS NOT A LAYOUT, IT IS A CARD COUNT — which is why `compose`
 * here returns nothing and the engine renders each card through its own
 * archetype. It is in the catalogue anyway, and it has to be, because it is
 * where the overflow resolver lands: when an illustration has been shrunk and
 * the words have been cut and it still does not fit, the answer is more cards,
 * and something has to be able to name that answer.
 *
 * ⚠ AND A CAROUSEL MAY NOT CONTAIN ONE. `parse` refuses it, as the database
 * does — without that the recursion has no floor, and a carousel inside a
 * carousel is not a thing anybody meant.
 */
export const carousel: ArchetypeModule<Carousel> = {
  key: "carousel",
  illustrationZone: "none",
  tintCount: 0,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || !Array.isArray(p.cards)) return null;
    if (p.cards.length < 3 || p.cards.length > 8) return null;

    const cards: CarouselCard[] = [];
    for (const raw of p.cards) {
      const c = raw as Record<string, unknown> | null;
      if (!c || typeof c.archetype_key !== "string") return null;
      if (c.archetype_key === "carousel") return null;
      cards.push({ archetype_key: c.archetype_key, payload: c.payload });
    }
    return { cards };
  },

  compose(): Placed[] {
    // Rendered card by card by `renderCarousel`; nothing composes at this level.
    return [];
  },
};
