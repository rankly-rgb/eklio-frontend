import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { DRAWABLE, wantsPhoto } from "@/lib/compose/decor";
import { structureOf } from "@/lib/compose/structure";
import { checkStructureVariety, MONTH_LIMITS } from "@/lib/content/month-checks";

/*
 * F102 (2026-11-02) : deux cartes se ressemblent quand leur IMAGE se ressemble.
 * La signature est lue dans le SVG livré ; ces tests vérifient qu'elle regroupe
 * ce que l'œil regroupe, et sépare ce qu'il sépare — sur les mises en page
 * réelles du moteur, pas sur une table.
 */
const DIRECTION = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const palette = cardPalette("k", DIRECTION, false);
const PAPER = DRAWABLE.find((id) => !wantsPhoto("numbered_strategies", id))!;
const PHOTO = DRAWABLE.find((id) => wantsPhoto("numbered_strategies", id))!;
const card = (archetype: string, payload: unknown, illustration = PAPER) =>
  render({ archetype, payload, palette, eyebrow: "BEHIND THE PRACTICE", headline: "Old rules carry costs", footer: "Ember · LMFT 1", illustration }).svg;

const three = [{ label: "Notice", gloss: "a body cue" }, { label: "Name", gloss: "learned long ago" }, { label: "Test", gloss: "one small step" }];
/*
 * La pile de blocs est la mise en page SANS idiome (un post d'avant la
 * bibliothèque, ou un idiome qui refuse) : c'est elle que ces tests regroupent.
 * Avec un dessin de la bibliothèque, numbered_strategies devient des pilules
 * et cycle des bulles (2026-11-02) — voir le dernier bloc.
 */
const boxes = (archetype: string, payload: unknown) =>
  render({ archetype, payload, palette, eyebrow: "BEHIND THE PRACTICE", headline: "Old rules carry costs", footer: "Ember · LMFT 1" }).svg;
const numbered = boxes("numbered_strategies", { items: three });
const cycle = boxes("cycle", { nodes: three });
const bands = card("surface_and_beneath", { surface: { label: "Learned rule", gloss: "keep everyone comfortable" }, beneath: { label: "Current cost", gloss: "your own needs go unheard" } });
const statement = card("single_statement", { statement: "Old rules can linger." });

describe("la signature regroupe ce que l'œil regroupe", () => {
  it("numbered_strategies et cycle : la même image (un dessin à gauche, une colonne de blocs)", () => {
    expect(structureOf(numbered).signature).toBe(structureOf(cycle).signature);
    expect(structureOf(numbered).fields).toBe("colonne");
    /* Le dessin fait main n'a pas de `data-library` : la signature lit « sans dessin », pour les deux. */
    expect(structureOf(cycle).fields).toBe("colonne");
  });

  it("surface_and_beneath se distingue : des bandes pleine largeur, le dessin entre elles", () => {
    expect(structureOf(bands).signature).not.toBe(structureOf(numbered).signature);
    expect(structureOf(bands).fields).toBe("bandes pleine largeur");
  });

  it("une phrase seule : aucun aplat ; et le fond ne compte PAS — la même pile sur photo est la même carte pour l'œil", () => {
    expect(structureOf(statement).fields).toBe("aucun aplat");
    const pillsPaper = card("numbered_strategies", { items: three }, PAPER);
    const pillsPhoto = card("numbered_strategies", { items: three }, PHOTO);
    expect(structureOf(pillsPhoto).signature).toBe(structureOf(pillsPaper).signature);
  });
});

describe("le plafond par signature", () => {
  const post = (svg: string, cardLine: string) => ({ archetype: "x", title: cardLine, cardLine, payload: {}, svg, eyebrow: "", footer: "" });

  it("une même image au plus une carte sur quatre : 7 sur 30 passe, 8 non, et le constat nomme la dernière", () => {
    expect(Math.floor(30 * MONTH_LIMITS.maxStructureShare)).toBe(7);
    const others = Array.from({ length: 23 }, (_, i) => post(i % 2 ? bands : statement, `other ${i}`));
    const seven = [...Array.from({ length: 7 }, (_, i) => post(i % 2 ? cycle : numbered, `pile ${i}`)), ...others];
    expect(checkStructureVariety(seven).filter((f) => f.detail.includes("colonne"))).toEqual([]);
    const eight = [...Array.from({ length: 8 }, (_, i) => post(i % 2 ? cycle : numbered, `pile ${i}`)), ...others.slice(1)];
    const found = checkStructureVariety(eight).filter((f) => f.detail.includes("colonne"));
    expect(found).toHaveLength(1);
    expect(found[0].check).toBe("structure.dominant");
    expect(found[0].detail).toContain("« pile 7 »");
  });
});

describe("les idiomes ont leur propre signature", () => {
  it("pilules et bulles ne comptent plus comme la pile de blocs", () => {
    expect(structureOf(card("numbered_strategies", { items: three })).signature).toBe("pills");
    expect(structureOf(numbered).signature).toBe("colonne · sans dessin");
  });
});

