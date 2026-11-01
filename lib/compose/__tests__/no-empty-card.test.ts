import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { composeWithFallback } from "@/lib/compose/fallback";
import { cardPalette } from "@/lib/compose/palette";
import { cardHasVisual } from "@/lib/compose/library";
import type { RenderInput } from "@/lib/compose/types";

/*
 * ZÉRO CARTE VIDE (2026-11-01). Une carte composée porte une illustration de la
 * bibliothèque, une forme, ou un fond photographique — lu dans le SVG livré.
 * Décembre 2026 en livrait sept sur trente qui ne portaient qu'un titre et un
 * trait. Le cas est provoqué ici, pas supposé.
 */
const DIRECTION = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const base: RenderInput = {
  archetype: "single_statement",
  payload: { statement: "Old rules can linger long after the room has changed." },
  palette: cardPalette("card-1", DIRECTION, false),
  eyebrow: "BEHIND THE PRACTICE",
  headline: "Old rules can linger",
  footer: "Ember consulting · LMFT 123456",
};

describe("le contrôle voit une carte vide", () => {
  it("provoqué : la couverture d'un carrousel rendue comme une carte ne porte rien — le contrôle la refuse", () => {
    const cover = render({
      ...base,
      archetype: "carousel",
      payload: { cards: [1, 2, 3].map((i) => ({ archetype_key: "single_statement", payload: { statement: `Idea number ${i} stays short.` } })) },
    }).svg;
    expect(cardHasVisual(cover)).toBe(false);
  });

  it("un titre et un trait ne suffisent pas, un dessin de la bibliothèque oui", () => {
    expect(cardHasVisual('<svg><text>Title</text><path d="M0 0L10 0"/></svg>')).toBe(false);
    expect(cardHasVisual(render({ ...base, illustration: "ground-anchor" }).svg)).toBe(true);
  });
});

describe("le repli ne livre jamais une carte vide à un post qui a un dessin", () => {
  it("le carrousel demandé sort en diapositives, chacune dessinée", () => {
    const composed = composeWithFallback({
      ...base,
      illustration: "ground-anchor",
      archetype: "carousel",
      payload: { cards: [1, 2, 3].map((i) => ({ archetype_key: "single_statement", payload: { statement: `Idea number ${i} stays short.` } })) },
    });
    expect(composed.kind).toBe("carousel");
    if (composed.kind !== "carousel") return;
    for (const slide of composed.slides) expect(cardHasVisual(slide.svg)).toBe(true);
  });

  it.each(["single_statement", "comparison_pair", "annotated_curve", "numbered_strategies"])(
    "%s : ce qui sort porte le dessin du post",
    (archetype) => {
      const payloads: Record<string, unknown> = {
        single_statement: base.payload,
        comparison_pair: { left: { label: "Before", gloss: "the old rule" }, right: { label: "After", gloss: "a new choice" } },
        annotated_curve: { points: [{ label: "Calm" }, { label: "Peak" }, { label: "Settle" }] },
        numbered_strategies: { items: [{ label: "Notice" }, { label: "Name" }, { label: "Test" }] },
      };
      const composed = composeWithFallback({ ...base, illustration: "ground-anchor", archetype, payload: payloads[archetype] });
      const svg = composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg;
      expect(svg).toContain('data-library="ground-anchor"');
    }
  );
});

describe("la couverture d'un carrousel n'est jamais livrée comme une carte", () => {
  /*
   * Décembre 2026 #8, écrit en production. Ses diapositives ne tiennent pas avec
   * le dessin ; la couverture vide, avec le décor, passait la non-vacuité, et le
   * repli livrait un « carrousel » que la carte gardée ne savait pas rendre.
   */
  const payload = {"cards": [{"payload": {"statement": "A changed plan can bring grief alongside the decisions waiting to be made."}, "archetype_key": "single_statement"}, {"payload": {"beneath": {"gloss": "loss, uncertainty, and change", "label": "What needs tending"}, "surface": {"gloss": "calls, forms, and logistics", "label": "What needs doing"}}, "archetype_key": "surface_and_beneath"}, {"payload": {"statement": "You do not have to finish the practical list before making room for what changed."}, "archetype_key": "single_statement"}]};

  it("refusé en diapositives, il ne revient pas en couverture", () => {
    let composed;
    try {
      composed = composeWithFallback({ ...base, illustration: "grief-folded-map", archetype: "carousel", payload }, "When the map changes");
    } catch {
      return; // refusé : le banc remplace le post
    }
    expect(composed.kind === "card" && composed.archetype === "carousel").toBe(false);
  });
});

