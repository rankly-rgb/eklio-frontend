import { describe, expect, it } from "vitest";
import {
  directionBases,
  heroOverline,
  pickPaletteFamilies,
  pickTypePairings,
} from "@/lib/generation/select";
import type { Catalog, PaletteFamily, TypePairing } from "@/lib/catalog/types";

/*
 * Trois contraintes de la base se jouent ici, avant tout appel modèle :
 * cinq hex valides par direction, trois polices de TITRE distinctes, et une
 * URL Google Fonts réelle. Les rater ne se voit qu'à l'écriture — c'est-à-dire
 * après une minute de génération, sur l'écran de révélation du praticien.
 */

function family(id: string, primary: string): PaletteFamily {
  return {
    id,
    label: id.toUpperCase(),
    active: true,
    sort_order: 1,
    primary_hex: primary,
    secondary_hex: "#C08A3E",
    light_hex: "#F4EEE3",
    dark_hex: "#2B2A27",
    paper_hex: "#FAF6EE",
    swatches: [primary, "#C08A3E", "#F4EEE3"],
    preview_tokens: {
      primary,
      secondary: "#C08A3E",
      light: "#F4EEE3",
      dark: "#2B2A27",
      paper: "#FAF6EE",
    },
  };
}

function pairing(id: string, heading: string, body: string): TypePairing {
  return {
    id,
    active: true,
    sort_order: 1,
    heading_font: heading,
    body_font: body,
    google_fonts_url: `https://fonts.googleapis.com/css2?family=${heading}&display=swap`,
  };
}

const catalog = {
  paletteFamilies: [
    family("clay_sand", "#B4674A"),
    family("plum_bone", "#3B2C3A"),
    family("ink_blue_chalk", "#22364F"),
    family("olive_chalk", "#7A8168"),
  ],
  typePairings: [
    pairing("fraunces_nunito", "Fraunces", "Nunito Sans"),
    pairing("cormorant_source", "Cormorant Garamond", "Source Sans 3"),
    pairing("lora_source3", "Lora", "Source Sans 3"),
    pairing("newsreader_work", "Newsreader", "Work Sans"),
  ],
} as unknown as Catalog;

describe("pickPaletteFamilies", () => {
  it("respecte l'ordre du praticien, la LEADING en tête", () => {
    const picked = pickPaletteFamilies(["ink_blue_chalk", "clay_sand"], catalog);
    expect(picked.map((f) => f.id)).toEqual([
      "ink_blue_chalk",
      "clay_sand",
      "plum_bone",
    ]);
  });

  it("complète depuis le catalogue quand rien n'a été choisi", () => {
    expect(pickPaletteFamilies([], catalog)).toHaveLength(3);
  });

  it("ne rend jamais deux fois la même famille", () => {
    const picked = pickPaletteFamilies(["clay_sand", "clay_sand"], catalog);
    expect(new Set(picked.map((f) => f.id)).size).toBe(3);
  });
});

describe("pickTypePairings", () => {
  it("place la paire choisie en tête", () => {
    expect(pickTypePairings("lora_source3", catalog)[0].id).toBe("lora_source3");
  });

  it("rend trois polices de TITRE distinctes — la contrainte de la base", () => {
    for (const chosen of [null, "fraunces_nunito", "newsreader_work"]) {
      const picked = pickTypePairings(chosen, catalog);
      expect(picked).toHaveLength(3);
      expect(new Set(picked.map((p) => p.heading_font)).size).toBe(3);
    }
  });

  it("tolère deux paires qui partagent une police de CORPS", () => {
    const picked = pickTypePairings("cormorant_source", catalog);
    const bodies = picked.map((p) => p.body_font);
    expect(bodies).toContain("Source Sans 3");
    expect(new Set(picked.map((p) => p.heading_font)).size).toBe(3);
  });
});

describe("directionBases", () => {
  it("arme trois directions complètes, hex et URL comprises", () => {
    const bases = directionBases(["clay_sand"], "fraunces_nunito", catalog);
    expect(bases).toHaveLength(3);
    for (const basis of bases) {
      expect(basis.palette.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(basis.typography.google_fonts_url).toContain(
        "fonts.googleapis.com/css2?family="
      );
    }
    expect(
      new Set(bases.map((b) => b.typography.heading_font)).size
    ).toBe(3);
  });
});

describe("heroOverline", () => {
  it("joint licence et lieu par « · » quand les deux existent", () => {
    expect(heroOverline("LCSW", "Portland", "or")).toBe("LCSW · PORTLAND, OR");
  });

  it("ne laisse jamais un séparateur orphelin", () => {
    expect(heroOverline(null, "Portland", "OR")).toBe("PORTLAND, OR");
    expect(heroOverline("LCSW", "Portland", null)).toBe("LCSW");
    expect(heroOverline(null, null, null)).toBe("");
  });
});
