import { describe, expect, it } from "vitest";
import {
  MAX_OVERLAY_SCRIM,
  contrastRatio,
  relativeLuminance,
  solveOverlayScrim,
} from "@/lib/brand/color";

/*
 * Le voile de la surimpression du hero — celui qui porte les trois mots de
 * ton de sa direction par-dessus la photographie.
 *
 * ── Ce que ce solveur promet, et ce qu'il ne promet pas ─────────────────
 *
 * Il ne MESURE rien. Il résout contre le pire fond possible — un pixel blanc
 * — et rend donc un PLANCHER : la photographie réelle, plus sombre que du
 * blanc, ne peut que faire mieux. C'est la propriété que ces tests
 * vérifient, parce que c'est celle sur laquelle la lisibilité repose.
 *
 * Le solveur MESURÉ existe ailleurs (`lib/kit/render/luminance.ts`) et sert
 * le pipeline de rendu, qui a les pixels sous la main. Ici on ne les a pas.
 */

/** Ce que la surimpression pose réellement : du blanc. */
const WHITE = "#FFFFFF";

/** Le fond composé à une opacité donnée, sur le pire cas (du blanc). */
function blended(scrimHex: string, alpha: number): string {
  const value = Number.parseInt(scrimHex.slice(1), 16);
  const mix = (channel: number) => Math.round(255 * (1 - alpha) + channel * alpha);
  const r = mix((value >> 16) & 0xff);
  const g = mix((value >> 8) & 0xff);
  const b = mix(value & 0xff);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

describe("le voile est résolu, pas choisi", () => {
  it("un neutre sombre atteint la cible, et le rapport rendu est le vrai", () => {
    const solution = solveOverlayScrim("#2B2118", WHITE);

    expect(solution.meetsTarget).toBe(true);
    expect(solution.alpha).toBeGreaterThan(0);
    expect(solution.alpha).toBeLessThanOrEqual(MAX_OVERLAY_SCRIM);

    // Le nombre rapporté est celui qu'on obtient en composant réellement.
    const actual = contrastRatio(WHITE, blended("#2B2118", solution.alpha));
    expect(actual).toBeCloseTo(solution.ratio, 2);
    expect(actual).toBeGreaterThanOrEqual(4.5);
  });

  it("⚠ c'est la PREMIÈRE opacité qui passe, pas la plus confortable", () => {
    // Un cran en dessous doit échouer : sinon le voile enterre une
    // photographie qu'elle a payée plus que nécessaire.
    const solution = solveOverlayScrim("#2B2118", WHITE);
    const justBelow = contrastRatio(WHITE, blended("#2B2118", solution.alpha - 0.01));
    expect(justBelow).toBeLessThan(4.5);
  });

  it("⚠ le plancher tient : toute photo réelle fait mieux que le pire cas", () => {
    const scrim = "#2B2118";
    const { alpha, ratio } = solveOverlayScrim(scrim, WHITE);

    /*
     * Le pire cas est le blanc. On compose le même voile sur des fonds de
     * plus en plus sombres : le contraste ne doit jamais DESCENDRE sous le
     * rapport annoncé, sans quoi « plancher » serait un mensonge.
     */
    for (const photo of ["#FFFFFF", "#C8C0B4", "#8A8178", "#4A4239", "#000000"]) {
      const value = Number.parseInt(photo.slice(1), 16);
      const mix = (channel: number, base: number) =>
        Math.round(base * (1 - alpha) + channel * alpha);
      const s = Number.parseInt(scrim.slice(1), 16);
      const r = mix((s >> 16) & 0xff, (value >> 16) & 0xff);
      const g = mix((s >> 8) & 0xff, (value >> 8) & 0xff);
      const b = mix(s & 0xff, value & 0xff);
      const composed = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;

      expect(contrastRatio(WHITE, composed)).toBeGreaterThanOrEqual(ratio - 0.01);
    }
  });

  it("un neutre trop clair le dit plutôt que de le prétendre", () => {
    // Du blanc sur du blanc ne passe à aucune opacité. La réponse honnête
    // est `meetsTarget: false`, pas une opacité qui ne résout rien.
    const solution = solveOverlayScrim("#FAF7F2", WHITE);
    expect(solution.meetsTarget).toBe(false);
    expect(solution.alpha).toBeLessThanOrEqual(MAX_OVERLAY_SCRIM);
  });

  it("un hex invalide ne renvoie pas un voile transparent", () => {
    // Échouer en « pas de voile » poserait du texte blanc nu sur la photo.
    const solution = solveOverlayScrim("not-a-hex", WHITE);
    expect(solution.meetsTarget).toBe(false);
    expect(solution.alpha).toBe(MAX_OVERLAY_SCRIM);
  });

  it("la luminance employée est bien linéarisée (WCAG), pas la moyenne des octets", () => {
    // Un gris 50 % encodé (#808080) a une luminance relative d'environ 0.216,
    // pas 0.5. C'est l'erreur classique, et elle surestime les régions
    // sombres.
    expect(relativeLuminance("#808080")).toBeCloseTo(0.216, 2);
  });
});
