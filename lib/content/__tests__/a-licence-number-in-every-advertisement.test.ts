import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkMonth, checkLicence, type PostUnderCheck } from "@/lib/content/month-checks";
import { licenceMention, licenceMissingMessage, footerCarriesLicence } from "@/lib/content/licence";
import { cardBands } from "@/lib/content/review";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── ⚠ QUATRE CENTS POSTS PRODUITS, ZÉRO NUMÉRO DE LICENCE ───────────────
 *
 * Trouvé par l'audit du corpus (F35). Californie B&P §4980.44 (LMFT), §4996.2
 * (LCSW) et §4999.80 (LPCC) exigent le TYPE et le NUMÉRO de licence dans
 * **toute** publicité ; d'autres États imposent l'équivalent. Chacun des
 * quatre cents posts déjà produits était une infraction publicitaire.
 *
 * ⚠ ET CE N'ÉTAIT PAS UN DÉFAUT DE CONTRÔLE : `project_briefs` n'avait pas de
 * colonne pour le numéro. Aucun contrôle ne peut exiger ce qu'il n'y a rien à
 * mettre — c'est pourquoi le trou a tenu quatre cents posts, et pourquoi il se
 * corrige par une migration avant de se corriger par un contrôle.
 */
const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

describe("la mention se construit, ou elle n'existe pas", () => {
  it("abréviation et numéro, séparés d'une espace", () => {
    expect(licenceMention({ licenseTypeId: "lmft", licenseNumber: "12345" })).toBe("LMFT 12345");
    expect(licenceMention({ licenseTypeId: "lcsw", licenseNumber: "  98765  " })).toBe("LCSW 98765");
  });

  /*
   * ⚠ LA MATRICE PASSE AVANT LE REPLI. `license_type_states.abbreviation`
   * existe pour qu'un board qui imprime autrement ait sa valeur : la
   * Californie écrit `PSY` là où un autre État écrira autrement.
   */
  it("l'abréviation de l'État l'emporte sur celle du catalogue", () => {
    expect(licenceMention({ licenseTypeId: "licensed_psychologist", licenseNumber: "29384" }))
      .toBe("PSY 29384");
    expect(licenceMention({
      licenseTypeId: "licensed_psychologist", licenseNumber: "29384",
      abbreviation: "Licensed Psychologist",
    })).toBe("Licensed Psychologist 29384");
  });

  /*
   * ⚠ `null` N'EST PAS UNE MENTION VIDE : c'est un mois qu'on ne génère pas.
   * Rendre une chaîne vide ferait passer le contrôle en imprimant rien, ce qui
   * est exactement l'état des quatre cents posts déjà produits.
   */
  it("sans numéro, il n'y a pas de mention", () => {
    expect(licenceMention({ licenseTypeId: "lmft", licenseNumber: null })).toBeNull();
    expect(licenceMention({ licenseTypeId: "lmft", licenseNumber: "   " })).toBeNull();
    expect(licenceMention({ licenseTypeId: null, licenseNumber: "12345" })).toBeNull();
  });

  /*
   * ⚠ ET LE MESSAGE NOMME LE CHAMP. « Le brief est incomplet » envoie chercher
   * dans onze champs ; « il manque `license_number` » se règle en trente
   * secondes.
   */
  it("le refus nomme le champ manquant et la règle", () => {
    const why = licenceMissingMessage({ licenseTypeId: "lmft", licenseNumber: null })!;
    expect(why).toContain("license_number");
    expect(why).toContain("TOUTE publicité");
    expect(licenceMissingMessage({ licenseTypeId: "lmft", licenseNumber: "12345" })).toBeNull();
  });
});

describe("le pied de carte la porte", () => {
  /*
   * ⚠ LE PIED EST LA SEULE BANDE PRÉSENTE SUR LES ONZE ARCHÉTYPES, déjà en
   * mono, déjà petite, et elle porte déjà le nom du cabinet. Le surtitre
   * entrerait en concurrence avec le libellé d'intention ; le contenu volerait
   * la place du diagramme.
   */
  it("nom du cabinet, point médian, mention", () => {
    const bands = cardBands(
      { theme: "t", title: "Rest is not a reward", topic: null } as never,
      "Willow Clinic",
      "LMFT 12345"
    );
    expect(bands.footer).toBe("Willow Clinic · LMFT 12345");
  });

  it("sans mention, le pied est celui d'avant", () => {
    const bands = cardBands(
      { theme: "t", title: "Rest is not a reward", topic: null } as never,
      "Willow Clinic"
    );
    expect(bands.footer).toBe("Willow Clinic");
  });

  /*
   * ⚠ ON CHERCHE LA MENTION ENTIÈRE, PAS SES MORCEAUX. Un pied portant
   * « LMFT » sans numéro, ou le numéro sans le titre, satisferait deux tests
   * séparés et aucune règle de board.
   */
  it("un morceau de mention n'est pas la mention", () => {
    expect(footerCarriesLicence("Willow Clinic · LMFT 12345", "LMFT 12345")).toBe(true);
    expect(footerCarriesLicence("Willow Clinic · LMFT", "LMFT 12345")).toBe(false);
    expect(footerCarriesLicence("Willow Clinic · 12345", "LMFT 12345")).toBe(false);
    expect(footerCarriesLicence(undefined, "LMFT 12345")).toBe(false);
  });
});

/*
 * ── ⚠ LE MOIS DE RÉFÉRENCE EST REFUSÉ POUR CETTE RAISON ─────────────────
 *
 * `month-corin` passe tous les autres contrôles — c'est le mois vert gelé de
 * F34, légende comprise. Il a été produit avant que la mention existe, et il
 * ne la porte pas : trente posts, trente refus. C'est la preuve que le
 * contrôle mord sur du contenu réel et pas seulement sur une fixture écrite
 * pour lui.
 */
describe("un mois produit avant la mention est refusé", () => {
  const posts: PostUnderCheck[] = JSON.parse(
    readFileSync("lib/content/__tests__/fixtures/month-corin.json", "utf8")
  );

  it("les trente posts sont refusés, un par un", () => {
    const findings = checkLicence(posts, "LMFT 12345");
    expect(findings).toHaveLength(30);
    expect(findings[0].check).toBe("licence.missing");
    expect(findings[0].detail).toContain("LMFT 12345");
  });

  it("et le contrôle de mois le refuse pour cette seule raison", () => {
    const findings = checkMonth({
      posts, direction: DIRECTION, wanted: 30,
      modalities: ["emdr"], practiceName: "Corin Aldhelm Therapy",
      licenceMention: "LMFT 12345",
    });
    expect([...new Set(findings.map((f) => f.check))]).toEqual(["licence.missing"]);
  });

  /*
   * ⚠ ET SANS MENTION, LE CONTRÔLE SE TAIT. Un contrôle qui refuserait tout
   * faute de référence se ferait relâcher au premier mois perdu ; le refus vit
   * à la génération, qui ne part pas sans le champ.
   */
  it("sans mention au brief, il se tait — le refus est ailleurs", () => {
    expect(checkLicence(posts, undefined)).toEqual([]);
    const findings = checkMonth({
      posts, direction: DIRECTION, wanted: 30,
      modalities: ["emdr"], practiceName: "Corin Aldhelm Therapy",
    });
    expect(findings).toEqual([]);
  });

  /* ⚠ Et un mois qui la porte passe. */
  it("le même mois, pied complété, passe", () => {
    const withFooter = posts.map((p) => ({ ...p, footer: "Corin Aldhelm Therapy · LMFT 12345" }));
    expect(checkLicence(withFooter, "LMFT 12345")).toEqual([]);
  });
});

describe("la génération refuse avant de dépenser", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  /*
   * ⚠ AVANT LE TIRAGE ET AVANT LE LOT. Un contrôle qui refuserait le mois à la
   * fin aurait laissé payer soixante-douze appels pour un mois qu'on savait
   * irrecevable avant de commencer.
   */
  it("le refus est posé avant le tirage", () => {
    const refusal = SOURCE.indexOf("const licenceRefusal = licenceMissingMessage(licence);");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(SOURCE.indexOf("const perFamily = Math.ceil(CANDIDATES"));
    expect(refusal).toBeLessThan(SOURCE.indexOf("client.messages.batches.create"));
  });

  it("le pied composé porte la mention, sur les onze archétypes", () => {
    expect(SOURCE).toContain("footer: `${practiceName} · ${mention}`,");
  });

  it("et le contrôle de mois la reçoit", () => {
    expect(SOURCE).toContain("licenceMention,");
  });
});
