import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  CONTRAST_TARGET,
  contrastRatio,
  hexLuminance,
  HERO_TEXT_REGION,
  measureRegionLuminance,
  POST_TEXT_REGION,
  solveScrimOpacity,
} from "@/lib/kit/render/luminance";

/*
 * ── LES DEUX EXTRÊMES, PARCE QU'UNE IMAGE MOYENNE NE PROUVE RIEN ────────
 *
 * Un voile à opacité fixe passe sur une photographie de luminance moyenne et
 * échoue aux deux bouts : sur une image très claire le texte disparaît, sur
 * une image très sombre le voile enterre une photographie qu'elle a payée.
 * Tester avec une image moyenne validerait donc une fonctionnalité cassée.
 *
 * Ces fixtures sont donc délibérément extrêmes : #FAFAFA (presque blanc) et
 * #0A0A0A (presque noir), encodées en webp comme le pipeline les stocke.
 */

const PAPER = "#FAF6EE";
const DARK = "#2B2A27";

async function webpOf(hex: string, width = 256, height = 256): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: hex } })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Moitié gauche très claire, moitié droite très sombre. */
async function splitWebp(): Promise<Buffer> {
  const left = await sharp({ create: { width: 128, height: 256, channels: 3, background: "#FAFAFA" } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 256, height: 256, channels: 3, background: "#0A0A0A" } })
    .composite([{ input: left, top: 0, left: 0 }])
    .webp({ quality: 82 })
    .toBuffer();
}

describe("la luminance est mesurée sur les pixels, pas devinée", () => {
  it("une image presque blanche mesure haut, une presque noire mesure bas", async () => {
    const bright = await measureRegionLuminance(await webpOf("#FAFAFA"), HERO_TEXT_REGION);
    const dark = await measureRegionLuminance(await webpOf("#0A0A0A"), HERO_TEXT_REGION);
    expect(bright).toBeGreaterThan(0.9);
    expect(dark).toBeLessThan(0.01);
  });

  it("la région compte : le même fichier mesure différemment à gauche et à droite", async () => {
    // La preuve que ce n'est pas une moyenne globale déguisée.
    const photo = await splitWebp();
    const leftThird = await measureRegionLuminance(photo, HERO_TEXT_REGION);
    const rightThird = await measureRegionLuminance(photo, { x: 2 / 3, y: 0, width: 1 / 3, height: 1 });
    expect(leftThird).toBeGreaterThan(0.9);
    expect(rightThird).toBeLessThan(0.01);
  });

  it("elle linéarise : la moyenne encodée mentirait", async () => {
    // Un gris moyen 50 % encodé (#808080) a une luminance RELATIVE d'environ
    // 0,216, pas 0,5. Une moyenne sur les canaux encodés rendrait ~0,5 et
    // sous-estimerait de moitié le voile nécessaire.
    const mid = await measureRegionLuminance(await webpOf("#808080"), HERO_TEXT_REGION);
    expect(mid).toBeGreaterThan(0.19);
    expect(mid).toBeLessThan(0.24);
  });
});

describe("le voile est résolu, jamais fixe", () => {
  it("une photographie presque blanche exige un voile fort", async () => {
    const measured = await measureRegionLuminance(await webpOf("#FAFAFA"), HERO_TEXT_REGION);
    const solution = solveScrimOpacity(measured, DARK, PAPER);
    expect(solution.meetsTarget).toBe(true);
    expect(solution.ratio).toBeGreaterThanOrEqual(CONTRAST_TARGET);
    expect(solution.opacity).toBeGreaterThan(0.6);
  });

  it("une photographie presque noire n'en exige presque aucun", async () => {
    const measured = await measureRegionLuminance(await webpOf("#0A0A0A"), POST_TEXT_REGION);
    const solution = solveScrimOpacity(measured, DARK, PAPER);
    expect(solution.meetsTarget).toBe(true);
    expect(solution.ratio).toBeGreaterThanOrEqual(CONTRAST_TARGET);
    // Le voile ne doit pas enterrer une image déjà sombre.
    expect(solution.opacity).toBeLessThan(0.15);
  });

  it("les deux extrêmes ne donnent PAS la même opacité", async () => {
    // C'est tout le test : une valeur fixe rendrait ces deux nombres égaux.
    const bright = solveScrimOpacity(
      await measureRegionLuminance(await webpOf("#FAFAFA"), HERO_TEXT_REGION), DARK, PAPER
    );
    const dark = solveScrimOpacity(
      await measureRegionLuminance(await webpOf("#0A0A0A"), HERO_TEXT_REGION), DARK, PAPER
    );
    expect(bright.opacity).not.toBe(dark.opacity);
    expect(bright.opacity).toBeGreaterThan(dark.opacity);
  });

  it("il monte jusqu'à atteindre la cible, pas au-delà", () => {
    // La plus basse opacité qui franchit 4,5:1 -- un cran en dessous échoue.
    const measured = 0.75;
    const solution = solveScrimOpacity(measured, DARK, PAPER);
    expect(solution.meetsTarget).toBe(true);
    const justBelow = solveScrimOpacity(measured, DARK, PAPER, solution.ratio + 0.5);
    expect(justBelow.opacity).toBeGreaterThan(solution.opacity);
  });

  it("une palette où le voile n'aide pas est rapportée honnêtement", () => {
    // `dark_neutral` plus clair que le texte : monter le voile ne peut pas
    // atteindre la cible. On rapporte le meilleur atteint, sans prétendre.
    const solution = solveScrimOpacity(0.5, "#FFFFFF", "#FAF6EE");
    expect(solution.meetsTarget).toBe(false);
    expect(solution.ratio).toBeLessThan(CONTRAST_TARGET);
  });
});

describe("les primitives WCAG", () => {
  it("le blanc sur le noir fait 21:1", () => {
    expect(contrastRatio(hexLuminance("#FFFFFF"), hexLuminance("#000000"))).toBeCloseTo(21, 1);
  });

  it("le rapport est indépendant de l'ordre", () => {
    const a = hexLuminance("#B4674A");
    const b = hexLuminance("#FAF6EE");
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });
});
