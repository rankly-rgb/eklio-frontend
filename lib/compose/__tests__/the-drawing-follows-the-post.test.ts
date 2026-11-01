import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { libraryVector, placeVector, UnknownLibraryDrawing } from "@/lib/compose/library";

/*
 * Le dessin d'une carte est celui que le SENS du post a choisi
 * (`lib/visual-library/match.ts`), plus celui attaché à l'archétype. Constat du
 * 2026-11-01 : l'appariement existait et était testé, mais la composition ne le
 * consultait pas — `numbered_strategies` posait toujours la plante.
 */
const DIRECTION = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const base = {
  archetype: "numbered_strategies",
  payload: { items: [{ label: "Notice the alarm", gloss: "a body cue" }, { label: "Name the rule", gloss: "learned long ago" }, { label: "Test it today", gloss: "one small step" }] },
  palette: cardPalette("card-1", DIRECTION, false),
  eyebrow: "BEHIND THE PRACTICE",
  headline: "Old rules can linger",
  footer: "Ember consulting · LMFT 123456",
};

describe("la composition consulte le dessin du post", () => {
  it("avec un dessin apparié, la carte le porte — en vecteurs, à l'encre de la palette", () => {
    const svg = render({ ...base, illustration: "rule-grooved-tablet" }).svg;
    expect(svg).toContain('data-library="rule-grooved-tablet"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).not.toMatch(/<image[^>]*data-library/);
  });

  it("deux dessins différents donnent deux cartes différentes, à archétype égal", () => {
    const a = render({ ...base, illustration: "rule-grooved-tablet" }).svg;
    const b = render({ ...base, illustration: "grief-two-paths" }).svg;
    expect(a).not.toBe(b);
    expect(b).toContain('data-library="grief-two-paths"');
  });

  it("sans dessin (un post d'avant la bibliothèque), l'archétype garde son dessin fait main", () => {
    const svg = render(base).svg;
    expect(svg).not.toContain("data-library");
  });

  it("un identifiant inconnu est refusé, jamais deviné", () => {
    expect(() => render({ ...base, illustration: "shape-pebble" })).toThrow(UnknownLibraryDrawing);
  });
});

describe("le tracé est posé sans déformation", () => {
  it("contenu et centré dans sa boîte, à l'échelle de son côté le plus contraint", () => {
    const v = libraryVector("anx-iceberg");
    const placed = placeVector(v, { x: 100, y: 200, w: 400, h: 200 });
    expect(placed.fitted.h).toBeCloseTo(200, 1);
    expect(placed.fitted.w).toBeCloseTo((v.w / v.h) * 200, 1);
    expect(placed.fitted.x).toBeCloseTo(100 + (400 - placed.fitted.w) / 2, 1);
  });
});
