import { describe, expect, it } from "vitest";
import { ambiancePlaceholder } from "@/lib/kit/photo-slot";

describe("ambiancePlaceholder", () => {
  it("is a deterministic diagonal gradient from primary to dark_neutral", () => {
    expect(
      ambiancePlaceholder({ primary: "#B4674A", dark_neutral: "#2B2A27" })
    ).toBe("linear-gradient(135deg, #B4674A 0%, #2B2A27 100%)");
  });

  it("never touches paper or light_neutral — only primary and dark_neutral feed it", () => {
    const a = ambiancePlaceholder({ primary: "#111111", dark_neutral: "#222222" });
    const b = ambiancePlaceholder({ primary: "#111111", dark_neutral: "#222222" });
    expect(a).toBe(b);
  });
});
