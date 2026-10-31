import { describe, expect, it } from "vitest";
import { monthLayouts } from "@/lib/content/month/run-for-kit";
import { IMAGE_ARCHETYPES } from "@/lib/data/content-catalogue";

/*
 * Novembre 2026, kit 45de0dac : 24 posts au lieu de 30. Sans préférences, le
 * registre par défaut était `"educate"` — une intention, pas un registre — et
 * une mise en page sur deux valait `undefined` : 28 écritures refusées par
 * `content_items.archetype NOT NULL`, banc épuisé.
 */
describe("chaque candidat a une mise en page, quelles que soient ses préférences", () => {
  it("sans préférences : toutes les mises en page sont connues, et variées", () => {
    const layouts = monthLayouts(null, 66);
    expect(layouts).toHaveLength(66);
    for (const l of layouts) expect(IMAGE_ARCHETYPES).toContain(l);
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(4);
  });

  it("une préférence vide se lit comme l'absence de préférence", () => {
    expect(monthLayouts([], 12)).toEqual(monthLayouts(null, 12));
  });

  it("le défaut d'hier (« educate », une intention) ne produit plus de trou", () => {
    const layouts = monthLayouts(["educate"], 30);
    expect(layouts.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
    expect(layouts).toEqual(monthLayouts(null, 30));
  });

  it("les registres inconnus sont ignorés, les connus décident", () => {
    const layouts = monthLayouts(["educate", "named_feeling", "reflective_question"], 10);
    expect(new Set(layouts)).toEqual(new Set(["statement", "question"]));
  });

  it("un seul registre ne répète jamais deux fois de suite la même mise en page", () => {
    const layouts = monthLayouts(["named_feeling"], 10);
    for (let i = 1; i < layouts.length; i += 1) expect(layouts[i]).not.toBe(layouts[i - 1]);
  });
});
