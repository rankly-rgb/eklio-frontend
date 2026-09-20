import { describe, expect, it } from "vitest";
import { allowedClaimsFrom, checkUnbackedClaims } from "@/lib/ethics/claims";

/*
 * ⚠ CE FICHIER EST NÉ LE 20 SEPTEMBRE, et son absence était elle-même un
 * signe : les seules sondes de `claims.ts` vivaient dans
 * `lib/brief/__tests__/license-state.test.ts`, c'est-à-dire chez son appelant
 * de test — le seul qu'il ait jamais eu. Un module de refus sans fichier de
 * sondes à son nom est un module que personne ne regarde en face.
 */

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ LE VOCABULAIRE DÉRIVE DU CATALOGUE — IL NE LE RECOPIE PLUS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mesuré le 20 septembre : « PSYCH », la poignée de `licensed_psychologist`,
 * était dans `license_types` et PAS dans `KNOWN_CREDENTIALS`. Une ligne
 * portant « Gary Whitfiled, PSYCH » passait donc la garde — sur un brief
 * `lcsw`, c'est-à-dire en revendiquant le titre d'un AUTRE board.
 *
 * Une liste recopiée à côté d'une table est une liste qui diverge. Celle-ci
 * ne le peut plus : les sigles du catalogue sont dérivés.
 */
describe("⚠ un sigle du catalogue entre dans la garde sans qu'on y pense", () => {
  /* Le catalogue réel, relevé en base le 20 septembre. */
  const CATALOGUE = [
    { id: "lcsw", label: "LCSW", description: "Licensed Clinical Social Worker" },
    { id: "licensed_psychologist", label: "PSYCH", description: "Licensed Psychologist" },
    { id: "lmft", label: "LMFT", description: "Licensed Marriage and Family Therapist" },
  ];
  const MATRICE = [{ abbreviation: "LP" }, { abbreviation: null }];

  it("⚠ LE CAS RÉEL : « Gary Whitfiled, PSYCH » sur un brief lcsw est REFUSÉ", () => {
    const autorise = allowedClaimsFrom("lcsw", CATALOGUE, null, [], MATRICE);
    const violations = checkUnbackedClaims("Gary Whitfiled, PSYCH", autorise);
    expect(violations).toHaveLength(1);
    expect(violations[0].excerpt).toBe("PSYCH");
  });

  it("le même sigle sur le brief QUI LE PORTE passe", () => {
    const autorise = allowedClaimsFrom("licensed_psychologist", CATALOGUE, null, [], MATRICE);
    expect(checkUnbackedClaims("Gary Whitfiled, PSYCH", autorise)).toEqual([]);
  });

  /*
   * ⚠ LE SIGLE APPARTIENT AU COUPLE, donc la matrice fait partie du
   * vocabulaire. Le Texas écrit « LP » là où le catalogue porte « PSYCH » : un
   * sigle publié par un board et absent de la garde serait le même trou, un
   * cran plus loin.
   */
  it("un sigle publié par un ÉTAT entre aussi dans le vocabulaire", () => {
    const autorise = allowedClaimsFrom("lcsw", CATALOGUE, null, [], MATRICE);
    expect(autorise.catalogAcronyms).toContain("LP");
    expect(checkUnbackedClaims("Gary Whitfiled, LP", autorise)).toHaveLength(1);
  });

  /*
   * ⚠ LA DÉRIVATION N'A RIEN RETIRÉ. `KNOWN_CREDENTIALS` porte ce que la table
   * ne vend pas ; la fondre dans le catalogue aurait rétréci la garde.
   */
  it("⚠ ce que le catalogue NE porte PAS reste attrapé", () => {
    const autorise = allowedClaimsFrom("lcsw", CATALOGUE, null, [], MATRICE);
    expect(autorise.catalogAcronyms).not.toContain("NCC");
    expect(checkUnbackedClaims("I am also an NCC.", autorise)).toHaveLength(1);
  });

  it("⚠ et un titre AJOUTÉ au catalogue entre dans la garde, sans toucher au code", () => {
    /*
     * La sonde qui donne son sens au lot : on ajoute une ligne au catalogue,
     * rien d'autre, et le sigle devient détectable.
     */
    const demain = [...CATALOGUE, { id: "lep", label: "LEP", description: "Licensed Educational Psychologist" }];
    const avant = allowedClaimsFrom("lcsw", CATALOGUE, null, [], []);
    const apres = allowedClaimsFrom("lcsw", demain, null, [], []);

    expect(checkUnbackedClaims("Gary Whitfiled, LEP", avant)).toEqual([]);
    expect(checkUnbackedClaims("Gary Whitfiled, LEP", apres)).toHaveLength(1);
  });
});
