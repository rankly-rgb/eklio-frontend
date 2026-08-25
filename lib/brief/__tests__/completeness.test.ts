import { describe, expect, it } from "vitest";
import {
  isBriefComplete,
  missingBriefSteps,
} from "@/lib/brief/completeness";
import { parseStoredBriefDraft, type BriefDraft } from "@/lib/brief/schemas";

/*
 * Contrat de la complétude du brief — ce qui décide si le bouton de
 * génération des directions est atteignable.
 *
 * Régression corrigée ici : la complétude était déduite de
 * `project_briefs.completed_steps`, qui n'enregistre que les clics sur
 * « Continue ». L'autosave écrit les réponses sans y toucher, donc un brief
 * entièrement rempli pouvait être déclaré incomplet — et l'écran de
 * récapitulatif, seul porteur du bouton, n'était lui-même accessible qu'une
 * fois ce même compteur avancé. Le praticien restait bloqué sans rien pour le
 * lui dire.
 *
 * Ces tests figent la règle : la complétude se lit dans les DONNÉES, sur les
 * clés anglaises du Lot 2, anciennes clés françaises normalisées comprises.
 */

/* Un brief entièrement renseigné, clés anglaises. */
const COMPLETE_DATA = {
  practice_name: "Hearth Counseling",
  license_type: "lmft",
  offer: "Couples therapy and weekend intensives.",
  problem_addressed: "Partners who keep having the same argument.",
  client_gains: "A place to look at what the argument keeps circling.",
  ideal_client: "Partners in their thirties, tired of the same loop.",
  emotions: ["safety", "steadiness", "warmth"],
  tone_reserved_expressive: 2,
  tone_warm_clinical: 2,
  tone_classic_contemporary: 3,
  tone_minimal_rich: 3,
  color_families: ["warm_neutrals"],
  type_style: "editorial_serif",
  character_level: "confident",
  site_goal: "book_consultations",
  primary_action: "Book a consultation",
  pages_wanted: ["home", "about", "approach", "contact"],
  available_proof: ["credentials"],
};

function draftFrom(data: Record<string, unknown>): BriefDraft {
  // Même lecture que les écrans : normalisation FR → EN puis validation.
  return parseStoredBriefDraft(data);
}

describe("complétude — la régression corrigée", () => {
  /*
   * LE cas du bug. `completed_steps` valait [1,2,3,4,5,6] alors que les sept
   * étapes étaient renseignées : l'ancienne condition
   * `STEP_NUMBERS.every((s) => completed_steps.includes(s))` renvoyait faux et
   * scellait la génération.
   */
  it("déclare complet un brief dont les données le sont, quoi qu'en dise completed_steps", () => {
    const draft = draftFrom(COMPLETE_DATA);

    expect(missingBriefSteps(draft)).toEqual([]);
    expect(isBriefComplete(draft)).toBe(true);

    // La trace de navigation n'entre pas dans le calcul : elle n'est même pas
    // un paramètre de la fonction.
    expect(isBriefComplete.length).toBe(1);
  });

  it("reste vrai quand l'étape 7 a été remplie par l'autosave, sans clic sur Continue", () => {
    // L'autosave n'ajoute jamais rien à completed_steps ; les réponses, elles,
    // sont bien en base.
    expect(isBriefComplete(draftFrom(COMPLETE_DATA))).toBe(true);
  });
});

describe("complétude — lecture sur les clés anglaises", () => {
  it("normalise un brief enregistré sous les anciennes clés françaises", () => {
    const legacy = {
      nom_activite: "Hearth Counseling",
      metier: "lmft",
      offre_principale: "Couples therapy and weekend intensives.",
      probleme_resolu: "Partners who keep having the same argument.",
      resultat_client: "A place to look at what the argument keeps circling.",
      cible_description: "Partners in their thirties.",
      emotions: ["safety", "steadiness", "warmth"],
      ton_sobre_audacieux: 2,
      ton_chaleureux_professionnel: 2,
      ton_classique_contemporain: 3,
      ton_minimal_expressif: 3,
      familles_chromatiques: ["warm_neutrals"],
      style_typographique: "editorial_serif",
      niveau_caractere: "confident",
      objectif_site: "book_consultations",
      action_attendue: "Book a consultation",
      pages_souhaitees: ["home", "about"],
      preuves_disponibles: ["credentials"],
    };

    expect(missingBriefSteps(draftFrom(legacy))).toEqual([]);
  });

  it("normalise aussi la branche « other » du type de licence", () => {
    const legacy = {
      ...COMPLETE_DATA,
      metier: "autre",
      metier_autre: "Licensed art therapist",
      license_type: undefined,
    };
    delete (legacy as Record<string, unknown>).license_type;

    expect(missingBriefSteps(draftFrom(legacy))).toEqual([]);
  });
});

describe("complétude — ce qui manque est nommé précisément", () => {
  it("signale l'étape 7 quand primary_action manque", () => {
    // État réel du projet bloqué : tout est là sauf l'action principale.
    const data = { ...COMPLETE_DATA };
    delete (data as Record<string, unknown>).primary_action;

    expect(missingBriefSteps(draftFrom(data))).toEqual([7]);
    expect(isBriefComplete(draftFrom(data))).toBe(false);
  });

  it("rattache chaque champ requis manquant à son étape", () => {
    const cases: [string, number][] = [
      ["practice_name", 1],
      ["offer", 1],
      ["problem_addressed", 2],
      ["client_gains", 2],
      ["ideal_client", 3],
      ["emotions", 4],
      ["color_families", 5],
      ["type_style", 6],
      ["character_level", 6],
      ["site_goal", 7],
      ["primary_action", 7],
    ];

    for (const [field, step] of cases) {
      const data = { ...COMPLETE_DATA };
      delete (data as Record<string, unknown>)[field];
      expect(missingBriefSteps(draftFrom(data))).toContain(step);
    }
  });

  it("signale les sept étapes sur un brief vide", () => {
    expect(missingBriefSteps(draftFrom({}))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(isBriefComplete({})).toBe(false);
  });

  it("rend les étapes manquantes en ordre croissant, sans doublon", () => {
    const data = { ...COMPLETE_DATA };
    delete (data as Record<string, unknown>).practice_name;
    delete (data as Record<string, unknown>).ideal_client;
    delete (data as Record<string, unknown>).primary_action;

    expect(missingBriefSteps(draftFrom(data))).toEqual([1, 3, 7]);
  });

  it("refuse un brief dont une réponse est présente mais invalide", () => {
    // 4 émotions au lieu des 3 exigées : l'étape 4 n'est pas satisfaite.
    const draft = draftFrom({
      ...COMPLETE_DATA,
      emotions: ["safety", "steadiness", "warmth", "calm"],
    });

    expect(missingBriefSteps(draft)).toEqual([4]);
  });
});
