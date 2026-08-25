import { describe, expect, it } from "vitest";
import { resolveKitScope } from "@/lib/kit/tiers";

/*
 * La couture du gating par tier (le branchement réel arrive au Lot 4).
 *
 * Ce que ces tests figent, c'est que le périmètre du livrable est bien
 * déterminé PAR LE TIER et par lui seul : le jour où le Lot 4 remplace
 * `DEFAULT_KIT_TIER` par le tier acheté, la génération suivra sans être
 * touchée.
 */

const ALL_PAGES = [
  "home",
  "about",
  "approach",
  "specialties",
  "fees",
  "faq",
  "contact",
  "blog",
];

describe("resolveKitScope — plafond de pages par tier", () => {
  it("Signature rend toutes les pages demandées", () => {
    const scope = resolveKitScope("signature", ALL_PAGES);

    expect(scope.pages).toHaveLength(8);
    expect(scope.omittedPages).toEqual([]);
    expect(scope.includeSocialTemplates).toBe(true);
  });

  it("Practice plafonne à 6 pages et garde les specs sociales", () => {
    const scope = resolveKitScope("practice", ALL_PAGES);

    expect(scope.pages).toHaveLength(6);
    expect(scope.includeSocialTemplates).toBe(true);
    expect(scope.omittedPages).toEqual(["faq", "blog"]);
  });

  it("Starter plafonne à 3 pages et n'inclut pas les specs sociales", () => {
    const scope = resolveKitScope("starter", ALL_PAGES);

    expect(scope.pages).toEqual(["home", "about", "approach"]);
    expect(scope.includeSocialTemplates).toBe(false);
    // Ce qui tombe est nommé, pas perdu en silence.
    expect(scope.omittedPages).toEqual([
      "contact",
      "specialties",
      "fees",
      "faq",
      "blog",
    ]);
  });

  it("ne rabote rien quand le praticien demande moins que le plafond", () => {
    const scope = resolveKitScope("starter", ["home", "contact"]);

    expect(scope.pages).toEqual(["home", "contact"]);
    expect(scope.omittedPages).toEqual([]);
  });
});

describe("resolveKitScope — normalisation des pages demandées", () => {
  it("remet les pages dans l'ordre éditorial, quel que soit l'ordre reçu", () => {
    expect(resolveKitScope("signature", ["blog", "contact", "home"]).pages).toEqual([
      "home",
      "contact",
      "blog",
    ]);
  });

  it("dédoublonne", () => {
    expect(
      resolveKitScope("signature", ["home", "home", "about"]).pages
    ).toEqual(["home", "about"]);
  });

  it("ignore une valeur qui n'est pas une page du produit", () => {
    expect(
      resolveKitScope("signature", ["home", "boutique", "about"]).pages
    ).toEqual(["home", "about"]);
  });

  it("retombe sur un site minimal quand aucune page n'a été cochée", () => {
    // Générer zéro page serait un livrable vide, pas un livrable minimal.
    for (const pages of [undefined, [], ["inconnu"]]) {
      expect(resolveKitScope("signature", pages).pages).toEqual([
        "home",
        "about",
        "approach",
        "contact",
      ]);
    }
  });

  it("applique le plafond du tier au repli comme au reste", () => {
    expect(resolveKitScope("starter", []).pages).toEqual([
      "home",
      "about",
      "approach",
    ]);
  });
});
