import { describe, expect, it } from "vitest";
import calibration from "@/lib/compose/__tests__/fixtures/estimator-calibration.json";
import { measure } from "@/lib/compose/measure";
import type { FontRole } from "@/lib/compose/types";

/*
 * L'estimateur de largeur est une BORNE HAUTE, et c'est ce qui rend les
 * dégagements vrais au rendu. Cormorant Garamond et Parisienne (spec visuelle du
 * 2026-11-02) ont été calibrées sur l'encre réelle rendue par resvg avec les
 * fichiers de Google Fonts, à 100px (fixture) ; Fraunces et Karla en témoins.
 */
const ROLE: Record<string, FontRole> = { Fraunces: "display", "Cormorant Garamond": "serif", Parisienne: "script", Karla: "sans" };

describe("l'estimateur ne sous-estime jamais une police composée", () => {
  it.each(Object.entries(calibration as Record<string, Array<{ s: string; ink: number }>>))("%s", (family, samples) => {
    for (const { s, ink } of samples) expect(measure(s, ROLE[family], 100), `${family} « ${s} »`).toBeGreaterThanOrEqual(ink);
  });
});
