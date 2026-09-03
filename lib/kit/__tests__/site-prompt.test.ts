import { describe, expect, it } from "vitest";
import { buildSitePrompt, SITE_PROMPT_TARGETS } from "@/lib/kit/site-prompt";
import type { BrandKit } from "@/lib/data/brand-kit";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_VOICE_GUIDE,
} from "@/lib/brand/sample";

/*
 * Ce prompt part chez un constructeur qui va, lui, ÉCRIRE de la copy. Sans
 * les contraintes déontologiques dedans, tout le travail de l'Ethics Guard
 * s'arrête à la frontière du kit — c'est ce que ce test tient.
 */

function kit(overrides: Partial<BrandKit> = {}): BrandKit {
  return {
    row: {
      id: "kit",
      project_id: "project",
      content: {},
      created_at: "",
      updated_at: "",
      deleted_at: null,
      delivered_seen_at: null,
      home_content_seen_at: null,
      direction_id: null,
      directions: null,
      ethics_check: null,
      multi_builder_prompt: null,
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
    socialTemplates: null,
    voiceGuide: SAMPLE_VOICE_GUIDE,
    ethicsCheck: null,
    ...overrides,
  };
}

describe("buildSitePrompt", () => {
  it("porte les règles publicitaires, pas seulement la marque", () => {
    const prompt = buildSitePrompt(kit(), "lovable");

    expect(prompt).toContain("ADVERTISING RULES");
    expect(prompt).toContain("No client testimonials");
    expect(prompt).toContain("no guarantees");
    expect(prompt).toContain("Never tell the reader what they have.");
  });

  it("porte la palette, la typographie et l'accroche de la direction retenue", () => {
    const prompt = buildSitePrompt(kit(), "squarespace");

    expect(prompt).toContain("#B4674A");
    expect(prompt).toContain("Fraunces");
    expect(prompt).toContain("Nunito Sans");
    expect(prompt).toContain("A calmer place to start.");
    expect(prompt).toContain("Elm & Ember Counseling");
  });

  it("porte le guide de voix, contre-exemples compris", () => {
    const prompt = buildSitePrompt(kit(), "framer");
    expect(prompt).toContain("SOUNDS LIKE");
    expect(prompt).toContain("Plain words for clinical ideas.");
    expect(prompt).toContain("NEVER WRITE");
  });

  it("change de préambule et de guide selon le constructeur", () => {
    const prompts = SITE_PROMPT_TARGETS.map((target) =>
      buildSitePrompt(kit(), target.id)
    );
    expect(new Set(prompts).size).toBe(SITE_PROMPT_TARGETS.length);
    expect(buildSitePrompt(kit(), "webflow")).toContain("Webflow");
  });

  it("rend une chaîne vide quand aucune direction n'est retenue", () => {
    expect(buildSitePrompt(kit({ selectedDirection: null }), "lovable")).toBe("");
  });
});
