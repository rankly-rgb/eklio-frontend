import { describe, expect, it } from "vitest";
import { STATUS_KEYS, STATUSES, statusDefinition } from "@/lib/status";

describe("the status vocabulary", () => {
  it("has exactly the nine statuses the brief names", () => {
    expect([...STATUS_KEYS].sort()).toEqual(
      [
        "checked",
        "downloaded",
        "draft",
        "locked",
        "needs-rebuild",
        "posted",
        "ready",
        "scheduled",
        "updated",
      ].sort()
    );
  });

  it("gives every status exactly one label, one colour, and one glyph", () => {
    for (const key of STATUS_KEYS) {
      const def = statusDefinition(key);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.color).toBeTruthy();
      expect(def.glyph).toBeTruthy();
    }
  });

  it("never assigns two statuses the same label", () => {
    const labels = STATUS_KEYS.map((key) => STATUSES[key].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("never assigns two statuses the same glyph shape", () => {
    const glyphs = STATUS_KEYS.map((key) => STATUSES[key].glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});
