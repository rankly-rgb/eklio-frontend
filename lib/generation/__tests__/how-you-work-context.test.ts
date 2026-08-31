import { describe, expect, it } from "vitest";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * §9.10 du contrat, verbatim : « Never print prior_career anywhere
 * prior_career_public is not true. » Pas seulement dans le rendu — dans tout
 * ce qui part au modèle, puisqu'un fait que le modèle voit peut ressortir
 * dans une génération.
 */

const catalog = {
  licenseTypes: [],
  specialties: [],
  problemCards: [],
  gainCards: [],
  personaCards: [],
  notAFitCards: [],
  modalityCards: [],
  sessionStyleCards: [],
  modalityProminenceOptions: [],
} as unknown as Catalog;

function bundle(priorCareer: string | null, priorCareerPublic: boolean): BriefBundle {
  return {
    project: {} as BriefBundle["project"],
    data: {},
    brief: {
      practice_name: "Elm & Ember",
      license_type_id: null,
      specialty_ids: [],
      city: null,
      state: null,
      problem_card_ids: [],
      gain_card_ids: [],
      client_persona_ids: [],
      session_style_ids: [],
      not_a_fit_ids: [],
      not_a_fit_text: null,
      modality_ids: [],
      modality_prominence: null,
      referral_quote: null,
      prior_career: priorCareer,
      prior_career_public: priorCareerPublic,
    } as unknown as BriefBundle["brief"],
  };
}

describe("buildHowYouWorkContext — prior_career", () => {
  it("omet prior_career quand prior_career_public est faux", () => {
    const context = buildHowYouWorkContext(
      bundle("She was a public defender for a decade.", false),
      catalog
    );
    expect(context).not.toContain("public defender");
  });

  it("inclut prior_career quand prior_career_public est vrai", () => {
    const context = buildHowYouWorkContext(
      bundle("She was a public defender for a decade.", true),
      catalog
    );
    expect(context).toContain("public defender");
  });

  it("omet prior_career quand il est vide, même publique", () => {
    const context = buildHowYouWorkContext(bundle(null, true), catalog);
    expect(context).not.toContain("Before this work");
  });
});
