import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { groundFor } from "@/lib/compose/grounds";
import { SHAPE_MAX_DRAWING_WIDTH } from "@/lib/compose/decor";
import { isLoneStroke } from "@/lib/compose/library";
import { structureOf } from "@/lib/compose/structure";
import { allowedGrounds } from "@/lib/content/month/grounds-plan";
import { checkDrawingTreatment, MONTH_LIMITS } from "@/lib/content/month-checks";

/*
 * LA RÈGLE DE LA TACHE (2026-11-04). La planche du 2026-11-02 posait une tache
 * ocre sous onze dessins sur trente ; la signature ne la voyait pas. La tache
 * n'appartient qu'aux petits dessins ; le trait nu a un plancher ; un trait seul
 * ne va pas sur une photo.
 */
const DIRECTION = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const palette = cardPalette("card-1", DIRECTION, false);
const cream = groundFor(DIRECTION, "cream");
const base = { palette, eyebrow: "BEHIND THE PRACTICE", footer: "Ember consulting · LMFT 123456", ground: cream };
const small = { ...base, archetype: "surface_and_beneath", headline: "What sits under an old rule", payload: { surface: { label: "Keeping busy", gloss: "every task gets done" }, beneath: { label: "An old rule", gloss: "learned long ago" } }, illustration: "ground-anchor" };
/* Le grand dessin sur teinte pleine (spec 9) : la carte nue de la planche. */
const big = { ...base, ground: groundFor(DIRECTION, "ochre"), archetype: "single_statement", headline: "", payload: { statement: "Grief can be real even when nobody sees it." }, illustration: "grief-empty-chair" };

const drawingWidth = (svg: string) => Number(/data-library="[^"]+" [^>]*data-box="([^"]+)"/.exec(svg)![1].split(",")[2]);

describe("la tache n'appartient qu'aux petits dessins", () => {
  it("sous un dessin de 300 px au plus, elle se pose", () => {
    const svg = render(small).svg;
    expect(drawingWidth(svg)).toBeLessThanOrEqual(SHAPE_MAX_DRAWING_WIDTH);
    expect(structureOf(svg).treatment).toBe("sur tache");
  });

  it("sous un grand dessin, le trait est posé nu", () => {
    const svg = render(big).svg;
    expect(drawingWidth(svg)).toBeGreaterThan(SHAPE_MAX_DRAWING_WIDTH);
    expect(svg).not.toContain("data-shape");
    expect(structureOf(svg).treatment).toBe("nu");
  });

  it("le traitement entre dans la signature : même disposition, tache ou trait nu, deux signatures", () => {
    const a = structureOf(render(small).svg);
    expect(a.signature.endsWith("· sur tache")).toBe(true);
    expect(structureOf(render(big).svg).signature.endsWith("· nu")).toBe(true);
  });
});

describe("le mois : la tache plafonnée, le trait nu au plancher", () => {
  const nakedSvg = render(big).svg;
  const shapedSvg = render(small).svg;
  const month = (shaped: number, naked: number) =>
    Array.from({ length: 30 }, (_, i) => ({
      cardLine: `post ${i}`,
      svg: i < shaped ? shapedSvg : i < shaped + naked ? nakedSvg : render({ ...big, ground: groundFor(DIRECTION, "photo") }).svg,
    })) as never;

  it("six taches et six traits nus passent", () => {
    expect(checkDrawingTreatment(month(6, 6))).toEqual([]);
  });

  it("une septième tache est refusée", () => {
    expect(checkDrawingTreatment(month(7, 6)).map((f) => f.check)).toEqual(["drawing.shape_dominant"]);
  });

  it("cinq traits nus sont sous le plancher — un plafond seul ne suffit pas", () => {
    expect(checkDrawingTreatment(month(0, 5)).map((f) => f.check)).toEqual(["drawing.too_few_naked"]);
    expect(Math.ceil(30 * MONTH_LIMITS.minNakedShare)).toBe(6);
  });
});

describe("un trait seul ne va pas sur une photo", () => {
  it("priv-partial-outline est un trait seul ; grief-two-paths n'en est pas un", () => {
    expect(isLoneStroke("priv-partial-outline")).toBe(true);
    expect(isLoneStroke("grief-two-paths")).toBe(false);
  });

  it("le plan des fonds ne lui offre pas la photo, et laisse les aplats", () => {
    expect(allowedGrounds("single_statement", "priv-partial-outline")).toEqual(["cream", "deep", "ochre", "terra"]);
    expect(allowedGrounds("single_statement", "grief-two-paths")).toContain("photo");
    /* Les bulles ne posent pas de dessin sur la photo : la règle ne les touche pas. */
    expect(allowedGrounds("cycle", "priv-partial-outline")).toContain("photo");
  });
});
