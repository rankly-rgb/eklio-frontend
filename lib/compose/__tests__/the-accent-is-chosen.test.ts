import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { contrastRatio } from "@/lib/brand/color";
import { render } from "@/lib/compose/engine";
import { cardPalette, curatedAccent, type DirectionPalette, type PaletteFamilyRow } from "@/lib/compose/palette";
import { grainedWorst, groundFor } from "@/lib/compose/grounds";
import { floorFor, textClass } from "@/lib/compose/text-class";

/*
 * L'ENCRE D'ACCENT EST CHOISIE, PAS DÉRIVÉE (2026-11-04). Elle est lue dans
 * `palette_families.accent_hex` — les valeurs des migrations du backend, telles
 * quelles — et doit tenir le plancher de la classe de chaque ligne où elle se
 * pose, pour les six familles en clair et en sombre (douze variantes).
 */
const DIR = "../eklio-backend/supabase/migrations";
const sql = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`${DIR}/${f}`, "utf8")).join("\n");
const families: Array<PaletteFamilyRow & { id: string }> = [];
for (const ins of sql.matchAll(/insert into public\.palette_families[\s\S]*?;/gi)) {
  for (const r of ins[0].matchAll(/\('([a-z_]+)',\s*\d+,\s*(?:true|false),\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})'/g)) {
    const [, id, primary_hex, secondary_hex, light_hex, dark_hex, paper_hex] = r;
    if (!families.some((f) => f.id === id)) families.push({ id, primary_hex, secondary_hex, light_hex, dark_hex, paper_hex, accent_hex: "#FF00FF" });
  }
}
for (const m of sql.matchAll(/update public\.palette_families set accent_hex = '(#[0-9A-Fa-f]{6})' where id = '([a-z_]+)'/g)) {
  const f = families.find((x) => x.id === m[2]);
  if (f) f.accent_hex = m[1];
}

describe("les six familles portent un accent choisi", () => {
  it("six familles, six accents, aucun « pas encore choisi »", () => {
    expect(families).toHaveLength(6);
    for (const f of families) expect(f.accent_hex, f.id).not.toBe("#FF00FF");
  });
});

for (const f of families) {
  const direction: DirectionPalette = { primary: f.primary_hex, secondary: f.secondary_hex, light: f.light_hex, dark: f.dark_hex, paper: f.paper_hex };
  const withAccent = { ...direction, accent: curatedAccent(direction, families)! };

  for (const dark of [false, true]) {
    describe(`${f.id}${dark ? " (sombre)" : ""}`, () => {
      it("la direction lit l'accent de SA famille", () => {
        expect(withAccent.accent).toBe(f.accent_hex);
      });

      for (const g of ["cream", "ochre", "terra", "deep", "photo"] as const) {
        it(`fond ${g} : l'accent tient le plancher de la classe de chaque ligne, ou l'italique est seul`, () => {
          const ground = groundFor(withAccent, g)!;
          const palette = cardPalette("k", withAccent, dark);
          const r = render({
            archetype: "single_statement",
            payload: { statement: "Something can be long over and still shape today.", emphasis: "still shape today" },
            headline: "x y", eyebrow: "NOT THE ONLY ONE", footer: "Ember · LMFT 1",
            palette, illustration: "grief-two-paths", ground,
          });
          const lines = r.composition.placed.flatMap((p) => (p.role === "text" && p.band === "headline" ? p.lines : []));
          for (const l of lines.filter((x) => x.spans?.some((s) => s.emphasis))) {
            if (l.emphasisFill === l.fill) continue; /* italique seul */
            expect(dark).toBe(false);
            expect(["cream", "ochre", "terra"]).toContain(g);
            expect(l.emphasisFill).toBe(f.accent_hex);
            const worst = grainedWorst(ground.background, g);
            expect(contrastRatio(l.emphasisFill!, worst)).toBeGreaterThanOrEqual(floorFor(textClass(l.size, l.weight, "headline")));
          }
          /* Sur crème, en clair, l'accent est bien posé : la règle n'est pas vide. */
          if (!dark && g === "cream") expect(lines.some((l) => l.emphasisFill === f.accent_hex)).toBe(true);
        });
      }
    });
  }
}
