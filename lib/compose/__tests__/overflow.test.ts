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
 * ── ⚠ CE BLOC DISAIT L'INVERSE DE CE QUE LE MOTEUR FAIT, ET IL LE DISAIT
 *      AVEC UN CHIFFRE, CE QUI EST LA FAÇON LA PLUS CONVAINCANTE DE SE
 *      TROMPER ─────────────────────────────────────────────────────────────
 *
 * Il concluait : « Tant que `THUMB.minPx` vaut 11, un diagramme porte des
 * libellés et pas de glosses. » Le raisonnement était juste et sa prémisse
 * fausse — il supposait qu'une glose se pose en `mono`, plafonné à 28px, donc
 * toujours sous le plancher de vignette.
 *
 * La glose est composée dans la sans du kit depuis toujours ; elle empruntait
 * seulement les TAILLES du mono. Elle a maintenant sa propre gamme,
 * `TYPE.gloss` (30 à 40, plancher 30), et le plancher de vignette se mesure à
 * 390px de large — d'où `CONTENT_MIN_AT_CANVAS = 30`. Une glose le franchit
 * donc exactement, par construction.
 *
 * Ce que ce fichier vérifie n'a pas changé : l'ordre du résolveur — rétrécir
 * le dessin, puis couper des mots, puis rompre en carrousel — et le fait que
 * rien ne passe jamais sous un plancher. Ce qui a changé est le verdict : sur
 * un diagramme qui a la place, les gloses RESTENT.
 */
describe("step 1 — the illustration shrinks before anything else moves", () => {
  /*
   * ⚠ CE CAS EXIGEAIT QUE LE DESSIN AIT RÉTRÉCI, ET IL N'A PLUS À LE FAIRE.
   *
   * Les trois anneaux nommés se lisaient en LIGNES : ils coûtaient trois
   * hauteurs de cellule, et les cercles ne tenaient qu'en descendant d'un cran
   * — d'où l'assertion. Nommés en COLONNES, ils en coûtent une seule, et la
   * carte compose au HAUT de la fourchette de couverture avec toutes ses
   * gloses.
   *
   * Exiger encore le rétrécissement reviendrait à exiger le symptôme après
   * avoir soigné la cause. Ce que ce cas doit tenir est le RÉSULTAT — les mots
   * survivent, rien n'est sous le plancher — et l'ORDRE du résolveur est
   * vérifié juste en dessous, sur une carte qui a vraiment besoin de céder.
   */
  it("three rings compose with every gloss intact, and nothing under a floor", () => {
    const { composition, svg } = render({
      ...SHORT,
      archetype: "concentric_control",
      palette: PALETTES[0],
      payload: { rings: [item("Out there"), item("Nearer"), item("Right here")] },
    });

    // Les mots n'ont pas cédé.
    expect(composition.resolution).not.toContain("cut words: glosses dropped");

    // Anti-vacuité : trois libellés ET trois gloses sont sur la carte, et
    // tout est lisible sur un post pleine largeur de téléphone.
    const texts = parseBoxes(svg).filter((b) => b.role === "text");
    expect(texts.length).toBeGreaterThanOrEqual(8);
    expect(legibleAtThumb(composition.placed)).toBe(true);
  });

  it("le dessin cède avant les mots, là où quelque chose doit céder", () => {
    /*
     * Quatre cases glosées sous un profil : c'est la carte qui manque
     * vraiment de hauteur. Le résolveur descend l'illustration et s'arrête là
     * — il ne touche pas aux gloses tant qu'un cran reste à essayer.
     */
    const { composition } = render({
      ...SHORT,
      archetype: "quadrant_model",
      palette: PALETTES[0],
      payload: {
        axis_x: "Effort here",
        axis_y: "Relief here",
        items: [item("Out there"), item("Nearer"), item("Right here"), item("Inside")],
      },
    });
    expect(composition.resolution.some((r) => r.startsWith("illustration shrunk"))).toBe(true);
    expect(composition.resolution).not.toContain("cut words: glosses dropped");
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
   * ⚠ PAR LE REPLI, PARCE QUE C'EST CE QUI SORT. `quadrant_model` porte quatre
   * cases plus deux axes ; selon la longueur du titre il compose ou il se
   * replie. Ce que ce cas doit prouver ne dépend pas de la branche prise :
   * ce qui SORT du moteur est propre. Le demander à la forme réellement
   * livrée est plus fort que le demander à la première essayée.
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
