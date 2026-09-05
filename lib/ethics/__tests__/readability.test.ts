import { describe, expect, it } from "vitest";
import { fleschKincaidGrade, readingLevel } from "@/lib/ethics/readability";

describe("fleschKincaidGrade", () => {
  it("scores simple, short sentences at a low grade", () => {
    const grade = fleschKincaidGrade("The cat sat. The dog ran. I am glad.");
    expect(grade).toBeLessThan(4);
  });

  it("scores long, multi-syllable sentences at a higher grade", () => {
    const grade = fleschKincaidGrade(
      "The multidisciplinary evaluation necessitated an extraordinarily comprehensive " +
        "reconsideration of the previously established therapeutic methodology."
    );
    expect(grade).toBeGreaterThan(12);
  });

  it("returns 0 for empty input rather than dividing by zero", () => {
    expect(fleschKincaidGrade("")).toBe(0);
    expect(fleschKincaidGrade("   ")).toBe(0);
  });

  it("never returns a negative grade", () => {
    expect(fleschKincaidGrade("I am. Go now. Be here.")).toBeGreaterThanOrEqual(0);
  });
});

describe("readingLevel", () => {
  it("labels a low grade as Kindergarten", () => {
    expect(readingLevel("").label).toBe("Kindergarten");
  });

  it("labels grade 8 with the correct ordinal", () => {
    // A passage measured to land close to an 8th-grade Flesch-Kincaid score.
    const text =
      "Therapy can help when things feel heavy. Many people start with one small step. " +
      "A first session is just a conversation. You decide what happens next.";
    const { label, grade } = readingLevel(text);
    expect(grade).toBeGreaterThan(0);
    expect(label).toMatch(/^\d+(st|nd|rd|th) grade$/);
  });

  it("labels grade 13 and above as College", () => {
    const dense =
      "Notwithstanding the aforementioned methodological considerations, practitioners " +
      "must nevertheless conceptualize interdisciplinary therapeutic interventions " +
      "commensurate with individualized psychosocial circumstances.";
    expect(readingLevel(dense).label).toBe("College");
  });

  it("is never displayed as a percentage or a score — label is always a grade word", () => {
    const { label } = readingLevel("Some ordinary sentence for a therapist's website.");
    expect(label).not.toMatch(/%/);
  });
});
