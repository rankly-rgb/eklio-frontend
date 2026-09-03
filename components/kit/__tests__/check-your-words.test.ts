import { describe, expect, it } from "vitest";
import { segmentText } from "@/components/kit/check-your-words";
import { checkEthics } from "@/lib/ethics/rules";

/*
 * `segmentText` is presentation-only logic (turning `checkEthics`'s
 * excerpt-based violations into underline-able text spans) — never a second
 * implementation of the scanning engine itself. Tested against the REAL
 * `checkEthics` output, not a hand-built fixture, so a change to the
 * engine's excerpt shape would actually break this test rather than pass
 * silently against a stale assumption.
 */

describe("segmentText", () => {
  it("returns the whole text as one plain segment when nothing is flagged", () => {
    const text = "I work with adults navigating anxiety and burnout.";
    const segments = segmentText(text, checkEthics(text).violations);
    expect(segments).toEqual([{ text, violation: null }]);
  });

  it("splits around a single flagged excerpt, reassembling to the original text", () => {
    const text = "This will resolve your anxiety for good.";
    const { violations } = checkEthics(text);
    expect(violations.length).toBeGreaterThan(0);

    const segments = segmentText(text, violations);
    expect(segments.map((s) => s.text).join("")).toBe(text);
    expect(segments.some((s) => s.violation !== null)).toBe(true);
  });

  it("handles multiple, non-overlapping flagged excerpts in order", () => {
    const text = "Guaranteed results. Only 2 spots left this month — book before rates go up.";
    const { violations } = checkEthics(text);
    expect(violations.length).toBeGreaterThanOrEqual(2);

    const segments = segmentText(text, violations);
    expect(segments.map((s) => s.text).join("")).toBe(text);

    // Segments must appear in the same order as they do in the text.
    let cursor = 0;
    for (const segment of segments) {
      const at = text.indexOf(segment.text, cursor);
      expect(at).toBeGreaterThanOrEqual(cursor);
      cursor = at + segment.text.length;
    }
  });

  it("never produces a flagged segment whose text differs from the source", () => {
    const text = "This proven method eliminates panic attacks. My clients say they feel heard.";
    const { violations } = checkEthics(text);
    const segments = segmentText(text, violations);
    for (const segment of segments.filter((s) => s.violation !== null)) {
      expect(text).toContain(segment.text);
    }
  });

  it("is stable for empty text", () => {
    expect(segmentText("", [])).toEqual([]);
  });
});
