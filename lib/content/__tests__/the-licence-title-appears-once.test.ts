import { describe, expect, it } from "vitest";
import { checkLicence, type PostUnderCheck } from "@/lib/content/month-checks";
import { licenceMention, normaliseLicenceNumber, repeatedLicenceTitles } from "@/lib/content/licence";
import { normaliseLicenceInPatch } from "@/lib/site/patch";

/*
 * ── ⚠ « LMFT LMFT 123456 » SUR TOUTES LES CARTES (F73) ──────────────────
 *
 * Trouvé sur le mois de décembre local, par relecture et non par un contrôle :
 * un numéro saisi avec son sigle doublait la mention, et `licence.missing` se
 * taisait, puisque la mention — doublée — figurait bien au pied.
 *
 * Trois serrures : la saisie normalise, la mention relit sans le sigle (pour les
 * numéros déjà en base), et le contrôle du pied compte le sigle.
 */

describe("à la saisie, le sigle tapé devant le numéro est retiré", () => {
  it.each([
    ["LMFT 123456", "123456"],
    ["lmft 123456", "123456"],
    ["LMFT #123456", "123456"],
    ["LMFT: 123456", "123456"],
    ["LMFT-123456", "123456"],
    ["LMFT123456", "123456"],
    ["LMFT LMFT 123456", "123456"],
    ["PSY29384", "29384"],
    ["LCSW 98765", "98765"],
  ])("« %s » → « %s »", (typed, number) => {
    expect(normaliseLicenceNumber(typed)).toBe(number);
  });

  it.each([
    ["123456", "123456"],
    ["0701-004321", "0701-004321"],
    ["A12345", "A12345"],
    ["  98765  ", "98765"],
  ])("un numéro sans sigle reste tel quel : « %s »", (typed, number) => {
    expect(normaliseLicenceNumber(typed)).toBe(number);
  });

  it("un sigle sans numéro derrière n'est pas retiré : la règle de forme de la base jugera", () => {
    expect(normaliseLicenceNumber("LMFT")).toBe("LMFT");
  });

  it("un mot qui COMMENCE par un sigle n'en est pas un", () => {
    expect(normaliseLicenceNumber("LPCA 4455")).toBe("LPCA 4455");
  });

  it("la route d'écriture normalise le champ, et seulement lui", () => {
    const patch = { practice_details: { license_number: "LMFT 123456", city: "Oakland" }, layout: "a" };
    expect(normaliseLicenceInPatch(patch)).toEqual({
      practice_details: { license_number: "123456", city: "Oakland" },
      layout: "a",
    });
    expect(normaliseLicenceInPatch({ layout: "a" })).toEqual({ layout: "a" });
    expect(normaliseLicenceInPatch({ practice_details: { license_number: "" } })).toEqual({
      practice_details: { license_number: "" },
    });
  });
});

describe("la mention ne double jamais le sigle, même sur un numéro déjà enregistré", () => {
  it.each(["123456", "LMFT 123456", "LMFT123456", "lmft #123456"])("« %s »", (stored) => {
    expect(licenceMention({ licenseTypeId: "lmft", licenseNumber: stored })).toBe("LMFT 123456");
  });

  it("l'abréviation de l'État est retirée aussi", () => {
    expect(
      licenceMention({ licenseTypeId: "licensed_psychologist", licenseNumber: "Psychologist 4521", abbreviation: "Psychologist" })
    ).toBe("Psychologist 4521");
  });
});

describe("le pied de carte porte le sigle une seule fois", () => {
  const post = (footer: string): PostUnderCheck =>
    ({ archetype: "single_statement", title: "Rest", cardLine: "Rest", payload: {}, footer }) as PostUnderCheck;

  it("le pied doublé de décembre est refusé, ce que `licence.missing` ne faisait pas", () => {
    const findings = checkLicence([post("Still Water Therapy · LMFT LMFT 123456")], "LMFT LMFT 123456");
    expect(findings.map((f) => f.check)).toEqual(["licence.repeated"]);
  });

  it("un sigle collé au numéro compte aussi", () => {
    expect(repeatedLicenceTitles("Still Water · LMFT LMFT123456", "LMFT 123456")).toEqual(["LMFT"]);
  });

  it("le pied propre passe", () => {
    expect(checkLicence([post("Still Water Therapy · LMFT 123456")], "LMFT 123456")).toEqual([]);
  });

  it("un sigle d'État en plusieurs mots est compté aussi", () => {
    expect(repeatedLicenceTitles("Still Water · Psychologist Psychologist 4521", "Psychologist Psychologist 4521")).toEqual([
      "Psychologist",
    ]);
    expect(repeatedLicenceTitles("Psychologist 4521 · Psychologist 4521", "Psychologist 4521")).toEqual(["Psychologist"]);
  });
});
