import { describe, expect, it } from "vitest";
import { emailSignatureText, personalStatement, shortBio } from "@/lib/kit/launch-copy";

describe("personalStatement", () => {
  it("joins the practitioner line, credential, and location", () => {
    expect(
      personalStatement("Maren Ellery, LMFT", {
        practitionerName: "Maren Ellery",
        licenseLabel: "LMFT",
        licenseNumber: "12345",
        city: "Portland",
        state: "OR",
      })
    ).toBe("Maren Ellery, LMFT — LMFT 12345 — Portland, OR");
  });

  it("omits missing pieces instead of leaving gaps", () => {
    expect(personalStatement("Maren Ellery, LMFT", null)).toBe("Maren Ellery, LMFT");
    expect(
      personalStatement(null, {
        practitionerName: null,
        licenseLabel: null,
        licenseNumber: null,
        city: "Portland",
        state: "OR",
      })
    ).toBe("Portland, OR");
  });

  it("returns null when there is nothing to say", () => {
    expect(personalStatement(null, null)).toBeNull();
    expect(
      personalStatement("  ", {
        practitionerName: null,
        licenseLabel: null,
        licenseNumber: null,
        city: null,
        state: null,
      })
    ).toBeNull();
  });
});

describe("shortBio", () => {
  it("returns short text unchanged", () => {
    expect(shortBio("I work with adults navigating anxiety.")).toBe(
      "I work with adults navigating anxiety."
    );
  });

  it("truncates at a word boundary and never exceeds the limit plus the ellipsis", () => {
    const long =
      "I work with adults navigating anxiety, burnout, and major life transitions in a warm, direct, and collaborative style.";
    const result = shortBio(long, 60);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(61);
    expect(result!.endsWith("…")).toBe(true);
    expect(long.startsWith(result!.slice(0, -1).trimEnd())).toBe(true);
  });

  it("returns null for empty input", () => {
    expect(shortBio(null)).toBeNull();
    expect(shortBio("   ")).toBeNull();
  });
});

describe("emailSignatureText", () => {
  it("builds a three-line block: name+credential, practice, booking link", () => {
    expect(
      emailSignatureText("Elm & Ember Therapy", "Maren Ellery", { practitionerName: null, licenseLabel: "LMFT", licenseNumber: null, city: null, state: null }, "https://example.com/book")
    ).toBe("Maren Ellery, LMFT\nElm & Ember Therapy\nhttps://example.com/book");
  });

  it("drops missing lines rather than leaving blanks", () => {
    expect(emailSignatureText("Elm & Ember Therapy", null, null, null)).toBe(
      "Elm & Ember Therapy"
    );
  });

  it("returns null when nothing is available at all", () => {
    expect(emailSignatureText(null, null, null, null)).toBeNull();
  });
});
