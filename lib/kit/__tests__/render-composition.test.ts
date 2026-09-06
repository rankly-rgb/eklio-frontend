import { describe, expect, it, vi, beforeAll } from "vitest";
import sharp from "sharp";

/*
 * Les quatre variations sont quatre ARRANGEMENTS de deux entrées, pas quatre
 * fonctionnalités. Ce qui est vérifié ici, c'est le câblage : quelle
 * variation mesure, laquelle voile, laquelle rapporte un rapport, et laquelle
 * refuse de rapporter un nombre qu'elle n'a pas mesuré.
 *
 * `satori` est stubé -- il exige un vrai fichier de police, donc du réseau, et
 * il est déjà exercé par les renderers d'assets. Ce qu'on teste ici est ce que
 * ce module ajoute par-dessus : la mesure, le voile, la composition, la ligne
 * de spécification.
 */
vi.mock("satori", () => ({
  default: async () =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="1" height="1" fill="#00000000"/></svg>',
}));
vi.mock("@/lib/kit/render/font-cache", () => ({
  getCachedFontBuffer: async () => Buffer.alloc(0),
}));

const { composeVariation, compositionSpecLine } = await import("@/lib/kit/render/composition");
const { HERO_TEXT_REGION } = await import("@/lib/kit/render/luminance");

const TOKENS = {
  primary: "#B4674A",
  paper: "#FAF6EE",
  dark_neutral: "#2B2A27",
  heading_font: "Fraunces",
};

let BRIGHT: Buffer;
let DARK: Buffer;

beforeAll(async () => {
  BRIGHT = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#FAFAFA" } })
    .webp().toBuffer();
  DARK = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#0A0A0A" } })
    .webp().toBuffer();
});

function input(variation: "full" | "text" | "photo" | "logo", photo: Buffer | null) {
  return {
    variation,
    photo,
    textRegion: HERO_TEXT_REGION,
    width: 600,
    height: 400,
    headline: "Room to think it through",
    wordmarkSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="4"><rect width="10" height="4"/></svg>',
    monogramSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>',
    tokens: TOKENS,
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Fraunces",
  };
}

describe("full : mesure, résout, et rapporte", () => {
  it("atteint la cible sur une photographie presque blanche", async () => {
    const out = await composeVariation(input("full", BRIGHT));
    expect(out.spec.meetsTarget).toBe(true);
    expect(out.spec.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(out.spec.scrimOpacity).toBeGreaterThan(0.6);
    expect(out.contentType).toBe("image/webp");
  });

  it("atteint la cible sur une photographie presque noire, sans l'enterrer", async () => {
    const out = await composeVariation(input("full", DARK));
    expect(out.spec.meetsTarget).toBe(true);
    expect(out.spec.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(out.spec.scrimOpacity).toBeLessThan(0.15);
  });

  it("les deux extrêmes ne reçoivent PAS le même voile", async () => {
    // Une valeur fixe rendrait ces deux nombres égaux : c'est tout le test.
    const bright = await composeVariation(input("full", BRIGHT));
    const dark = await composeVariation(input("full", DARK));
    expect(bright.spec.scrimOpacity).not.toBe(dark.spec.scrimOpacity);
  });

  it("la luminance rapportée est celle qui a été mesurée", async () => {
    const bright = await composeVariation(input("full", BRIGHT));
    const dark = await composeVariation(input("full", DARK));
    expect(bright.spec.measuredLuminance).toBeGreaterThan(0.9);
    expect(dark.spec.measuredLuminance).toBeLessThan(0.01);
  });
});

describe("les variations sans photographie, et sans titre", () => {
  it("text pose le titre sur un fond de sa palette et calcule son rapport", async () => {
    const out = await composeVariation(input("text", null));
    expect(out.spec.scrimOpacity).toBeNull();
    expect(out.spec.contrastRatio).not.toBeNull();
    expect(out.bytes.byteLength).toBeGreaterThan(0);
  });

  it.each(["photo", "logo"] as const)("« %s » ne rapporte AUCUN rapport", async (variation) => {
    // Pas de titre, donc rien à mesurer. Rapporter un nombre ici serait
    // l'inventer -- la règle « jamais un chiffre qu'Eklio ne mesure pas ».
    const out = await composeVariation(input(variation, variation === "photo" ? BRIGHT : null));
    expect(out.spec.contrastRatio).toBeNull();
    expect(out.spec.meetsTarget).toBeNull();
    expect(compositionSpecLine(out.spec)).toBe("No headline on this variation.");
  });

  it.each(["full", "photo"] as const)("« %s » refuse de composer sans photographie", async (variation) => {
    await expect(composeVariation(input(variation, null))).rejects.toThrow(/needs a photograph/);
  });
});

describe("la ligne de spécification dit un nombre mesuré", () => {
  it("nomme le rapport et le voile", async () => {
    const out = await composeVariation(input("full", BRIGHT));
    expect(compositionSpecLine(out.spec)).toMatch(/^Headline contrast \d+\.\d\d:1 over a \d+% scrim\.$/);
  });
});

describe("le titre ne vient JAMAIS du modèle", () => {
  it("ce module ne connaît aucun client d'image", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../render/composition.ts"), "utf8");
    for (const forbidden of ["images/client", "openAiImageClient", "gpt-image", "generate("]) {
      expect(source).not.toContain(forbidden);
    }
    // Et il compose bien son texte avec satori.
    expect(source).toContain('from "satori"');
  });
});
