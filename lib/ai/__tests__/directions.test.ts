import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIRECTIONS_SYSTEM_PROMPT,
  directionsResultSchema,
  generateDirectionsWithModel,
  paletteFromStored,
  type DirectionsModelCall,
  type DirectionsResult,
} from "@/lib/ai/directions";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefDraft } from "@/lib/brief/schemas";

/*
 * Contrat de la génération gardée (Lot 2) : la couche déontologique du Lot 0
 * enveloppe l'appel modèle. Ce qui est vérifié ici, c'est le comportement
 * observable — régénération sur violation, échec propre sinon — sans jamais
 * appeler l'API Anthropic : `callModel` est injecté.
 */

const draft: BriefDraft = {
  practice_name: "Hearth Counseling",
  license_type: "lmft",
  offer: "Couples therapy and weekend intensives.",
  emotions: ["safety", "steadiness", "warmth"],
  color_families: ["warm_neutrals"],
  type_style: "editorial_serif",
  site_goal: "book_consultations",
};

function direction(name: string, description: string) {
  return {
    name,
    description,
    palette: {
      primary: "#2C4A6E",
      secondary: "#D9CBB8",
      accent: "#C57B45",
      neutral_light: "#F4F1EC",
      neutral_dark: "#16233A",
    },
    heading_font: "Fraunces",
    body_font: "Inter",
  };
}

const COMPLIANT: DirectionsResult = {
  directions: [
    direction(
      "Quiet Hearth",
      "A composed, unhurried presence that gives the reader room to think. The palette stays warm and low-contrast so the page feels like a room, not a pitch."
    ),
    direction(
      "Open Table",
      "Warmer and more conversational, built for someone who has been considering therapy for a while. It describes what a first session is like rather than what it leads to."
    ),
    direction(
      "Level Ground",
      "A contemporary, steady voice with clean structure and generous space. It leans on credentials and training to carry authority."
    ),
  ],
};

/* Promesse de résultat sur une condition nommée — violation `block`. */
const VIOLATING_DESCRIPTION: DirectionsResult = {
  directions: [
    direction(
      "Quiet Hearth",
      "A warm, grounded presence for people carrying more than they say. This will heal your anxiety in twelve weeks, guaranteed."
    ),
    COMPLIANT.directions[1],
    COMPLIANT.directions[2],
  ],
};

/* Superlatif auto-décerné dans le NOM, pas dans la description. */
const VIOLATING_NAME: DirectionsResult = {
  directions: [
    direction(
      "Best Therapist Downtown",
      "A composed, unhurried presence that gives the reader room to think."
    ),
    COMPLIANT.directions[1],
    COMPLIANT.directions[2],
  ],
};

beforeEach(() => {
  // La couche ethics journalise chaque violation : on la tait pendant les tests.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prompt système", () => {
  it("injecte le socle déontologique (garde-fou de niveau 1)", () => {
    expect(DIRECTIONS_SYSTEM_PROMPT).toContain(ETHICS_SYSTEM_RULES);
  });
});

describe("génération gardée — régénération sur violation", () => {
  it("régénère quand une description promet un résultat, puis renvoie la version conforme", async () => {
    const calls: (string | null)[] = [];
    const callModel: DirectionsModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1 ? VIOLATING_DESCRIPTION : COMPLIANT;
    };

    const result = await generateDirectionsWithModel(
      "Hearth Counseling",
      draft,
      callModel
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeNull();
    // La reprise cite l'extrait fautif : c'est ce qui la fait atterrir.
    expect(calls[1]).toContain("heal your anxiety");
    expect(result).toEqual(COMPLIANT);
  });

  it("surveille aussi le nom de direction, pas seulement la description", async () => {
    const calls: (string | null)[] = [];
    const callModel: DirectionsModelCall = async (_prompt, feedback) => {
      calls.push(feedback);
      return calls.length === 1 ? VIOLATING_NAME : COMPLIANT;
    };

    const result = await generateDirectionsWithModel(
      "Hearth Counseling",
      draft,
      callModel
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("Best Therapist");
    expect(result).toEqual(COMPLIANT);
  });

  it("transmet le même prompt de brief à chaque tentative", async () => {
    const prompts: string[] = [];
    const callModel: DirectionsModelCall = async (prompt) => {
      prompts.push(prompt);
      return prompts.length === 1 ? VIOLATING_DESCRIPTION : COMPLIANT;
    };

    await generateDirectionsWithModel("Hearth Counseling", draft, callModel);

    expect(prompts[0]).toBe(prompts[1]);
    expect(prompts[0]).toContain("Hearth Counseling");
  });
});

describe("génération gardée — échec propre", () => {
  it("lève EthicsComplianceError sans renvoyer de contenu non conforme", async () => {
    let attempts = 0;
    const callModel: DirectionsModelCall = async () => {
      attempts += 1;
      return VIOLATING_DESCRIPTION;
    };

    await expect(
      generateDirectionsWithModel("Hearth Counseling", draft, callModel)
    ).rejects.toBeInstanceOf(EthicsComplianceError);

    // Première tentative + 2 reprises : au-delà, on abandonne.
    expect(attempts).toBe(3);
  });

  it("remonte l'échec structurel avant même la vérification déontologique", async () => {
    // 2 directions au lieu de 3 : `directionsResultSchema` doit lever dans
    // l'appel modèle, sans laisser passer un résultat partiel.
    const callModel: DirectionsModelCall = async () => {
      return directionsResultSchema.parse({
        directions: COMPLIANT.directions.slice(0, 2),
      });
    };

    await expect(
      generateDirectionsWithModel("Hearth Counseling", draft, callModel)
    ).rejects.toThrow();
  });
});

describe("palette stockée", () => {
  it("relit les palettes enregistrées sous les clés françaises", () => {
    expect(
      paletteFromStored({
        primaire: "#2C4A6E",
        secondaire: "#D9CBB8",
        accent: "#C57B45",
        neutre_clair: "#F4F1EC",
        neutre_fonce: "#16233A",
      })
    ).toEqual(COMPLIANT.directions[0].palette);
  });

  it("relit les palettes anglaises telles quelles et ignore le reste", () => {
    expect(
      paletteFromStored({ ...COMPLIANT.directions[0].palette, inconnu: "#000000" })
    ).toEqual(COMPLIANT.directions[0].palette);
    expect(paletteFromStored(null)).toEqual({});
    expect(paletteFromStored("#fff")).toEqual({});
  });
});
