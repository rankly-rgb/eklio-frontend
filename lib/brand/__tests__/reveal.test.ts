import { describe, expect, it } from "vitest";
import { forReveal, previewModelFromDirection } from "@/lib/brand/shapes";
import { SAMPLE_DIRECTIONS, SAMPLE_PRACTICE_NAME } from "@/lib/brand/sample";

/*
 * Ce qui part sur le fil vers l'écran de révélation.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * La révélation est GRATUITE, et c'est un choix : trois directions complètes
 * sont l'argument de vente. Mais elle envoyait aussi `about_excerpt`, qu'aucune
 * carte ne dessine — la charge utile était un sur-ensemble de l'écran.
 *
 * Les props d'un composant client sont sérialisées dans la charge utile React :
 * tout ce qui descend part sur le fil, dessiné ou non. Ce test mesure donc la
 * SÉRIALISATION, pas le rendu — c'est elle qui décide de ce qu'on donne.
 */

const REVEALED = SAMPLE_DIRECTIONS.map(forReveal);
const WIRE = JSON.stringify(REVEALED);

describe("la charge utile de la révélation", () => {
  it("ne porte plus `about_excerpt`, ni la clé ni le texte", () => {
    expect(WIRE).not.toContain("about_excerpt");
    for (const direction of SAMPLE_DIRECTIONS) {
      expect(WIRE).not.toContain(direction.about_excerpt);
    }
  });

  it("porte encore tout ce que la carte dessine", () => {
    // Le reste est offert exprès : le retirer casserait l'argument de vente.
    for (const direction of SAMPLE_DIRECTIONS) {
      expect(WIRE).toContain(direction.name);
      expect(WIRE).toContain(direction.rationale);
      expect(WIRE).toContain(direction.hero.headline);
      expect(WIRE).toContain(direction.hero.subhead);
      expect(WIRE).toContain(direction.palette.primary);
      expect(WIRE).toContain(direction.typography.heading_font);
      for (const word of direction.tone_keywords) expect(WIRE).toContain(word);
    }
  });

  it("garde la personnalité de rendu, qui est de la mise en forme", () => {
    expect(WIRE).toContain("nav_surface");
  });
});

describe("la maquette de carte se passe d'`about_excerpt`", () => {
  it("elle pose des lignes de placeholder à sa place", () => {
    // C'est ce qui rend le retrait sûr : la carte ne l'a jamais rendu.
    const model = previewModelFromDirection(REVEALED[0], SAMPLE_PRACTICE_NAME);
    expect(model.about_excerpt).toBe("");
    expect(model.hero.headline).toBe(SAMPLE_DIRECTIONS[0].hero.headline);
    expect(model.tokens.primary).toBe(SAMPLE_DIRECTIONS[0].palette.primary);
  });

  it("le kit de marque, lui, garde la direction entière", () => {
    // Elle a payé : l'écran de kit rend l'extrait « About » pour de vrai.
    const full = previewModelFromDirection(
      SAMPLE_DIRECTIONS[0],
      SAMPLE_PRACTICE_NAME
    );
    expect(full.about_excerpt).toBe(SAMPLE_DIRECTIONS[0].about_excerpt);
  });
});
