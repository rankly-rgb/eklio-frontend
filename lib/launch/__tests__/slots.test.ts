import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launchSlots } from "@/lib/launch/slots";

const ROOT = resolve(__dirname, "../../..");

/*
 * Les deux emplacements optionnels. Le test qui compte est celui de l'ABSENCE :
 * un bloc dont tout l'intérêt est d'être cliqué, portant une URL que personne
 * n'a posée, est le pire défaut que cet écran puisse livrer.
 */
describe("⚠ un emplacement non configuré ne rend RIEN", () => {
  it("sans variables, les deux sont nuls — aucune URL de repli", () => {
    expect(launchSlots({})).toEqual({
      videoUrl: null,
      affiliateUrl: null,
    });
  });

  it("une chaîne vide ou blanche compte comme non posée", () => {
    expect(
      launchSlots({
        NEXT_PUBLIC_LAUNCH_SITE_VIDEO_URL: "",
        NEXT_PUBLIC_LAUNCH_LOVABLE_AFFILIATE_URL: "   ",
      })
    ).toEqual({ videoUrl: null, affiliateUrl: null });
  });

  it("une valeur malformée laisse l'emplacement vide plutôt qu'une ancre cassée", () => {
    expect(
      launchSlots({
        NEXT_PUBLIC_LAUNCH_SITE_VIDEO_URL: "pas-une-url",
        NEXT_PUBLIC_LAUNCH_LOVABLE_AFFILIATE_URL: "http://exemple.test/x",
      })
    ).toEqual({ videoUrl: null, affiliateUrl: null });
  });

  it("et une https valide passe", () => {
    expect(
      launchSlots({
        NEXT_PUBLIC_LAUNCH_SITE_VIDEO_URL: "https://exemple.test/v",
      })
    ).toEqual({ videoUrl: "https://exemple.test/v", affiliateUrl: null });
  });

  it("⚠ aucune URL de repli n'est codée dans le module des emplacements", () => {
    // Un « coming soon » ou une URL de démonstration se verrait ici.
    const source = readFileSync(join(ROOT, "lib/launch/slots.ts"), "utf8");
    expect(source).not.toMatch(/https:\/\/(?!\w*\.?example)/);
  });
});

describe("le lien sortant de l'étape 1", () => {
  const source = readFileSync(join(ROOT, "components/launch/site-setup-material.tsx"), "utf8");

  it("chaque ancre externe porte target ET rel=noopener noreferrer", () => {
    const anchors = source.match(/<a\s[^>]*href=\{?[^>]*?>/g) ?? [];
    const external = anchors.filter((a) => /slots\.|LOVABLE\.url/.test(a));
    expect(external.length).toBeGreaterThan(0);
    for (const anchor of external) {
      expect(anchor).toMatch(/target="_blank"/);
      expect(anchor).toMatch(/rel="noopener noreferrer"/);
    }
  });

  it("⚠ le lien Lovable est une porte d'entrée, pas un lien profond", () => {
    expect(source).toContain('url: "https://lovable.dev/"');
    // Aucun chemin, aucun paramètre, aucun identifiant construit.
    expect(source).not.toMatch(/lovable\.dev\/[a-z]/i);
  });

  it("⚠ le prompt n'est affiché que si le scan passe", () => {
    expect(source).toContain("prompt.scan.ok ? <PromptWell");
    expect(source).toContain("!prompt.scan.ok");
  });
});
