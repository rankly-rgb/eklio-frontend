import { describe, expect, it } from "vitest";
import { cachedPrefix, archetypeInstruction, MODEL_WRITTEN_ARCHETYPES } from "@/lib/content/generate/copy-batch";

/*
 * ── ⚠ LES TROIS CLASSES QUI FAISAIENT LE GROS DES REFUS ─────────────────
 *
 * Mesuré sur seize essais (2026-09-24/25), conformité au premier appel
 * 46/102 : `text.unfinished` 62 constats, `carousel.samePanel` 14,
 * `text.clinicalClaim` 10. Aucune des trois n'était une règle manquante —
 * chacune était écrite quelque part et portait sur la mauvaise surface.
 *
 * ⚠ CE FICHIER EXISTE PARCE QU'UNE CONSIGNE N'A PAS DE TEST NATUREL. Un
 * contrôle se teste sur son verdict ; une consigne de prompt ne se teste que
 * sur sa PRÉSENCE, et c'est précisément ce qui la rend facile à perdre dans un
 * remaniement. Trois consignes qui ont coûté quatorze essais ne repartent pas
 * sans que quelque chose tombe.
 */

const BRAND = {
  practiceName: "Still Water Counseling",
  voice: "plain, unhurried",
  offLimits: "",
  ethicsRules: [],
} as unknown as Parameters<typeof cachedPrefix>[0];

const prefixFor = (archetype: string) => cachedPrefix(BRAND, archetype)[0].text as string;

describe("la complétude est exigée de toutes les lignes, pas de la seule ligne de carte", () => {
  const text = prefixFor("surface_and_beneath");

  it("la règle nomme les surfaces du payload", () => {
    expect(text).toContain("EVERY WRITTEN LINE MUST BE FINISHED");
    for (const surface of ["label", "statement", "gloss", "panel"]) {
      expect(text, `la règle de complétude ne nomme pas « ${surface} »`).toContain(surface);
    }
  });

  /*
   * ⚠ LES EXEMPLES SONT DE VRAIS REFUS, et c'est ce qui les rend enseignants :
   * ils finissent tous sur un mot de CONTENU, pas sur un mot outil. La consigne
   * d'avant n'enseignait que les mots outils.
   */
  it("les exemples sont les refus mesurés, et ils finissent sur un mot de contenu", () => {
    for (const refused of [
      "The cost of unshakeable",
      "Function isn't the same",
      "Stuck between one chapter",
      "When your life script",
    ]) {
      expect(text, `l'exemple « ${refused} » a disparu de la consigne`).toContain(refused);
    }
  });

  it("le piège est nommé : ce qui ouvre un complément", () => {
    for (const trap of ["the same", "more than", "between", "the cost of"]) {
      expect(text).toContain(trap);
    }
  });
});

describe("la règle du carrousel est dite dans la forme du carrousel", () => {
  const shape = archetypeInstruction("carousel");

  /*
   * ⚠ DANS LA FORME, PAS DANS LES RÈGLES GÉNÉRALES. La règle ne vaut que pour
   * cet archétype ; la mettre ailleurs la ferait lire par les dix autres et
   * ignorer par celui qu'elle concerne.
   */
  it("elle borne les volets qui héritent du titre", () => {
    expect(shape).toContain("AT MOST ONE panel");
    expect(shape).toContain("single_statement");
    expect(shape.toLowerCase()).toContain("the carousel's own card_line");
  });

  it("elle dit AUSSI que deux volets ne peuvent pas porter le même payload", () => {
    expect(shape.toLowerCase()).toContain("repeats another panel's payload");
  });

  /*
   * ⚠ ET L'EXEMPLE RESPECTE LA RÈGLE QU'IL ILLUSTRE. Un exemple qui la
   * viole enseigne l'inverse — c'est ce qui est arrivé aux exemples de
   * carrousel une première fois (F32).
   */
  it("l'exemple ne porte qu'un seul volet héritant", () => {
    const inner = [...archetypeInstruction("carousel").matchAll(/"archetype_key":\s*"(\w+)"/g)]
      .map((m) => m[1])
      .filter((k) => k !== "carousel");
    expect(inner.length, "l'exemple du carrousel n'a plus de volets").toBeGreaterThanOrEqual(3);
    expect(inner.filter((k) => k !== "single_statement").length).toBeLessThanOrEqual(1);
  });
});

describe("la nuance clinique porte sur toutes les surfaces", () => {
  const text = prefixFor("single_statement");

  /*
   * ⚠ ELLE ÉTAIT DANS LE BLOC LÉGENDE, donc lue comme une règle de légende,
   * alors que `checkClinicalClaim` lit la ligne de carte, les énoncés et
   * l'alternatif. Trois des dix constats étaient sur l'alternatif, deux sur la
   * ligne de carte.
   */
  it("elle le dit explicitement", () => {
    expect(text).toContain("EVERY SURFACE");
    expect(text).toContain("not only the caption");
  });

  it("les deux formes sont côte à côte", () => {
    expect(text).toContain('"EMDR helps"');
    expect(text).toContain('"EMDR can help"');
  });

  it("la nuance est énumérée telle que le contrôle la connaît", () => {
    for (const hedge of ["can", "may", "often", "sometimes", "for some", "is designed to"]) {
      expect(text, `la nuance « ${hedge} » manque à la consigne`).toContain(hedge);
    }
  });

  /*
   * ⚠ ET LE CONTOURNEMENT DU FAUX POSITIF EST DIT COMME TEL. `checkClinicalClaim`
   * refuse « Not all change is trauma » — une phrase dé-pathologisante — et
   * accepte « Change is not always trauma ». Voir F39 : la correction n'est pas
   * dans le prompt, elle est dans le contrôle, et elle attend une décision.
   */
  it("l'ordre des mots qui survit au contrôle est enseigné", () => {
    expect(text).toContain("Not every X is Y");
    expect(text).toContain("is not trauma");
  });
});

/*
 * ⚠ ET LE PRÉFIXE RESTE CACHEABLE. Il est envoyé une fois par archétype et par
 * lot ; un préfixe qui gonfle sans fin coûte sa création à chaque nouveau kit.
 */
describe("le préfixe reste d'une taille raisonnable", () => {
  it.each(MODEL_WRITTEN_ARCHETYPES)("%s tient sous 14 000 caractères", (archetype) => {
    expect(prefixFor(archetype).length).toBeLessThan(14_000);
  });
});
