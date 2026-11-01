import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { cardPalette, contrast } from "@/lib/compose/palette";
import { ACCENTS, decorFor, PHOTO_TEXT_CONTRAST, shapeFill, TEXTURE_OPACITY } from "@/lib/compose/decor";
import { LIBRARY_STROKE_TARGET, libraryDrawing, libraryVector, placeVector, renderedWeight } from "@/lib/compose/library";
import { violations } from "@/lib/compose/engine";

/*
 * Étape 4 (2026-11-01) : la mise en page prend le décor de la bibliothèque —
 * fond photo voilé, texture, forme derrière le titre, accent dessiné — et
 * harmonise le trait des dessins. Chaque couche n'existe que si le contraste
 * tient.
 */
const DIRECTION = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const palette = cardPalette("card-1", DIRECTION, false);
const statement = { archetype: "single_statement", payload: { statement: "Old rules can linger long after the room has changed." }, palette, eyebrow: "BEHIND THE PRACTICE", headline: "Old rules", footer: "Ember consulting · LMFT 123456" };
const diagram = {
  ...statement,
  archetype: "numbered_strategies",
  headline: "Three ways to notice an old rule",
  payload: { items: [{ label: "Notice the alarm", gloss: "a body cue" }, { label: "Name the rule", gloss: "learned long ago" }, { label: "Test it today", gloss: "one small step" }] },
};

describe("une phrase seule prend un fond photo voilé et un accent", () => {
  const svg = render({ ...statement, illustration: "ground-anchor" }).svg;

  it("la photo est sous un voile couleur papier, à 85 % au moins", () => {
    expect(svg).toMatch(/<image data-photo="bg-[a-z-]+" href="data:image\/jpeg;base64,/);
    const veil = Number(/data-veil="([\d.]+)"/.exec(svg)?.[1]);
    expect(veil).toBeGreaterThanOrEqual(0.85);
    expect(svg).toContain(`fill="${palette.paper}" opacity="${veil}"`);
  });

  it("l'accent remplace le trait fait main : un tracé du pack, horizontal", () => {
    const plain = render(statement).svg;
    const drawn = render({ ...statement, illustration: "ground-anchor" }).svg;
    const markOf = (s: string) => /<g data-role="figure"[^>]*>(<path [^>]*\/>)<\/g>/.exec(s)?.[1] ?? "";
    expect(markOf(drawn)).not.toBe(markOf(plain));
    expect(markOf(drawn)).toContain('fill-rule="evenodd"');
    for (const id of ACCENTS) expect(libraryVector(id).w / libraryVector(id).h).toBeGreaterThanOrEqual(4);
  });
});

describe("un diagramme prend une texture et une forme derrière son titre", () => {
  const out = render({ ...diagram, illustration: "ground-anchor" });

  it("texture à 6 %, forme marquée `data-shape`, dans une teinte de la palette", () => {
    expect(out.svg).toContain(`opacity="${TEXTURE_OPACITY}"`);
    const fill = /<path data-shape="shape-[a-z-]+" d="[^"]+" fill="(#[0-9a-fA-F]{6})"/.exec(out.svg)?.[1];
    expect(fill).toBeDefined();
    expect(palette.tints).toContain(fill);
    expect(contrast(palette.ink, fill!)).toBeGreaterThanOrEqual(PHOTO_TEXT_CONTRAST);
  });

  it("le décor ne change aucun dégagement : la composition reste sans violation", () => {
    expect(violations(out.composition.placed)).toEqual([]);
  });

  it("sans dessin de la bibliothèque, aucun décor : la carte d'avant reste ce qu'elle était", () => {
    const svg = render(diagram).svg;
    expect(svg).not.toMatch(/data-(photo|texture|shape)=/);
  });

  it("provoqué : une palette dont aucun aplat ne porte le titre n'a pas de forme", () => {
    const flat = { ...palette, tints: ["#3A3A3A", "#3A3A3A", "#3A3A3A", "#3A3A3A"] };
    expect(shapeFill(flat)).toBeNull();
    expect(decorFor("numbered_strategies", "ground-anchor", flat, { x: 72, y: 162, w: 936, h: 200 }).shape).toBeUndefined();
  });
});

describe("le trait des dessins est harmonisé, par le bas", () => {
  it("le plus fin du pack est épaissi jusqu'à la cible, et sa boîte grandit d'autant", () => {
    const box = { x: 100, y: 100, w: 300, h: 300 };
    const v = libraryVector("mem-returning-tide");
    const { fitted } = placeVector(v, box);
    expect(renderedWeight(v, fitted)).toBeLessThan(LIBRARY_STROKE_TARGET);
    const [s] = libraryDrawing("mem-returning-tide")(box, "#222222");
    expect(s.strokeWidth).toBeCloseTo(LIBRARY_STROKE_TARGET - renderedWeight(v, fitted), 1);
    expect(s.box.w).toBeCloseTo(fitted.w + s.strokeWidth, 1);
  });

  it("un dessin déjà épais n'est pas touché (on n'amincit pas un aplat)", () => {
    const [s] = libraryDrawing("practice-notebook")({ x: 0, y: 0, w: 300, h: 300 }, "#222222");
    expect(s.strokeWidth).toBe(0);
    expect(s.stroke).toBe("none");
  });
});
