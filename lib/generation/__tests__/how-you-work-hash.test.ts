import { describe, expect, it } from "vitest";
import { computeHowYouWorkInputsHash } from "@/lib/generation/how-you-work-hash";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * Une seule fonction de hachage pour les deux invalidations qui en dépendent
 * (`tone_cards_inputs_hash` et `data.usp_options_inputs_hash`) : ces tests
 * la couvrent une fois, pas une fois par générateur.
 */

function brief(overrides: Partial<BriefBundle["brief"]> = {}) {
  return {
    session_style_ids: ["reflective"],
    not_a_fit_ids: [],
    not_a_fit_text: null,
    modality_ids: ["emdr"],
    modality_prominence: "mention_it",
    referral_quote: "She's direct, but you never feel judged.",
    prior_career: null,
    prior_career_public: false,
    ...overrides,
  } as unknown as BriefBundle["brief"];
}

describe("computeHowYouWorkInputsHash", () => {
  it("est stable pour les mêmes entrées", () => {
    expect(computeHowYouWorkInputsHash(brief())).toBe(computeHowYouWorkInputsHash(brief()));
  });

  it("ignore l'ordre des tableaux", () => {
    const a = computeHowYouWorkInputsHash(
      brief({ session_style_ids: ["reflective", "direct"] })
    );
    const b = computeHowYouWorkInputsHash(
      brief({ session_style_ids: ["direct", "reflective"] })
    );
    expect(a).toBe(b);
  });

  it("change quand une réponse de l'étape 4 change", () => {
    const a = computeHowYouWorkInputsHash(brief());
    const b = computeHowYouWorkInputsHash(
      brief({ referral_quote: "Something else entirely." })
    );
    expect(a).not.toBe(b);
  });

  it("change quand prior_career_public bascule, même si prior_career reste vide", () => {
    const a = computeHowYouWorkInputsHash(brief({ prior_career_public: false }));
    const b = computeHowYouWorkInputsHash(brief({ prior_career_public: true }));
    expect(a).not.toBe(b);
  });
});
