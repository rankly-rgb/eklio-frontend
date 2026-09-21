import { describe, expect, it } from "vitest";
import { composeWithFallback } from "@/lib/compose/fallback";
import { TYPE } from "@/lib/compose/constants";
import { CompositionError, render, violations, legibleAtThumb } from "@/lib/compose/engine";
import { parseBoxes } from "@/lib/compose/svg";
import { CARD, PALETTES } from "@/lib/compose/__tests__/fixtures";

/*
 * ── THE RESOLUTION ORDER, MEASURED ──────────────────────────────────────
 *
 *   1. shrink the illustration
 *   2. cut words
 *   3. break to a carousel
 *
 * and never, at any step, set the body below a floor. This file exercises all
 * three steps on content that genuinely needs them, rather than trusting the
 * order because it is written down.
 */

const item = (label: string) => ({ label, gloss: "a gloss of exactly six words" });

/*
 * ⚠ TWO HEADLINES, AND THE DIFFERENCE BETWEEN THEM IS THE POINT.
 *
 * The display line is set FIRST, from the space, and everything else is capped
 * at a third of it — so a long headline that wraps to three lines takes room
 * the diagram then does not have. That is not a bug in the resolver, it is the
 * resolver's input, and the two cases below show it working both ways: with
 * room, the glosses survive and only the illustration gives; without, the
 * glosses go next. Either way nothing is set below a floor.
 */
const SHORT = { ...CARD, headline: "Where it lands" };
const LONG = CARD;

/*
 * ── ⚠ CE QUE LE CONTRÔLE DE VIGNETTE A CHANGÉ ICI, ET POURQUOI ──────────
 *
 * L'ordre du résolveur est intact : toutes les échelles d'illustration sont
 * essayées AVANT que les glosses tombent, et c'est toujours vrai. Ce qui a
 * changé est le verdict, pas l'ordre.
 *
 * Une glose se pose en `mono`, dont le maximum est 28px. Le plancher de
 * lisibilité en vignette est 34px (= 11px à 350). **Aucune glose ne peut donc
 * jamais le franchir.** La passe « full » est essayée, refusée pour cette
 * raison-là, et la passe sans glosses gagne — sur un diagramme, toujours.
 *
 * C'est une décision de produit, et elle est réversible en un nombre :
 * `THUMB.minPx`. Tant qu'il vaut 11, un diagramme porte des libellés et pas
 * de glosses. L'alternative serait de relever `TYPE.mono.max` au-dessus de
 * 34, ce qui remonterait le titre au-dessus de 102px partout par la règle du
 * ratio — c'est-à-dire de changer la hiérarchie de toutes les cartes.
 */
describe("step 1 — the illustration shrinks before anything else moves", () => {
  it("three rings compose by shrinking the drawing, and the glosses go with it", () => {
    const { composition, svg } = render({
      ...SHORT,
      archetype: "concentric_control",
      palette: PALETTES[0],
      payload: { rings: [item("Out there"), item("Nearer"), item("Right here")] },
    });

    // Les deux marches ont joué, et dans cet ordre-là.
    expect(composition.resolution.some((r) => r.startsWith("illustration shrunk"))).toBe(true);
    expect(composition.resolution).toContain("cut words: glosses dropped");

    // Anti-vacuité : les trois libellés sont là, et ils sont lisibles à 350.
    const texts = parseBoxes(svg).filter((b) => b.role === "text");
    expect(texts.length).toBeGreaterThanOrEqual(5);
    expect(legibleAtThumb(composition.placed)).toBe(true);
  });

  /*
   * ⚠ « RIEN NE CÈDE » N'EXISTE PLUS POUR UN DIAGRAMME GLOSÉ, et le dire est
   * l'intérêt de ce cas. La seule forme où le résolveur ne touche à rien est
   * celle qui n'a pas de glose à perdre.
   */
  it("a card with nothing to give up gives up nothing", () => {
    const { composition } = render({
      ...SHORT,
      archetype: "practitioner_card",
      palette: PALETTES[0],
      payload: { lines: ["EMDR for burnout", "Oakland, California", "Taking new clients"] },
    });
    expect(composition.resolution).toEqual([]);
    expect(legibleAtThumb(composition.placed)).toBe(true);
  });
});

describe("step 2 — words are cut before the card is given up on", () => {
  it("four strategies under a three-line headline drop their glosses, not their size", () => {
    const { composition, svg } = render({
      ...LONG,
      archetype: "numbered_strategies",
      palette: PALETTES[0],
      payload: { items: ["Notice", "Name it", "Let go", "Ask once"].map(item) },
    });
    expect(composition.resolution).toContain("cut words: glosses dropped");

    // ⚠ AND NOTHING WENT UNDER A FLOOR TO GET THERE. This is the assertion
    // that makes step 2 meaningful: without it, "cut words" and "set it
    // smaller" are indistinguishable from the outside.
    for (const b of parseBoxes(svg).filter((t) => t.role === "text")) {
      expect(b.size!).toBeGreaterThanOrEqual(Math.min(TYPE.label.floor, TYPE.mono.floor));
    }
  });
});

describe("step 3 — a card that cannot be composed says so", () => {
  it("six nodes with glosses is refused, and the message names the remedy", () => {
    expect(() =>
      render({
        ...CARD,
        archetype: "cycle",
        palette: PALETTES[0],
        payload: {
          nodes: ["Notice", "Name it", "Let go", "Ask once", "Begin again", "Close it"].map(item),
        },
      })
    ).toThrow(CompositionError);

    try {
      render({
        ...CARD,
        archetype: "cycle",
        palette: PALETTES[0],
        payload: {
          nodes: ["Notice", "Name it", "Let go", "Ask once", "Begin again", "Close it"].map(item),
        },
      });
    } catch (e) {
      // It does not fail silently, and it does not fail obscurely: the caller
      // is told which of the three steps is left.
      expect((e as Error).message).toMatch(/carousel/);
      expect((e as Error).message).toMatch(/floors/);
    }
  });
});

describe("the engine enforces the clearances itself", () => {
  /*
   * ⚠ NOT ONLY THE SUITE. A constraint that only a test enforces holds until
   * somebody renders something the test did not think of — which is every
   * caption a model writes after today.
   */
  /*
   * ⚠ PAR LE REPLI, ET C'EST LE BON ENDROIT. `quadrant_model` porte QUATRE
   * cases plus deux axes, par définition — il ne peut pas en porter moins, et
   * mesuré le 2026-09-21 il se pose à 28px, soit 9,1px en vignette, quelle que
   * soit la longueur du titre. Il se replie donc toujours.
   *
   * Ce que ce cas doit prouver n'a pas changé : ce qui SORT du moteur est
   * propre. Le demander à la forme que le produit livre vraiment est plus
   * fort que le demander à la première forme essayée.
   */
  it("violations() is consulted on every render, so a violating layout is never emitted", () => {
    const composed = composeWithFallback({
      ...SHORT,
      archetype: "quadrant_model",
      palette: PALETTES[0],
      payload: {
        axis_x: "Effort here",
        axis_y: "Relief here",
        items: [item("Notice"), item("Name it"), item("Let go"), item("Ask once")],
      },
    });
    const placed =
      composed.kind === "carousel"
        ? composed.slides.flatMap((slide) => slide.composition.placed)
        : composed.result.composition.placed;
    expect(violations(placed)).toEqual([]);
    expect(composed.steps.length).toBeGreaterThan(0);
  });

  it("violations() can actually report one", () => {
    // Anti-vacuity: two fields 10px apart must be reported.
    const near = violations([
      { role: "field", band: "content", box: { x: 0, y: 0, w: 100, h: 100 }, fill: "#000", radius: 0 },
      { role: "field", band: "content", box: { x: 110, y: 0, w: 100, h: 100 }, fill: "#000", radius: 0 },
    ]);
    expect(near.some((v) => v.kind === "fieldToField")).toBe(true);
  });
});
