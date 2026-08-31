import { describe, expect, it } from "vitest";
import {
  jaccardSimilarity,
  passesSpecificity,
  tokenSet,
} from "@/lib/generation/usp-specificity";

/* Gate 2 (§2.5) : « generic directory language is a failure, not negotiable ». */

describe("passesSpecificity", () => {
  it("rejette un candidat qui ne partage aucune racine avec le brief", () => {
    const contentTokens = tokenSet(
      "She works with first responders carrying trauma from the job."
    );
    const statement = "We help people feel better about their lives.";
    expect(passesSpecificity(statement, contentTokens)).toBe(false);
  });

  it("garde un candidat qui partage au moins une racine", () => {
    const contentTokens = tokenSet(
      "She works with first responders carrying trauma from the job."
    );
    const statement = "For first responders whose work leaves a mark, this is trauma-informed care.";
    expect(passesSpecificity(statement, contentTokens)).toBe(true);
  });

  it("compare les racines, pas les formes exactes (pluriel, -ing)", () => {
    const contentTokens = tokenSet("She works with therapists carrying burnout.");
    const statement = "Built for the therapist who is burning out quietly.";
    expect(passesSpecificity(statement, contentTokens)).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("vaut 1 pour deux textes aux mêmes racines", () => {
    expect(jaccardSimilarity(tokenSet("trauma work"), tokenSet("trauma working"))).toBe(1);
  });

  it("vaut 0 pour deux textes sans racine commune", () => {
    expect(jaccardSimilarity(tokenSet("trauma work"), tokenSet("family therapy"))).toBe(0);
  });
});
