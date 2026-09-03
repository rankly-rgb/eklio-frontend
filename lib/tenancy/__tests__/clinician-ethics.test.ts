import { describe, expect, it } from "vitest";
import { checkClinicianFreeText } from "@/lib/tenancy/clinician-ethics";

describe("checkClinicianFreeText", () => {
  it("passes ordinary first-person copy", () => {
    const flag = checkClinicianFreeText(
      "philosophy_quote",
      "I believe therapy works best when it moves at your pace."
    );
    expect(flag.field).toBe("philosophy_quote");
    expect(flag.check.ok).toBe(true);
    expect(flag.check.violations).toHaveLength(0);
  });

  it("flags a blocking outcome promise instead of rewriting it", () => {
    const flag = checkClinicianFreeText(
      "philosophy_quote",
      "I will heal your anxiety in 12 weeks."
    );
    expect(flag.check.ok).toBe(false);
    expect(flag.check.violations.length).toBeGreaterThan(0);
    expect(flag.check.violations.some((v) => v.severity === "block")).toBe(true);
  });

  it("flags outside_the_room the same way as philosophy_quote", () => {
    const flag = checkClinicianFreeText(
      "outside_the_room",
      "100% of my clients feel better within a month."
    );
    expect(flag.field).toBe("outside_the_room");
    expect(flag.check.ok).toBe(false);
  });

  it("returns ok for an empty string rather than throwing", () => {
    const flag = checkClinicianFreeText("philosophy_quote", "");
    expect(flag.check.ok).toBe(true);
    expect(flag.check.violations).toHaveLength(0);
  });
});
