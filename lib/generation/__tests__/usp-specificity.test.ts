import { describe, expect, it } from "vitest";
import {
  jaccardSimilarity,
  passesSpecificity,
  tokenSet,
} from "@/lib/generation/usp-specificity";

/*
 * Gate 2 (§2.5) : « generic directory language is a failure, not negotiable ».
 *
 * `usp_stopwords` vit en base (migration `20260831101000_usp_guardrail_tables.sql`)
 * et ces tests ne touchent pas la base : la liste ci-dessous est un
 * ÉCHANTILLON qui couvre les phrases testées, pas une copie prétendant faire
 * autorité — `lib/generation/usp-guardrails.ts` reste l'unique lecteur réel.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "she", "he", "they", "we", "with", "from", "for",
  "who", "is", "this", "about", "their", "of", "in", "on", "to", "and",
  "therapy", "therapist", "counseling", "counselor", "practice", "clients", "people",
]);

describe("passesSpecificity", () => {
  it("rejette un candidat qui ne partage aucune racine avec le brief", () => {
    const contentTokens = tokenSet(
      "She works with first responders carrying trauma from the job.",
      STOPWORDS
    );
    const statement = "We help people feel better about their lives.";
    expect(passesSpecificity(statement, contentTokens, STOPWORDS)).toBe(false);
  });

  it("garde un candidat qui partage au moins une racine", () => {
    const contentTokens = tokenSet(
      "She works with first responders carrying trauma from the job.",
      STOPWORDS
    );
    const statement = "For first responders whose work leaves a mark, this is trauma-informed care.";
    expect(passesSpecificity(statement, contentTokens, STOPWORDS)).toBe(true);
  });

  it("compare les racines, pas les formes exactes (pluriel, -ing)", () => {
    // « therapist »/« practice »/etc. sont eux-mêmes des mots vides côté base
    // (vus dans usp_stopwords) — un exemple hors de ce vocabulaire-là évite
    // de confondre « filtré parce que mot vide » et « refusé faute de racine
    // commune ».
    const contentTokens = tokenSet("She trains new clinicians every week.", STOPWORDS);
    const statement = "Built for the clinician who is training for what's ahead.";
    expect(passesSpecificity(statement, contentTokens, STOPWORDS)).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("vaut 1 pour deux textes aux mêmes racines", () => {
    expect(
      jaccardSimilarity(
        tokenSet("trauma work", STOPWORDS),
        tokenSet("trauma working", STOPWORDS)
      )
    ).toBe(1);
  });

  it("vaut 0 pour deux textes sans racine commune", () => {
    expect(
      jaccardSimilarity(
        tokenSet("trauma work", STOPWORDS),
        tokenSet("family therapy", STOPWORDS)
      )
    ).toBe(0);
  });
});
