import { describe, expect, it } from "vitest";
import { renderBrandKitPdf } from "@/lib/kit/pdf";
import type { BrandKit } from "@/lib/data/brand-kit";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_SOCIAL_TEMPLATES,
  SAMPLE_VOICE_GUIDE,
} from "@/lib/brand/sample";

/*
 * Le PDF est écrit à la main : ce test tient la structure du fichier, parce
 * qu'un octet de décalage dans la table xref donne un fichier qu'aucun lecteur
 * n'ouvre — et que ça ne se voit pas à la compilation.
 */

function kit(overrides: Partial<BrandKit> = {}): BrandKit {
  return {
    row: {
      id: "kit",
      project_id: "project",
      content: {},
      created_at: "",
      updated_at: "",
      direction_id: null,
      directions: null,
      ethics_check: null,
      multi_builder_prompt: null,
      origin: "generated",
      pdf_url: null,
      practitioner_line: "Nora Whitfield, LCSW",
      selected_direction_id: SAMPLE_DIRECTIONS[1].id,
      share_slug: null,
      site_prompt: null,
      site_prompt_target: null,
      social_templates: null,
      tier: "starter",
      voice_guide: null,
    },
    projectId: "project",
    practiceName: SAMPLE_PRACTICE_NAME,
    directions: SAMPLE_DIRECTIONS,
    selectedDirection: SAMPLE_DIRECTIONS[1],
    socialTemplates: SAMPLE_SOCIAL_TEMPLATES,
    voiceGuide: SAMPLE_VOICE_GUIDE,
    ethicsCheck: null,
    ...overrides,
  };
}

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("renderBrandKitPdf", () => {
  it("produit un fichier PDF bien formé", () => {
    const text = decode(renderBrandKitPdf(kit()));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("startxref");
  });

  it("les offsets de la table xref pointent bien sur leurs objets", () => {
    const text = decode(renderBrandKitPdf(kit()));

    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");

    const table = text.slice(startxref).split("\n");
    // Ligne 0 : « xref », ligne 1 : « 0 N », ligne 2 : l'objet libre.
    const total = Number(table[1].split(" ")[1]);
    for (let index = 1; index < total; index += 1) {
      const offset = Number(table[2 + index].slice(0, 10));
      expect(text.slice(offset).startsWith(`${index} 0 obj`)).toBe(true);
    }
  });

  it("écrit les couleurs réelles de la palette, pas un gris de repli", () => {
    const text = decode(renderBrandKitPdf(kit()));
    // #B4674A = rgb(180, 103, 74) → 0.706 0.404 0.290 rg
    expect(text).toContain("0.706 0.404 0.290 rg");
    expect(text).toContain("PRIMARY #B4674A");
  });

  it("reste valide quand aucune direction n'est retenue", () => {
    const bare = kit({
      selectedDirection: null,
      directions: null,
      voiceGuide: null,
      socialTemplates: null,
    });
    const text = decode(renderBrandKitPdf(bare));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });
});
