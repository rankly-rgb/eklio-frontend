import { describe, expect, it } from "vitest";
import { render } from "@/lib/compose/engine";
import { cardPalette, contrast } from "@/lib/compose/palette";
import { ACCENTS, DRAWABLE, decorFor, wantsPhoto, PHOTO_FIGURE_CONTRAST, PHOTO_TEXT_CONTRAST, shapeFill, TEXTURE_OPACITY, VEIL_FREE } from "@/lib/compose/decor";
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
/*
 * ⚠ UN DIAGRAMME QUI GARDE SON DESSIN, ET UN PETIT (2026-11-04). Les étapes
 * (`numbered_strategies`) sont devenues des pilules sans dessin, et la tache ne
 * se pose que sous un dessin de 300 px au plus : `surface_and_beneath` pose le
 * sien entre ses deux bandes, à 235 px.
 */
const diagram = {
  ...statement,
  archetype: "surface_and_beneath",
  headline: "What sits under an old rule",
  payload: { surface: { label: "Keeping busy", gloss: "every task gets done" }, beneath: { label: "An old rule", gloss: "learned long ago" } },
};

/* Un dessin de rang pair prend un fond photo, un de rang impair le papier (F102). */
const ON_PHOTO = DRAWABLE.find((_, i) => i % 2 === 0)!;
const ON_PAPER = DRAWABLE.find((_, i) => i % 2 === 1)!;

describe("une phrase seule prend un fond photo voilé et un accent", () => {
  const svg = render({ ...statement, illustration: ON_PHOTO }).svg;

  it("la photo est sous un voile LOCAL : protégé derrière le texte, libre ailleurs", () => {
    expect(svg).toMatch(/<image data-photo="bg-[a-z-]+" href="data:image\/jpeg;base64,/);
    expect(svg).toContain('data-veil="local"');
    const veil = /<linearGradient id="eklio-veil-[^"]+"[^>]*>([\s\S]*?)<\/linearGradient>/.exec(svg)![1];
    const stops = [...veil.matchAll(/<stop offset="[\d.]+" stop-color="[^"]+" stop-opacity="([\d.]+)"\/>/g)].map((m) => Number(m[1]));
    /* La base, là où rien n'est posé ; plus haut derrière le texte. */
    expect(Math.min(...stops)).toBe(VEIL_FREE);
    expect(Math.max(...stops)).toBeGreaterThan(VEIL_FREE);
    expect(Number(/data-worst-text="([\d.]+)"/.exec(svg)?.[1])).toBeGreaterThanOrEqual(PHOTO_TEXT_CONTRAST);
  });

  it("deux cartes à fond photo ne partagent pas un identifiant de dégradé qui ne serait pas le leur", () => {
    const other = render({ ...statement, payload: { statement: "A different sentence sits higher." }, illustration: ON_PHOTO }).svg;
    const id = (s: string) => /id="(eklio-veil-[a-z0-9]+)"/.exec(s)?.[1];
    expect(id(svg)).not.toBe(id(other));
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

describe("un diagramme prend une texture, et la forme se pose sous le dessin — plus derrière le titre", () => {
  const out = render({ ...diagram, illustration: "ground-anchor" });

  it("forme pleine, dans une teinte de la palette, sur laquelle le dessin tient 3:1", () => {
    expect(out.svg).toContain(`opacity="${TEXTURE_OPACITY}"`);
    const m = /<path data-shape="shape-[a-z-]+" d="[^"]+" fill="(#[0-9a-fA-F]{6})" fill-rule="evenodd" data-box="([^"]+)"/.exec(out.svg);
    expect(m).not.toBeNull();
    expect(palette.tints).toContain(m![1]);
    expect(contrast(palette.ink, m![1])).toBeGreaterThanOrEqual(PHOTO_FIGURE_CONTRAST);
    /* Sous le dessin : elle contient son centre. */
    const [x, y, w, h] = m![2].split(",").map(Number);
    const drawing = /data-library="ground-anchor" [^>]*data-box="([^"]+)"/.exec(out.svg)![1].split(",").map(Number);
    const cx = drawing[0] + drawing[2] / 2, cy = drawing[1] + drawing[3] / 2;
    expect(cx > x && cx < x + w && cy > y && cy < y + h).toBe(true);
  });

  it("aucune ligne de texte ni aucun aplat ne recouvre la forme", () => {
    const [x, y, w, h] = /data-shape="[^"]+" d="[^"]+" fill="[^"]+" fill-rule="evenodd" data-box="([^"]+)"/.exec(out.svg)![1].split(",").map(Number);
    for (const p of out.composition.placed) {
      if (p.role === "figure") continue;
      const b = p.box;
      expect(b.x < x + w && x < b.x + b.w && b.y < y + h && y < b.y + b.h, `${p.role} ${p.band}`).toBe(false);
    }
  });

  it("le titre n'a plus de forme derrière lui", () => {
    const head = out.composition.placed.find((p) => p.band === "headline")!.box;
    const [x, y, w, h] = /data-shape="[^"]+" d="[^"]+" fill="[^"]+" fill-rule="evenodd" data-box="([^"]+)"/.exec(out.svg)![1].split(",").map(Number);
    expect(y >= head.y + head.h || y + h <= head.y || x >= head.x + head.w || x + w <= head.x).toBe(true);
  });

  it("le décor ne change aucun dégagement : la composition reste sans violation", () => {
    expect(violations(out.composition.placed)).toEqual([]);
  });

  it("sans dessin de la bibliothèque, aucun décor : la carte d'avant reste ce qu'elle était", () => {
    const svg = render(diagram).svg;
    expect(svg).not.toMatch(/data-(photo|texture|shape)=/);
  });

  it("provoqué : une palette dont aucun aplat ne porte le dessin n'a pas de forme", () => {
    const flat = { ...palette, tints: ["#3A3A3A", "#3A3A3A", "#3A3A3A", "#3A3A3A"] };
    expect(shapeFill(flat)).toBeNull();
    expect(decorFor("numbered_strategies", "ground-anchor", flat, out.composition.placed).shape).toBeUndefined();
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
    /* L'encre, contour compris, reste dans la boîte allouée : le dégagement mesure cette boîte-là. */
    expect(s.box.x).toBeGreaterThanOrEqual(box.x - 0.01);
    expect(s.box.y).toBeGreaterThanOrEqual(box.y - 0.01);
    expect(s.box.x + s.box.w).toBeLessThanOrEqual(box.x + box.w + 0.01);
    expect(s.box.y + s.box.h).toBeLessThanOrEqual(box.y + box.h + 0.01);
  });

  it("un dessin déjà épais n'est pas touché (on n'amincit pas un aplat)", () => {
    const [s] = libraryDrawing("practice-notebook")({ x: 0, y: 0, w: 300, h: 300 }, "#222222");
    expect(s.strokeWidth).toBe(0);
    expect(s.stroke).toBe("none");
  });
});

describe("une carte sur deux prend un fond photo, toutes mises en page (F102)", () => {
  it("rang pair : photo ; rang impair : papier ; jamais la couverture d'un carrousel", () => {
    expect(wantsPhoto("quadrant_model", ON_PHOTO)).toBe(true);
    expect(wantsPhoto("quadrant_model", ON_PAPER)).toBe(false);
    expect(wantsPhoto("carousel", ON_PHOTO)).toBe(false);
    const share = DRAWABLE.filter((id) => wantsPhoto("numbered_strategies", id)).length / DRAWABLE.length;
    expect(share).toBeCloseTo(0.5, 1);
  });

  it("un diagramme sur photo garde ses aplats opaques, et le voile local protège ce qui est posé à même le fond", () => {
    const svg = render({ ...diagram, illustration: ON_PHOTO }).svg;
    expect(svg).toContain("data-photo=");
    expect(svg).toContain('data-veil="local"');
    expect(Number(/data-worst-text="([\d.]+)"/.exec(svg)?.[1])).toBeGreaterThanOrEqual(PHOTO_TEXT_CONTRAST);
  });
});

