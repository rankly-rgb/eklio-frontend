import { describe, expect, it } from "vitest";
import {
  briefPatchSchema,
  findUnknownCatalogId,
  parseBriefData,
} from "@/lib/data/brief";
import type { Catalog } from "@/lib/catalog/types";

/*
 * Les ids de catalogue sont des CLÉS ÉTRANGÈRES en pratique (§0.5) :
 * `brief_preview()` les résout contre les tables de catalogue, et un id
 * inventé ne remonte pas une erreur — il remonte un repli. Le rail afficherait
 * alors éternellement la palette par défaut, sans que rien ne le dise.
 */

const catalog = {
  licenseTypes: [{ id: "lcsw" }],
  specialties: [{ id: "anxiety" }, { id: "burnout" }],
  problemCards: [],
  gainCards: [],
  personaCards: [{ id: "high_functioning" }],
  toneCards: [{ id: "grounded" }],
  paletteFamilies: [{ id: "clay_sand" }, { id: "plum_bone" }],
  typePairings: [{ id: "fraunces_nunito" }],
  primaryActions: [{ id: "book_consult" }],
  siteGoals: [{ id: "book_consults" }],
  ethicsRules: [],
} as unknown as Catalog;

describe("findUnknownCatalogId", () => {
  it("laisse passer un correctif dont tous les ids viennent du catalogue", () => {
    expect(
      findUnknownCatalogId(
        {
          license_type_id: "lcsw",
          specialty_ids: ["anxiety", "burnout"],
          tone_card_id: "grounded",
          palette_family_ids: ["clay_sand", "plum_bone"],
        },
        catalog
      )
    ).toBeNull();
  });

  it("nomme le champ et l'id fautifs", () => {
    expect(
      findUnknownCatalogId({ palette_family_ids: ["clay_sand", "sage_mist"] }, catalog)
    ).toEqual({ field: "palette_family_ids", id: "sage_mist" });
  });

  it("ne se déclenche pas sur un effacement (`null`)", () => {
    expect(findUnknownCatalogId({ tone_card_id: null }, catalog)).toBeNull();
  });

  it("ignore les champs absents du correctif", () => {
    expect(findUnknownCatalogId({ practice_name: "Elm & Ember" }, catalog)).toBeNull();
  });
});

describe("briefPatchSchema", () => {
  it("refuse plus de trois familles de palette, comme la base", () => {
    const result = briefPatchSchema.safeParse({
      palette_family_ids: ["a", "b", "c", "d"],
    });
    expect(result.success).toBe(false);
  });

  it("refuse un code d'État qui n'est pas deux lettres", () => {
    expect(briefPatchSchema.safeParse({ state: "Oregon" }).success).toBe(false);
    expect(briefPatchSchema.safeParse({ state: "OR" }).success).toBe(true);
  });

  it("borne l'étape à 1..7 — pas à 1..8, qui est le cycle du projet", () => {
    expect(briefPatchSchema.safeParse({ progress_step: 7 }).success).toBe(true);
    expect(briefPatchSchema.safeParse({ progress_step: 8 }).success).toBe(false);
  });
});

describe("parseBriefData", () => {
  it("rend un objet vide plutôt que de refuser d'ouvrir un brief corrompu", () => {
    expect(parseBriefData({ builder_target: "notion" })).toEqual({});
    expect(parseBriefData(null)).toEqual({});
  });

  it("conserve les réponses libres reconnues", () => {
    expect(parseBriefData({ gain_text: "Sleep through the night." })).toEqual({
      gain_text: "Sleep through the night.",
    });
  });
});

/*
 * Le nom de la praticienne — étape 1, facultatif, et DISTINCT de la ligne
 * composée rendue sur la story `signature`.
 */
describe("practitioner_name", () => {
  it("est accepté dans la part libre du brief", () => {
    expect(parseBriefData({ practitioner_name: "Nora Whitfield" })).toEqual({
      practitioner_name: "Nora Whitfield",
    });
  });

  it("reste facultatif — un brief sans lui est valide", () => {
    expect(parseBriefData({})).toEqual({});
  });

  it("ne se confond pas avec `practitioner_line`", () => {
    // La ligne est COMPOSÉE ; le nom est nu. Le backend a refusé de redécouper
    // la première en morceaux, et il a eu raison : un nom qui porte une
    // virgule ou un titre en deux mots ne se réanalyse pas.
    const data = parseBriefData({
      practitioner_name: "Nora Whitfield",
      practitioner_line: "Nora Whitfield, LCSW",
    });
    expect(data.practitioner_name).toBe("Nora Whitfield");
    expect(data.practitioner_line).toBe("Nora Whitfield, LCSW");
  });

  it("un nom trop long ne casse pas la réouverture du brief", () => {
    // `parseBriefData` retombe sur `{}` plutôt que de jeter : une donnée libre
    // corrompue ne doit pas empêcher de rouvrir son brief.
    expect(parseBriefData({ practitioner_name: "x".repeat(200) })).toEqual({});
  });
});
