import { describe, expect, it } from "vitest";
import { computeAssetFingerprint, type AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";

const BASE: AssetFingerprintInput = {
  tokens: {
    primary: "#B4674A",
    secondary: "#C08A3E",
    accent: "#2B2A27",
    paper: "#FAF6EE",
    light_neutral: "#F4EEE3",
    dark_neutral: "#2B2A27",
    primary_text: "#FFFFFF",
    secondary_text: "#FFFFFF",
    accent_text: "#FFFFFF",
    cta_ink: "#FFFFFF",
    heading_font: "Fraunces",
    body_font: "Nunito Sans",
  },
  practiceName: "Elm & Ember Therapy",
};

describe("computeAssetFingerprint", () => {
  it("is deterministic — same input, same hash", () => {
    expect(computeAssetFingerprint(BASE)).toBe(computeAssetFingerprint(BASE));
  });

  it("is a lowercase hex string of the shape the RPCs validate against", () => {
    const fp = computeAssetFingerprint(BASE);
    expect(fp).toMatch(/^[0-9a-f]{16,128}$/);
  });

  it("does not depend on object key insertion order", () => {
    const reordered: AssetFingerprintInput = {
      practiceName: BASE.practiceName,
      tokens: {
        heading_font: BASE.tokens.heading_font,
        body_font: BASE.tokens.body_font,
        primary: BASE.tokens.primary,
        secondary: BASE.tokens.secondary,
        accent: BASE.tokens.accent,
        paper: BASE.tokens.paper,
        light_neutral: BASE.tokens.light_neutral,
        dark_neutral: BASE.tokens.dark_neutral,
        primary_text: BASE.tokens.primary_text,
        secondary_text: BASE.tokens.secondary_text,
        accent_text: BASE.tokens.accent_text,
        cta_ink: BASE.tokens.cta_ink,
      },
    };
    expect(computeAssetFingerprint(reordered)).toBe(computeAssetFingerprint(BASE));
  });

  it("changes when a color role changes", () => {
    const changed = { ...BASE, tokens: { ...BASE.tokens, primary: "#000000" } };
    expect(computeAssetFingerprint(changed)).not.toBe(computeAssetFingerprint(BASE));
  });

  it("changes when a derived variant changes", () => {
    const changed = { ...BASE, tokens: { ...BASE.tokens, cta_ink: "#000000" } };
    expect(computeAssetFingerprint(changed)).not.toBe(computeAssetFingerprint(BASE));
  });

  it("changes when either font family changes", () => {
    const changedHeading = { ...BASE, tokens: { ...BASE.tokens, heading_font: "Newsreader" } };
    const changedBody = { ...BASE, tokens: { ...BASE.tokens, body_font: "Work Sans" } };
    expect(computeAssetFingerprint(changedHeading)).not.toBe(computeAssetFingerprint(BASE));
    expect(computeAssetFingerprint(changedBody)).not.toBe(computeAssetFingerprint(BASE));
  });

  it("changes when the practice name changes", () => {
    const changed = { ...BASE, practiceName: "Someone Else's Practice" };
    expect(computeAssetFingerprint(changed)).not.toBe(computeAssetFingerprint(BASE));
  });

  it("distinguishes a null practice name from an empty string", () => {
    const nullName = computeAssetFingerprint({ ...BASE, practiceName: null });
    const emptyName = computeAssetFingerprint({ ...BASE, practiceName: "" });
    expect(nullName).not.toBe(emptyName);
  });
});
