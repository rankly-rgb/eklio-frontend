import { describe, expect, it } from "vitest";
import { formatOf, formatRhythm, orderByFormat } from "@/lib/content/month/select";

/* F131 (2026-11-05) : le mois de mars 2027, dans l'ordre où il était sorti. */
const MARCH = [
  ...Array(9).fill("carousel"),
  "quadrant_model", "concentric_control", "lettered_technique", "quadrant_model", "numbered_strategies", "cycle",
  "surface_and_beneath", "comparison_pair", "cycle", "comparison_pair", "numbered_strategies", "concentric_control", "concentric_control", "comparison_pair",
  "single_statement", "practitioner_card", ...Array(5).fill("single_statement"),
];

const rhythm = (list: string[]) => formatRhythm(list.map(formatOf));

describe("l'ordre des formats sur le mois", () => {
  it("mars 2027 tel qu'il est sorti : des fenêtres d'un seul format, quatorze listes de suite", () => {
    const r = rhythm(MARCH);
    expect(Math.min(...r.distinct)).toBe(1);
    expect(r.longestRun).toBe(14);
  });

  it("réordonné : trois formats dans chaque fenêtre de neuf, aucun au-delà de cinq, pas plus de trois de suite", () => {
    const r = rhythm(orderByFormat(MARCH, (a) => a));
    expect(Math.min(...r.distinct)).toBe(3);
    expect(Math.max(...r.maxInWindow)).toBeLessThanOrEqual(5);
    expect(r.longestRun).toBeLessThanOrEqual(3);
  });

  it("une permutation : les mêmes posts, ni plus ni moins, et le même ordre à chaque appel", () => {
    const posts = MARCH.map((a, i) => ({ a, i }));
    const once = orderByFormat(posts, (p) => p.a);
    expect([...once].sort((x, y) => x.i - y.i)).toEqual(posts);
    expect(orderByFormat(posts, (p) => p.a)).toEqual(once);
  });

  it("au plafond de listes (14), avec peu de carrousels, les contraintes tiennent encore", () => {
    const month = [...Array(14).fill("cycle"), ...Array(3).fill("carousel"), ...Array(13).fill("single_statement")];
    const r = rhythm(orderByFormat(month, (a) => a));
    expect(Math.max(...r.maxInWindow)).toBeLessThanOrEqual(5);
    expect(r.longestRun).toBeLessThanOrEqual(3);
  });
});
