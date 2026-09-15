import { describe, expect, it } from "vitest";
import {
  POSITIONING_MIN_CHARS,
  resumeStep,
  stepIssue,
  withCompletedStep,
  type StepDraft,
} from "@/lib/brief/flow";
import type { ToneCards } from "@/lib/generation/how-you-work-shapes";

/*
 * Les règles de validation du brief. Elles décident de ce qui bloque un
 * praticien à une étape : c'est exactement le genre de code qu'on ne veut pas
 * découvrir cassé en production.
 */

function draft(overrides: Partial<StepDraft> = {}): StepDraft {
  return {
    practice_name: null,
    license_type_id: null,
    degree_id: null,
    specialty_ids: [],
    city: null,
    state: null,
    positioning: null,
    problem_card_ids: [],
    gain_card_ids: [],
    client_persona_ids: [],
    session_style_ids: [],
    not_a_fit_ids: [],
    not_a_fit_text: null,
    modality_ids: [],
    modality_prominence: null,
    referral_quote: null,
    prior_career: null,
    prior_career_public: false,
    tone_card_id: null,
    palette_family_ids: [],
    type_pairing_id: null,
    primary_action_id: null,
    site_goal_ids: [],
    usp_statement: null,
    selected_usp_id: null,
    data: {},
    ...overrides,
  };
}

describe("stepIssue — étape 2 (positioning)", () => {
  it("refuse un « ok » avec une ligne qui dit quoi faire", () => {
    const issue = stepIssue("positioning", draft({ data: { gain_text: "ok" } }));
    expect(issue).toMatch(/Pick a card, or write a sentence/);
  });

  it("accepte une seule carte, sans un mot écrit", () => {
    expect(
      stepIssue("positioning", draft({ problem_card_ids: ["burnout"] }))
    ).toBeNull();
  });

  it(`accepte ${POSITIONING_MIN_CHARS} caractères écrits, sans aucune carte`, () => {
    const sentence = "Therapy for high-performing adults who can't switch off.";
    expect(sentence.length).toBeGreaterThanOrEqual(POSITIONING_MIN_CHARS);
    expect(
      stepIssue("positioning", draft({ data: { gain_text: sentence } }))
    ).toBeNull();
  });
});

describe("stepIssue — les autres étapes", () => {
  it("l'étape 1 demande un nom, une licence et une spécialité", () => {
    expect(stepIssue("practice", draft())).toMatch(/name/);
    expect(
      stepIssue("practice", draft({ practice_name: "Elm & Ember" }))
    ).toMatch(/license/);
    expect(
      stepIssue(
        "practice",
        draft({ practice_name: "Elm & Ember", license_type_id: "lcsw" })
      )
    ).toMatch(/specialty/);
    expect(
      stepIssue(
        "practice",
        draft({
          practice_name: "Elm & Ember",
          license_type_id: "lcsw",
          specialty_ids: ["anxiety"],
        })
      )
    ).toBeNull();
  });

  it("un nom fait d'espaces ne compte pas", () => {
    expect(stepIssue("practice", draft({ practice_name: "   " }))).toMatch(/name/);
  });

  it("l'étape 7 ne bloque jamais : elle porte « Skip for now »", () => {
    expect(stepIssue("website", draft())).toBeNull();
  });

  it("⚠ l'étape 4 n'exige PLUS QUE la carte de style de séance", () => {
    /*
     * Ce test exigeait aussi vingt caractères de citation de collègue, et il
     * était fidèle au produit d'alors. Mesurée à 390px, cette étape faisait
     * 3 572px — cinq écrans et demi — et se terminait sur la question la plus
     * difficile du parcours : écrire une phrase dans la voix de quelqu'un
     * d'autre. C'était la seule exigence de texte libre bloquante du brief.
     *
     * Rien en aval n'en dépendait : `how-you-work-context.ts` lit
     * `referral_quote` sous condition, comme les huit autres champs
     * facultatifs de l'étape.
     */
    expect(stepIssue("how_you_work", draft())).toMatch(/session usually looks/);

    for (const quote of [null, "", "   ", "too short"]) {
      expect(
        stepIssue(
          "how_you_work",
          draft({ session_style_ids: ["reflective"], referral_quote: quote })
        ),
        `la citation ${JSON.stringify(quote)} ne doit plus bloquer`
      ).toBeNull();
    }

    expect(
      stepIssue(
        "how_you_work",
        draft({
          session_style_ids: ["reflective"],
          referral_quote: "She's direct, but you never feel judged.",
        })
      )
    ).toBeNull();
  });

  /*
   * ⚠ L'ÉTAPE QUI N'AVAIT AUCUN TEST EST CELLE QUI A CASSÉ.
   *
   * Sur le chemin NORMAL — la génération aboutit — l'étape 5 montre six cartes
   * dont les `id` sont des slugs du modèle, rangés dans
   * `data.selected_tone_card_id` parce que `tone_card_id` porte une clé
   * étrangère vers `tone_cards(id)`. La validation ne lisait que la colonne :
   * la carte se cochait et « Continue » refusait quand même.
   */
  const GENERATED: ToneCards = [
    "grounded-direct",
    "warm-plain",
    "patient-spacious",
    "clear-clinical",
    "quiet-steady",
    "open-curious",
  ].map((id, index) => ({
    id,
    label: `Voice ${index + 1}`,
    keywords: ["one", "two", "three"],
    sample_hero: `A headline in voice ${index + 1}.`,
    generated: true as const,
  }));

  it("l'étape 5 accepte une carte GÉNÉRÉE, qui ne vit pas dans `tone_card_id`", () => {
    const chosen = draft({ data: { selected_tone_card_id: "grounded-direct" } });

    expect(stepIssue("voice", chosen, GENERATED)).toBeNull();
    // `tone_card_id` reste null, et c'est voulu : la FK refuserait le slug.
    expect(chosen.tone_card_id).toBeNull();
  });

  it("l'étape 5 bloque tant que rien n'est choisi, dans les deux modes", () => {
    expect(stepIssue("voice", draft(), GENERATED)).toMatch(/sounds most like you/);
    expect(stepIssue("voice", draft(), null)).toMatch(/sounds most like you/);
  });

  /*
   * Le repli statique — la génération a échoué, l'étape montre le catalogue.
   * Là, et seulement là, `tone_card_id` est le bon endroit.
   */
  it("l'étape 5 accepte une carte du catalogue quand c'est elle qui est montrée", () => {
    expect(stepIssue("voice", draft({ tone_card_id: "grounded" }), null)).toBeNull();
  });

  /*
   * ⚠ LA SÉLECTION PÉRIMÉE, que le correctif permissif aurait laissée passer.
   *
   * Rééditer l'étape 4 change `tone_cards_inputs_hash` : six cartes neuves
   * arrivent avec des id neufs, et l'ancien choix ne correspond plus à rien
   * d'affiché. L'étape doit redemander, pas valider un écran vide.
   */
  it("l'étape 5 refuse un choix qui ne figure plus parmi les cartes affichées", () => {
    expect(
      stepIssue(
        "voice",
        draft({ data: { selected_tone_card_id: "a-voice-from-the-run-before" } }),
        GENERATED
      )
    ).toMatch(/sounds most like you/);
  });

  /*
   * Et le symétrique : un `tone_card_id` du catalogue ne valide PAS un écran
   * qui montre les six cartes générées — cette carte-là n'y est pas.
   */
  it("l'étape 5 ne valide pas une carte de catalogue contre l'écran généré", () => {
    expect(
      stepIssue("voice", draft({ tone_card_id: "grounded" }), GENERATED)
    ).toMatch(/sounds most like you/);
  });

  it("l'étape 6 (look, fusion palette + typography) exige les deux", () => {
    expect(stepIssue("look", draft())).toMatch(/Pick at least one/);
    expect(
      stepIssue("look", draft({ palette_family_ids: ["sage"] }))
    ).toMatch(/Pick a pairing/);
    expect(
      stepIssue(
        "look",
        draft({ palette_family_ids: ["sage"], type_pairing_id: "serif-sans" })
      )
    ).toBeNull();
  });
});

describe("resumeStep", () => {
  it("reprend à `progress_step`, jamais à `projects.current_step`", () => {
    expect(resumeStep({ progress_step: 5 })).toBe(5);
  });

  it("borne à 1..7 — 8 est le cycle du PROJET, pas celui du brief", () => {
    expect(resumeStep({ progress_step: 8 })).toBe(7);
    expect(resumeStep({ progress_step: 0 })).toBe(1);
  });
});

describe("withCompletedStep", () => {
  it("ajoute sans doublon et garde l'ordre", () => {
    expect(withCompletedStep([3, 1], 2)).toEqual([1, 2, 3]);
    expect(withCompletedStep([1, 2], 2)).toEqual([1, 2]);
  });
});
