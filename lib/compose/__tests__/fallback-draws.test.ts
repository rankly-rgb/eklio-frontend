import { describe, expect, it } from "vitest";
import { composeWithFallback } from "@/lib/compose/fallback";
import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { DRAWING_FOR } from "@/lib/compose/illustrations";
import { CARD, PALETTES } from "@/lib/compose/__tests__/fixtures";

/*
 * ── UN REPLI DESCEND VERS UNE FORME DESSINÉE, JAMAIS VERS DES BOÎTES ────
 *
 * ⚠ CE N'EST PAS UNE EXIGENCE ESTHÉTIQUE, C'EST CE QUI A VIDÉ UN MOIS. La
 * marche 1 du repli n'avait qu'une destination, `surface_and_beneath`, qui à
 * l'époque ne portait qu'un trait : neuf cartes sur trente y ont atterri et le
 * mois entier s'est lu comme « deux boîtes séparées par un trait ».
 *
 * Deux choses sont vérifiées ici, et la seconde est la vraie :
 *   — chaque destination du repli porte un dessin ;
 *   — la part de cartes finissant en phrase seule reste sous 40 %.
 */

const item = (label: string) => ({ label, gloss: "a gloss of exactly six words" });

/** Des charges utiles qui ne tiennent pas telles quelles, et doivent se replier. */
const TOO_MUCH: Array<[string, unknown]> = [
  ["cycle", { nodes: ["Notice", "Name it", "Let go", "Ask once", "Begin again", "Close it"].map(item) }],
  ["numbered_strategies", { items: ["Notice", "Name it", "Let go", "Ask once", "Stop"].map(item) }],
  ["concentric_control", { rings: ["Out there", "Nearer", "Closer in", "Right here"].map(item) }],
  [
    "quadrant_model",
    {
      axis_x: "Effort here",
      axis_y: "Relief here",
      items: ["Sunday dread", "Rest fails", "Still bracing", "Sleep breaks"].map(item),
    },
  ],
  [
    "comparison_pair",
    {
      left: ["Looks fine", "Sounds steady", "Shows up", "Answers fast"].map(item),
      right: ["Feels braced", "Sleeps light", "Wakes early", "Never lands"].map(item),
    },
  ],
];

/** Le titre le plus long du jeu : c'est lui qui serre la bande de contenu. */
const TIGHT = { ...CARD, headline: CARD.headline };

describe("le repli reste dessiné", () => {
  it("chaque archétype vers lequel on se replie porte un dessin", () => {
    for (const key of ["numbered_strategies", "cycle", "concentric_control", "surface_and_beneath"]) {
      expect(ARCHETYPES[key], key).toBeDefined();
      expect(DRAWING_FOR[key], `${key} doit nommer un dessin`).toBeTypeOf("function");
    }
  });

  it("une charge trop lourde se replie sur un diagramme, pas sur une phrase", () => {
    const landed: string[] = [];
    for (const [archetype, payload] of TOO_MUCH) {
      const composed = composeWithFallback({ ...TIGHT, archetype, palette: PALETTES[0], payload });
      landed.push(composed.kind === "carousel" ? "carousel" : composed.archetype);
    }
    // Aucune de ces cinq n'a de raison de finir en phrase seule : chacune
    // porte au moins deux libellés, donc au moins un diagramme la recevrait.
    expect(landed.filter((a) => a === "single_statement")).toEqual([]);
  });

  it("la part de phrases seules reste sous 40 % sur l'ensemble du catalogue", () => {
    /*
     * ⚠ MESURÉ SUR CE QUI SORT, PAS SUR CE QU'ON DEMANDE. C'est le chiffre que
     * le cahier des charges fixe, et le seul moyen de savoir qu'un mois ne
     * retombera pas en liste de phrases est de compter les atterrissages.
     */
    const landed: string[] = [];
    for (const [archetype, payload] of TOO_MUCH) {
      for (const palette of PALETTES) {
        const composed = composeWithFallback({ ...TIGHT, archetype, palette, payload });
        landed.push(composed.kind === "carousel" ? "carousel" : composed.archetype);
      }
    }
    const lone = landed.filter((a) => a === "single_statement").length / landed.length;
    expect(lone, `phrases seules : ${Math.round(lone * 100)} %`).toBeLessThan(0.4);
  });
});
