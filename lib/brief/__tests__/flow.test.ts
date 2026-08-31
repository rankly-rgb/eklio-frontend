import { describe, expect, it } from "vitest";
import {
  POSITIONING_MIN_CHARS,
  resumeStep,
  stepIssue,
  withCompletedStep,
  type StepDraft,
} from "@/lib/brief/flow";

/*
 * Les règles de validation du brief. Elles décident de ce qui bloque un
 * praticien à une étape : c'est exactement le genre de code qu'on ne veut pas
 * découvrir cassé en production.
 */

function draft(overrides: Partial<StepDraft> = {}): StepDraft {
  return {
    practice_name: null,
    license_type_id: null,
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

  it("l'étape 4 (how_you_work) exige une carte de style de séance ET vingt caractères de citation", () => {
    expect(stepIssue("how_you_work", draft())).toMatch(/session usually looks/);
    expect(
      stepIssue(
        "how_you_work",
        draft({ session_style_ids: ["reflective"], referral_quote: "too short" })
      )
    ).toMatch(/little more/);
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
