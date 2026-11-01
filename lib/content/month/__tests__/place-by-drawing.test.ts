import { describe, expect, it } from "vitest";
import { placeByDrawing } from "@/lib/content/month/select";

/*
 * L'ordre du mois n'est pas un contenu : un post qu'aucun dessin ne dit à son
 * rang est déplacé avant d'être jeté (répétition locale du 2026-11-01).
 */
/** Un faux appariement : « a » et « b » ne connaissent que le dessin X, à dix rangs d'écart au moins. */
function assign(posts: string[]): Array<string | null> {
  const last = new Map<string, number>();
  return posts.map((p, i) => {
    const want = p === "a" || p === "b" ? "X" : `own-${p}`;
    const prev = last.get(want);
    if (prev !== undefined && i - prev < 10) return null;
    last.set(want, i);
    return want;
  });
}

describe("placeByDrawing", () => {
  const fillers = Array.from({ length: 12 }, (_, i) => `f${i}`);

  it("rien à déplacer : l'ordre et les dessins sont rendus tels quels", () => {
    const posts = ["a", ...fillers.slice(0, 10), "b"];
    expect(placeByDrawing(posts, assign).posts).toEqual(posts);
  });

  it("deux voisins qui veulent le même dessin : le second est déplacé à dix rangs, et garde son dessin", () => {
    const out = placeByDrawing(["a", "b", ...fillers], assign);
    expect(out.drawings.every((d) => d !== null)).toBe(true);
    expect(out.posts.indexOf("b") - out.posts.indexOf("a")).toBeGreaterThanOrEqual(10);
    expect([...out.posts].sort()).toEqual(["a", "b", ...fillers].sort());
  });

  it("aucune place ne convient : le null reste, rien n'est inventé", () => {
    const out = placeByDrawing(["a", "b", "f0", "f1"], assign);
    expect(out.drawings.filter((d) => d === null)).toHaveLength(1);
  });
});
