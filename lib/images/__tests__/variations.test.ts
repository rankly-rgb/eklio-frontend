import { describe, expect, it } from "vitest";
import {
  IMAGE_VARIATIONS,
  VARIATION_CLAUSE,
  VARIATION_LABEL,
  isImageVariation,
  regenerationsRemaining,
  variationClause,
} from "@/lib/images/variations";
import { buildImagePrompt } from "@/lib/images/prompt";
import { computeImageFingerprint, type ImageFingerprintInput } from "@/lib/images/fingerprint";
import { slotPriceCents } from "@/lib/images/config";

const BASE: ImageFingerprintInput = {
  toneKeywords: ["calm", "plain", "warm"],
  palette: {
    primary: "#B4653F", secondary: "#2E4E8A", accent: "#7A8B6F",
    paper: "#FAF7F2", light_neutral: "#E8E2D9", dark_neutral: "#2B2724",
  },
  specialty: "self_esteem",
};

describe("la régénération est quatre boutons, jamais un champ de texte", () => {
  it("il y en a exactement quatre, et pas d'échappatoire", () => {
    expect([...IMAGE_VARIATIONS]).toEqual(["lighter", "warmer", "fewer_objects", "different_framing"]);
    expect(isImageVariation("lighter")).toBe(true);
    expect(isImageVariation("make it look like my old website")).toBe(false);
  });

  it("chaque variation a un libellé et une clause", () => {
    for (const variation of IMAGE_VARIATIONS) {
      expect(VARIATION_LABEL[variation]).toBeTruthy();
      expect(VARIATION_CLAUSE[variation].length).toBeGreaterThan(30);
    }
  });

  it("une clause change le prompt, et l'absence de clause le laisse intact", () => {
    const plain = buildImagePrompt("hero", BASE);
    expect(buildImagePrompt("hero", BASE, variationClause(null))).toBe(plain);
    for (const variation of IMAGE_VARIATIONS) {
      expect(buildImagePrompt("hero", BASE, variationClause(variation))).not.toBe(plain);
    }
  });

  it("une variation ne déplace PAS l'empreinte", () => {
    /*
     * Voulu : une variation demande une AUTRE photographie de la même marque,
     * pas un changement de la marque. Si elle était hachée, chaque coup de
     * pouce forgerait une identité permanente pour l'emplacement et la ligne
     * obtenue cesserait de correspondre à l'empreinte du kit.
     */
    const before = computeImageFingerprint(BASE);
    for (const variation of IMAGE_VARIATIONS) {
      // La clause ne fait pas partie de l'entrée hachée -- par construction.
      expect(variationClause(variation)).not.toBe("");
      expect(computeImageFingerprint(BASE)).toBe(before);
    }
  });

  it("aucune clause ne nomme la lumière -- le maître la possède", () => {
    // « Lighter » parle de la QUANTITÉ de mur pâle dans le cadre, pas d'une
    // seconde source lumineuse qui contredirait la direction maîtresse.
    const FORBIDDEN = ["daylight", "sunlight", "lighting", "backlit", "sunlit", "overcast", "lamp"];
    for (const variation of IMAGE_VARIATIONS) {
      const words = VARIATION_CLAUSE[variation].toLowerCase().match(/[a-z]+/g) ?? [];
      expect(words.filter((word) => FORBIDDEN.includes(word))).toEqual([]);
    }
  });
});

describe("« il vous en reste » se compte avec le prix DE CET emplacement", () => {
  it("un budget de 100 centimes vaut 4 héros ou 20 textures", () => {
    // 25c contre 5c : « 3 restantes » sur deux écrans voisins voudrait dire
    // deux choses différentes si l'on divisait par une moyenne.
    expect(regenerationsRemaining(100, slotPriceCents("hero"))).toBe(4);
    expect(regenerationsRemaining(100, slotPriceCents("texture"))).toBe(20);
  });

  it("elle arrondit vers le bas, et ne descend jamais sous zéro", () => {
    expect(regenerationsRemaining(24, 25)).toBe(0);
    expect(regenerationsRemaining(-5, 25)).toBe(0);
    expect(regenerationsRemaining(100, 0)).toBe(0);
  });
});
