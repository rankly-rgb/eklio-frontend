import { describe, expect, it } from "vitest";
import {
  failures,
  maxLengthConstraint,
  nameConstraint,
  rationaleConstraint,
  toneKeywordsIssue,
  truncateOnWordBoundary,
} from "@/lib/generation/validate";

/*
 * Ces bornes ne sont pas des préférences : ce sont les CHECK de la base,
 * transcrits. Les rater fait échouer l'écriture après une minute de
 * génération, sur l'écran de révélation.
 */

describe("nameConstraint", () => {
  const constraint = nameConstraint("directions[0].name");

  it("accepte un et deux mots sous 20 caractères", () => {
    expect(constraint.ok("Warm Welcome")).toBe(true);
    expect(constraint.ok("Steady")).toBe(true);
  });

  it("refuse trois mots, même courts", () => {
    expect(constraint.ok("Warm And Steady")).toBe(false);
  });

  it("refuse plus de 20 caractères", () => {
    expect(constraint.ok("Extraordinarily Calm")).toBe(true);
    expect(constraint.ok("Extraordinarily Quiet")).toBe(false);
  });
});

describe("rationaleConstraint", () => {
  const constraint = rationaleConstraint("directions[0].rationale");

  it("refuse une étiquette trop courte", () => {
    expect(constraint.ok("Calm and steady.")).toBe(false);
  });

  it("accepte la borne basse et refuse juste en dessous", () => {
    expect(constraint.ok("x".repeat(60))).toBe(true);
    expect(constraint.ok("x".repeat(59))).toBe(false);
  });

  it("accepte la borne haute et refuse juste au-dessus", () => {
    expect(constraint.ok("x".repeat(95))).toBe(true);
    expect(constraint.ok("x".repeat(96))).toBe(false);
  });
});

describe("toneKeywordsIssue", () => {
  it("laisse passer trois mots courts", () => {
    expect(toneKeywordsIssue(["steady", "plainspoken", "warm"])).toBeNull();
  });

  it("mesure la ligne JOINTE, pas les mots un par un", () => {
    // 3 × 10 caractères tiennent séparément, mais la ligne jointe fait 36.
    const issue = toneKeywordsIssue(["deliberate", "restrained", "considered"]);
    expect(issue).toMatch(/under 33 characters/);
  });

  it("refuse un mot-clé qui contient un espace", () => {
    expect(toneKeywordsIssue(["steady", "plain spoken", "warm"])).toMatch(
      /single words/
    );
  });

  it("refuse un nombre de mots-clés différent de trois", () => {
    expect(toneKeywordsIssue(["steady", "warm"])).toMatch(/exactly three/);
  });
});

describe("failures", () => {
  it("ne remonte que les champs fautifs, avec leur contrainte", () => {
    const result = failures([
      {
        constraint: maxLengthConstraint("hero.headline", 46, "the site headline"),
        value: "A calmer place to start.",
      },
      {
        constraint: maxLengthConstraint("hero.subhead", 60, "the line under it"),
        value: "x".repeat(80),
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("hero.subhead");
    expect(result[0].requirement).toContain("60 characters at most");
  });
});

describe("truncateOnWordBoundary", () => {
  it("ne coupe pas ce qui tient déjà", () => {
    expect(truncateOnWordBoundary("A calmer place.", 46)).toBe("A calmer place.");
  });

  it("coupe sur un espace, jamais en plein mot", () => {
    const result = truncateOnWordBoundary(
      "Therapy for high-performing adults who cannot switch off at all",
      40
    );
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith(" ")).toBe(false);
    expect("Therapy for high-performing adults who cannot switch off at all").toContain(result);
  });
});
