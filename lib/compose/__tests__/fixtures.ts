import { composeWithFallback } from "@/lib/compose/fallback";
import type { RenderResult } from "@/lib/compose/engine";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import type { Palette } from "@/lib/compose/types";

/*
 * ── THE MATRIX THE SUITES RUN OVER ──────────────────────────────────────
 *
 * Eleven archetypes × three palettes × three content lengths.
 *
 * ⚠ THE THIRD LENGTH IS THE BUDGET CEILING, NOT "LONG". Anyone can write a
 * fixture that is comfortably long; the interesting case is the one the word
 * budget still accepts — three-word labels, six-word glosses, a
 * twenty-four-word statement. That is the card that ships when a generator is
 * working exactly as told, and it is the one that collides.
 *
 * ⚠ AND THE THREE LENGTHS VARY WORDS, NEVER ITEM COUNTS. A cycle of six nodes
 * is not "a longer cycle", it is a different card — and one that genuinely
 * does not fit at the floors, which is what the carousel is for. Mixing the
 * two axes into one fixture would make a legitimate overflow look like a
 * collision bug, and the suite would have been "fixed" by loosening a floor.
 * Item-count overflow has its own test, in overflow.test.ts.
 */

const DIRECTIONS: Array<[string, DirectionPalette]> = [
  // A light, warm one — the default shape of this product's palettes.
  ["sage", { primary: "#6B7F6E", secondary: "#B4674A", light: "#E7E2D6", dark: "#2B2724", paper: "#FAF7F2" }],
  // A cool one whose light tone is much closer to its paper: the case where
  // ink-on-tint and ink-on-paper are not the same answer.
  ["slate", { primary: "#4A5361", secondary: "#8C93A0", light: "#F1F0EE", dark: "#23262B", paper: "#F7F7F6" }],
  // A dark-ground card. Three in twelve, per DARK_CARD_RATIO.
  ["clay_dark", { primary: "#C08A6A", secondary: "#8A5F48", light: "#EFE3D9", dark: "#221C18", paper: "#F6EFE8" }],
];

export const PALETTES: Palette[] = DIRECTIONS.map(([key, d], i) =>
  cardPalette(key, d, i === 2)
);

export type Length = "short" | "nominal" | "ceiling";

const ITEM = {
  short: { label: "Rest", gloss: "often" },
  nominal: { label: "Push through", gloss: "costly and familiar" },
  // Three words, six words: exactly what the budget allows.
  ceiling: { label: "Ask for help", gloss: "hardest of the four by far" },
} as const;

function items(n: number, length: Length) {
  const base = ITEM[length];
  // Distinct labels, same word counts. A fixture whose four cells are the same
  // string measures one cell four times.
  const words = ["Notice", "Name", "Allow", "Steady", "Return", "Close", "Pause", "Begin"];
  return Array.from({ length: n }, (_, i) => ({
    label: base.label.replace(/^\w+/, words[i % words.length]),
    gloss: base.gloss,
  }));
}

const STATEMENT = {
  short: "Rest is not earned",
  nominal: "Rest is not a reward you earn after everything else is done",
  ceiling:
    "Rest is not a reward you earn after everything else on the list has finally been done properly and well",
} as const;

/** The ceiling statement is exactly 24 words — the budget's own maximum. */
const LINES = {
  short: ["Evenings", "Telehealth"],
  nominal: ["Evenings and early mornings", "Telehealth across two states"],
  ceiling: [
    "Evenings and early mornings, and some weekends too",
    "Telehealth across two states and in person here",
  ],
} as const;

export function payloadFor(archetype: string, length: Length): unknown {
  switch (archetype) {
    case "single_statement":
      return { statement: STATEMENT[length] };
    case "quadrant_model":
      return { axis_x: "Effort here", axis_y: "Relief here", items: items(4, length) };
    case "cycle":
      return { nodes: items(3, length) };
    case "surface_and_beneath": {
      const [a, b] = items(2, length);
      return { surface: a, beneath: b };
    }
    case "comparison_pair":
      return { left: items(2, length), right: items(2, length) };
    case "numbered_strategies":
      return { items: items(3, length) };
    case "lettered_technique": {
      const n = 3;
      const acronym = "RAI";
      const base = ITEM[length];
      const stems = ["Recognise", "Allow", "Investigate", "Nurture", "Soften"];
      return {
        acronym,
        items: Array.from({ length: n }, (_, i) => ({
          label: base.label.replace(/^\w+/, stems[i]),
          gloss: base.gloss,
        })),
      };
    }
    case "concentric_control":
      return { rings: items(2, length) };
    case "annotated_curve":
      return { axis_x: "Weeks here", axis_y: "Steady here", points: items(2, length) };
    case "practitioner_card":
      return { lines: LINES[length] };
    case "carousel":
      return {
        cards: [
          { archetype_key: "single_statement", payload: { statement: STATEMENT[length] } },
          { archetype_key: "cycle", payload: { nodes: items(3, length) } },
          { archetype_key: "single_statement", payload: { statement: STATEMENT.nominal } },
        ],
      };
    default:
      throw new Error(`no fixture for ${archetype}`);
  }
}

export const LENGTHS: Length[] = ["short", "nominal", "ceiling"];

/*
 * ⚠ LE TITRE TIENT EN 30 CARACTÈRES, ET CE N'EST PAS UN DÉTAIL DE FIXTURE.
 *
 * « What holds when everything else moves » en faisait 37, et le 2026-09-21 la
 * mesure a dit ce que ces sept caractères coûtent : le titre se pose alors à
 * 96px au lieu de 110, `secondaryMax` tombe de 36 à 32, et tout libellé de
 * diagramme arrive sous 11px dans une vignette de 350. La suite composait donc
 * des cartes que le produit refuse désormais de livrer.
 *
 * La fixture suit la règle du produit. Elle ne l'assouplit pas : c'est
 * `CONTENT_MIN_AT_CANVAS` qui décide, ici comme ailleurs.
 */
export const CARD = {
  eyebrow: "A CALMER WAY",
  headline: "What holds when things move",
  footer: "@apracticename",
} as const;

/*
 * ── CE QUE LE PRODUIT LIVRE VRAIMENT, POUR LES SUITES QUI L'INSPECTENT ──
 *
 * ⚠ `render` SEUL N'EST PLUS CE QUI ARRIVE DANS UN FIL. Depuis que le moteur
 * refuse une carte illisible en vignette, une fixture au plafond d'items peut
 * légitimement ne pas tenir sur une seule carte — et le produit la replie
 * (`lib/compose/fallback.ts`) au lieu de la jeter.
 *
 * Les suites de collision, de planchers et de déterminisme passent donc par le
 * repli. Elles posent la même question qu'avant, et elles la posent sur la
 * bonne chose : non pas « la première forme essayée est-elle propre » mais
 * « ce qui sera publié est-il propre ». C'est strictement plus fort.
 */
export function composedFor(
  archetype: string,
  palette: (typeof PALETTES)[number],
  length: Length
): RenderResult[] {
  const input = { ...CARD, archetype, palette, payload: payloadFor(archetype, length) };
  const composed = composeWithFallback(input);
  return composed.kind === "carousel" ? composed.slides : [composed.result];
}
