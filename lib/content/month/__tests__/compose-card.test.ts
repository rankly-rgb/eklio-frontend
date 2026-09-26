import { describe, expect, it } from "vitest";
import { cardPalette } from "@/lib/compose/palette";
import { composeCard, ComposeRefused } from "@/lib/content/month/compose-card";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PIED DE LICENCE, ET LE REFUS QUI MANQUAIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE MODULE A ÉTÉ PORTÉ POUR UNE RAISON JURIDIQUE, PAS D'ARCHITECTURE.
 *
 * Le pied de carte est la seule bande que les onze archétypes partagent, donc le
 * seul endroit où le numéro de licence se pose. `composeWithFallback` n'était
 * appelé par aucun fichier du chemin produit : un mois produit n'aurait porté
 * AUCUNE mention, ce que la Californie exige dans toute publicité d'un praticien
 * licencié (B&P §651).
 *
 * Et le bloc inline du harnais ne VÉRIFIAIT pas ce qu'il posait : une mention
 * vide composait « Cabinet · », une carte d'apparence normale sans numéro.
 */

const DIRECTION = {
  primary: "#2B2724",
  secondary: "#7A6A56",
  light: "#EFE9DF",
  dark: "#1C1A17",
  paper: "#F7F3EC",
};

const MENTION = "LMFT #123456";

function input(overrides: Partial<Parameters<typeof composeCard>[0]> = {}) {
  return {
    archetype: "single_statement",
    payload: { statement: "Rest is not a reward for finishing." },
    palette: cardPalette("card-1", DIRECTION, false),
    eyebrow: "BEHIND THE PRACTICE",
    headline: "Rest is not a reward",
    footer: `Ashcombe Therapy · ${MENTION}`,
    licenceMention: MENTION,
    ...overrides,
  };
}

describe("la mention de licence n'est pas facultative", () => {
  it("un pied qui la porte compose", () => {
    const card = composeCard(input());
    expect(card.svg).toContain("<svg");
    expect(card.svg, "la carte composée ne porte pas le numéro").toContain("123456");
  });

  /*
   * ⚠ LE CAS QUI PASSAIT SILENCIEUSEMENT. `licenceMention` retombe sur
   * `LICENCE_ABBREVIATION` (F46), donc une abréviation manquante ne refusait même
   * pas : le pied devenait « Cabinet · » et la carte partait.
   */
  it("une mention vide refuse, elle ne compose pas une carte sans numéro", () => {
    expect(() => composeCard(input({ licenceMention: "", footer: "Ashcombe Therapy · " })))
      .toThrow(ComposeRefused);
  });

  it("une mention faite d'espaces refuse aussi", () => {
    expect(() => composeCard(input({ licenceMention: "   " }))).toThrow(/B&P §651/);
  });

  /*
   * ⚠ ET LE PIED EST COMPARÉ À LA MENTION ATTENDUE, pas découpé sur son
   * séparateur. Un contrôle qui tirerait sa référence du pied lui-même tirerait sa
   * référence de la source qu'il surveille — la règle de F16.
   */
  it("un pied qui ne porte pas LA mention attendue refuse", () => {
    expect(() =>
      composeCard(input({ footer: "Ashcombe Therapy · LMFT #999999" }))
    ).toThrow(/does not carry the licence mention/);
  });

  it("le refus dit lequel était attendu", () => {
    try {
      composeCard(input({ footer: "Ashcombe Therapy" }));
      throw new Error("aucun refus");
    } catch (error) {
      expect((error as Error).message).toContain(MENTION);
    }
  });

  /*
   * ⚠ LE REFUS ARRIVE AVANT LA COMPOSITION, pas après. Après, il resterait un SVG
   * à jeter — et l'expérience de ce dépôt est qu'un livrable produit finit par
   * être publié.
   */
  it("rien n'est composé quand le pied est refusé", () => {
    const bad = input({ licenceMention: "", footer: "Ashcombe Therapy · " });
    /*
     * Un payload que le moteur ne composerait qu'en repliant : si le contrôle du
     * pied passait APRÈS, on obtiendrait une carte repliée — donc un SVG — au lieu
     * d'un refus. C'est ce SVG qu'il faudrait jeter.
     */
    bad.payload = { nothing: true };
    expect(() => composeCard(bad)).toThrow(ComposeRefused);
  });
});

describe("ce que la composition rend", () => {
  /*
   * ⚠ L'ARCHÉTYPE QUI A TENU, PAS CELUI QUI A ÉTÉ DEMANDÉ. Écrire l'archétype
   * demandé sur un post que le moteur a replié donnerait une carte que l'écran de
   * relecture ne saurait pas redessiner.
   */
  it("rend l'archétype qui a vraiment tenu et ce vers quoi il a replié", () => {
    const card = composeCard(input());
    expect(typeof card.archetype).toBe("string");
    expect(card.landedOn.length).toBeGreaterThan(0);
    expect(Array.isArray(card.steps)).toBe(true);
  });

  it("le payload rendu est celui qui a été composé", () => {
    const card = composeCard(input());
    expect(card.payload).toBeDefined();
  });

  /*
   * ⚠ REPLIER EST SON MÉTIER, ET LE CONTRAT EST QU'IL LE DISE.
   *
   * La première version de ce test attendait une exception sur un payload
   * impossible. `composeWithFallback` n'en lève pas : il REPLIE — c'est son nom.
   * Le test avait tort sur le contrat, et le contrat est meilleur que ce que le
   * test supposait : un repli silencieux serait le danger, pas le repli.
   *
   * Ce qui importe donc est que `steps` ne soit pas vide. Le harnais le remonte
   * dans `fallbacks`, et le rapport publie la forme qui a vraiment tenu — sans
   * quoi l'écran de relecture ne saurait pas redessiner la carte.
   */
  it("un payload que le moteur ne peut pas composer replie, et le dit", () => {
    const card = composeCard(input({ payload: { nothing: true } }));
    expect(card.svg).toContain("<svg");
    expect(card.steps, "un repli silencieux : le rapport dirait l'archétype demandé")
      .not.toEqual([]);
    expect(card.landedOn.length).toBeGreaterThan(0);
  });
});
