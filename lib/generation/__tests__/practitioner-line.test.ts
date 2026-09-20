import { describe, expect, it } from "vitest";
import { practitionerLineFor } from "@/lib/generation/pipeline";
import type { BriefBundle } from "@/lib/data/brief";
import type { Catalog } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LA POIGNÉE DU CATALOGUE NE PART PAS SUR UNE PAGE PUBLIQUE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Dixième occurrence de la classe, mesurée le 20 septembre. `practitioner_line`
 * était composée depuis `license_types.label` — une POIGNÉE INTERNE. Pour
 * `licensed_psychologist` elle vaut « PSYCH », qu'aucun board ne publie, et ce
 * champ part en carte de visite, en signature d'e-mail, en PDF, dans le prompt
 * du site et sur le profil d'annuaire. C'est la fuite de
 * `site_spec_credential_line()`, au même endroit d'un cran plus haut.
 *
 * Le catalogue et la matrice ci-dessous sont les VRAIES lignes, relevées en
 * base le 20 septembre.
 */
const CATALOG = {
  licenseTypes: [
    { id: "lcsw", label: "LCSW", description: "Licensed Clinical Social Worker" },
    { id: "licensed_psychologist", label: "PSYCH", description: "Licensed Psychologist" },
    { id: "lmft", label: "LMFT", description: "Licensed Marriage and Family Therapist" },
  ],
  licenseTypeStates: [
    { license_type_id: "lcsw", state_code: "CA", abbreviation: "LCSW", verified_at: "2026-09-17T00:00:00+00:00" },
    { license_type_id: "licensed_psychologist", state_code: "CA", abbreviation: null, verified_at: "2026-09-17T00:00:00+00:00" },
    { license_type_id: "lmft", state_code: "OR", abbreviation: null, verified_at: null },
  ],
} as unknown as Catalog;

const bundle = (brief: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  ({ brief, data }) as unknown as BriefBundle;

describe("⚠ la ligne praticienne porte le titre publié par l'État", () => {
  it("⚠ LE CAS QUI A FAIT ÉCRIRE CE FICHIER : PSYCH ne sort jamais", () => {
    const ligne = practitionerLineFor(
      bundle({ license_type_id: "licensed_psychologist", state: "CA" }, { practitioner_name: "Gary Whitfiled" }),
      CATALOG,
      "Gary consulting"
    );
    expect(ligne).not.toContain("PSYCH");
    /* La Californie ne publie aucun sigle : ce sont les mots qui s'écrivent. */
    expect(ligne).toBe("Gary Whitfiled, Licensed Psychologist");
  });

  it("un couple VÉRIFIÉ donne son sigle", () => {
    expect(
      practitionerLineFor(
        bundle({ license_type_id: "lcsw", state: "CA" }, { practitioner_name: "Gary Whitfiled" }),
        CATALOG,
        "Gary consulting"
      )
    ).toBe("Gary Whitfiled, LCSW");
  });

  /*
   * ⚠ UN COUPLE NON RELEVÉ N'A PAS DE SIGLE — MÊME QUAND LA POIGNÉE EN A UN.
   * L'Oregon n'est pas vérifié : la poignée dit « LMFT », le board n'a rien
   * publié que nous ayons lu. On écrit donc les mots. Deux des trois lignes
   * réelles en base sont exactement ce cas.
   */
  it("⚠ un couple NON vérifié écrit les mots, pas la poignée", () => {
    const ligne = practitionerLineFor(
      bundle({ license_type_id: "lmft", state: "OR" }, { practitioner_name: "Nora Whitfield" }),
      CATALOG,
      "Ember consulting"
    );
    expect(ligne).toBe("Nora Whitfield, Licensed Marriage and Family Therapist");
  });

  it("ce qu'elle a écrit elle-même passe avant tout", () => {
    expect(
      practitionerLineFor(
        bundle(
          { license_type_id: "lcsw", state: "CA" },
          { practitioner_name: "Gary", practitioner_line: "Gary W., LCSW, CADC" }
        ),
        CATALOG,
        "Gary consulting"
      )
    ).toBe("Gary W., LCSW, CADC");
  });

  it("sans licence, le nom seul — jamais un titre inventé", () => {
    expect(
      practitionerLineFor(
        bundle({ license_type_id: null, state: "CA" }, { practitioner_name: "Gary Whitfiled" }),
        CATALOG,
        "Gary consulting"
      )
    ).toBe("Gary Whitfiled");
  });

  it("sans nom, le repli nomme le cabinet — et c'est un repli, pas un choix", () => {
    expect(
      practitionerLineFor(bundle({ license_type_id: "lcsw", state: "CA" }), CATALOG, "Ember consulting")
    ).toBe("Ember consulting, LCSW");
  });

  /*
   * ⚠ LA GARDE DE CLASSE : aucune poignée du catalogue ne doit pouvoir sortir
   * d'ici, quel que soit le titre. Sondée sur TOUS les titres à la fois, pour
   * qu'un titre ajouté demain soit couvert sans qu'on y pense.
   */
  it("⚠ AUCUN titre du catalogue ne sort par sa poignée quand l'État n'en publie pas", () => {
    for (const type of CATALOG.licenseTypes) {
      const ligne = practitionerLineFor(
        bundle({ license_type_id: type.id, state: "OR" }, { practitioner_name: "Test Name" }),
        CATALOG,
        "Test consulting"
      );
      expect(ligne, `${type.id} a laissé sortir sa poignée`).toBe(`Test Name, ${type.description}`);
    }
  });
});
