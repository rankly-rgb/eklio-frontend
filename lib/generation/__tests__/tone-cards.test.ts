import { describe, expect, it } from "vitest";
import { generateToneCards, type RawToneCard } from "@/lib/generation/tone-cards";
import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * L'orchestration de la génération (§2.2) : reprise sur un mot banni jusqu'à
 * deux fois, repli après trois tentatives, empreinte des entrées de l'étape
 * 4 uniquement. `modelCall`/`bannedPhrasesCheck` s'injectent pour ne jamais
 * toucher le réseau ici.
 */

const catalog = {
  licenseTypes: [{ id: "lcsw", label: "LCSW" }],
  specialties: [{ id: "anxiety", label: "Anxiety" }],
  problemCards: [],
  gainCards: [],
  personaCards: [],
  toneCards: [],
  paletteFamilies: [],
  typePairings: [],
  primaryActions: [],
  siteGoals: [],
  ethicsRules: [],
  sessionStyleCards: [
    { id: "reflective", label: "Reflective", voice_hints: ["curious", "grounded"] },
  ],
  notAFitCards: [],
  modalityCards: [{ id: "emdr", label: "EMDR", full_name: "EMDR" }],
  modalityProminenceOptions: [{ id: "mention_it", label: "Mention it" }],
} as unknown as Catalog;

function bundle(overrides: Partial<BriefBundle["brief"]> = {}): BriefBundle {
  return {
    project: {} as BriefBundle["project"],
    data: {},
    brief: {
      practice_name: "Elm & Ember",
      license_type_id: "lcsw",
      specialty_ids: ["anxiety"],
      city: "Portland",
      state: "OR",
      problem_card_ids: [],
      gain_card_ids: [],
      client_persona_ids: [],
      session_style_ids: ["reflective"],
      not_a_fit_ids: [],
      not_a_fit_text: null,
      modality_ids: ["emdr"],
      modality_prominence: "mention_it",
      referral_quote: "She's direct, but you never feel judged.",
      prior_career: null,
      prior_career_public: false,
      ...overrides,
    } as BriefBundle["brief"],
  };
}

const CARD_SET: RawToneCard[] = Array.from({ length: 6 }, (_, index) => ({
  id: `card-${index}`,
  label: `Voice ${index}`,
  keywords: ["a", "b", "c"],
  sample_hero: `A headline ${index}`,
}));

describe("generateToneCards", () => {
  it("réussit du premier coup quand rien n'est banni", async () => {
    const modelCall = async () => CARD_SET;
    const bannedPhrasesCheck = async () => [];

    const result = await generateToneCards(
      bundle(),
      catalog,
      modelCall,
      bannedPhrasesCheck
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards).toHaveLength(6);
  });

  it("reprend en passant les phrases bannies, jusqu'à réussir", async () => {
    let calls = 0;
    const seenForbidden: string[][] = [];
    const modelCall = async (_prompt: string, forbidden: string[]) => {
      calls += 1;
      seenForbidden.push(forbidden);
      return CARD_SET;
    };
    // La première carte échoue au premier appel seulement.
    const bannedPhrasesCheck = async (text: string) =>
      calls === 1 && text === "A headline 0" ? ["banned phrase"] : [];

    const result = await generateToneCards(
      bundle(),
      catalog,
      modelCall,
      bannedPhrasesCheck
    );

    expect(calls).toBe(2);
    expect(seenForbidden[1]).toContain("banned phrase");
    expect(result.ok).toBe(true);
  });

  it("retombe sur le repli après trois tentatives infructueuses", async () => {
    let calls = 0;
    const modelCall = async () => {
      calls += 1;
      return CARD_SET;
    };
    const bannedPhrasesCheck = async () => ["banned phrase"];

    const result = await generateToneCards(
      bundle(),
      catalog,
      modelCall,
      bannedPhrasesCheck
    );

    expect(calls).toBe(3);
    expect(result).toEqual({ ok: false, reason: "fallback" });
  });

  it("retombe sur le repli si le modèle est indisponible à chaque tentative", async () => {
    const modelCall = async () => {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    };
    const bannedPhrasesCheck = async () => [];

    const result = await generateToneCards(
      bundle(),
      catalog,
      modelCall,
      bannedPhrasesCheck
    );

    expect(result).toEqual({ ok: false, reason: "fallback" });
  });
});
