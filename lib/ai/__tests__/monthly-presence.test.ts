import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  buildPresencePrompt,
  generatePresenceWithModel,
  parsePresenceResponse,
  PRESENCE_SYSTEM_PROMPT,
  PresenceTruncatedError,
  type PresenceInput,
} from "@/lib/ai/monthly-presence";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { MonthlyPresence } from "@/lib/presence/content";

/*
 * Les gardes de la génération mensuelle, sans réseau : l'appel modèle est
 * injecté. Ce qui est figé ici, c'est qu'AUCUN mois non conforme ne peut sortir
 * de cette fonction — le contenu qui en sort est publiable, ou rien n'en sort.
 */

const INPUT: PresenceInput = {
  projectName: "Hearth Counseling",
  draft: { practice_name: "Hearth Counseling" },
  month: "2026-02-01",
  monthLabel: "February 2026",
  daysInMonth: 28,
  kit: {
    positioning_statement: "A couples practice for partners who keep circling.",
    brand_story: "Why this practice exists.",
    voice_and_tone: {
      adjectives: ["warm", "direct", "unhurried"],
      do_examples: ["A first session is ninety minutes."],
      dont_examples: ["Naming a timeframe for how someone will feel."],
    },
    website_copy: [
      { page: "home", sections: [{ heading: "Welcome", body: "Body copy." }] },
    ],
    social_templates: [],
  },
  direction: {
    name: "Quiet Hearth",
    description: "A composed, unhurried presence.",
    palette: { primary: "#2C4A6E", accent: "#C9A227" },
    heading_font: "Fraunces",
    body_font: "Inter",
  },
};

function month(overrides: Partial<MonthlyPresence> = {}): MonthlyPresence {
  return {
    month_focus: "This month attends to what a first session involves.",
    posts: [
      {
        title: "What a first session looks like",
        hook: "The first session is mostly orientation.",
        caption: "We spend the first fifty minutes getting our bearings.",
        teaches: "What to expect the first time you sit down.",
      },
    ],
    stories: [
      {
        title: "The waiting room",
        prompt: "Show the room where people wait.",
        purpose: "Take one unknown off the table.",
      },
    ],
    calendar: [{ day: 3, publish: "What a first session looks like", note: "Morning." }],
    ...overrides,
  };
}

function toolResponse(
  input: unknown,
  stopReason: Anthropic.Message["stop_reason"] = "tool_use"
): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [
      {
        type: "tool_use",
        id: "tu_1",
        name: "compose_monthly_presence",
        input,
      },
    ],
  } as unknown as Anthropic.Message;
}

describe("prompt système", () => {
  it("place le socle déontologique EN PREMIER", () => {
    // Aucune consigne de style ne doit pouvoir se lire comme une permission de
    // l'assouplir : le socle ouvre le prompt, il ne le clôt pas.
    expect(PRESENCE_SYSTEM_PROMPT.startsWith(ETHICS_SYSTEM_RULES)).toBe(true);
  });

  it("ne demande jamais au modèle d'ÉCRIRE une liste d'interdits", () => {
    /*
     * Leçon n°3. Le prompt multi-plateformes du kit disait au constructeur de
     * site « no testimonials, no "proven", no "lasting relief" » — le modèle
     * appliquant le socle à la lettre — et la garde bloquait cette conformité.
     * Le correctif vit dans `checkEthics` (mention prohibitive), mais la
     * meilleure défense reste de ne pas réclamer ces listes dans le livrable.
     */
    const askedFor = PRESENCE_SYSTEM_PROMPT.slice(ETHICS_SYSTEM_RULES.length);
    expect(askedFor).not.toMatch(/no testimonials/i);
    expect(askedFor).not.toMatch(/no outcome claims/i);
  });
});

describe("prompt utilisateur", () => {
  it("porte la voix, la palette et le nombre de jours du mois", () => {
    const prompt = buildPresencePrompt(INPUT);

    expect(prompt).toContain("February 2026");
    expect(prompt).toContain("28 days");
    expect(prompt).toContain("Quiet Hearth");
    expect(prompt).toContain("#2C4A6E");
    expect(prompt).toContain("Fraunces");
    expect(prompt).toContain("A first session is ninety minutes.");
  });
});

describe("réponse du modèle", () => {
  it("nomme la coupure par longueur au lieu de la laisser passer pour une erreur de structure", () => {
    // Une réponse tronquée est un échec ACTIONNABLE — réessayer a une vraie
    // chance d'aboutir — là où une erreur de structure ne l'est pas.
    expect(() => parsePresenceResponse(toolResponse(month(), "max_tokens"))).toThrow(
      PresenceTruncatedError
    );
  });

  it("échoue proprement sur un refus du modèle", () => {
    expect(() => parsePresenceResponse(toolResponse(month(), "refusal"))).toThrow(
      /refused/i
    );
  });
});

describe("garde déontologique", () => {
  it("régénère avec un feedback CITANT l'extrait fautif, puis accepte", async () => {
    const callModel = vi
      .fn<
        (prompt: string, feedback: string | null) => Promise<MonthlyPresence>
      >()
      .mockResolvedValueOnce(
        month({
          posts: [
            {
              title: "Bad hook",
              hook: "We guarantee results in six weeks.",
              caption: "A caption.",
              teaches: "Something.",
            },
          ],
        })
      )
      .mockResolvedValueOnce(month());

    const result = await generatePresenceWithModel(INPUT, callModel);

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[0][1]).toBeNull();
    // Un « sois plus prudent » générique ne fait pas atterrir la reprise :
    // c'est l'extrait cité qui la fait atterrir.
    expect(callModel.mock.calls[1][1]).toContain('"guarantee"');
    expect(result.posts[0].title).toBe("What a first session looks like");
  });

  it("lève plutôt que de rendre un mois non conforme, tentatives épuisées", async () => {
    const callModel = vi.fn(async () =>
      month({
        month_focus: "Our clients say they feel better within a month.",
      })
    );

    await expect(generatePresenceWithModel(INPUT, callModel)).rejects.toThrow(
      EthicsComplianceError
    );
    // Trois appels : la première tentative et les deux reprises.
    expect(callModel).toHaveBeenCalledTimes(3);
  });
});

describe("calendrier", () => {
  it("recale les jours sur le mois réel sans jeter le reste du livrable", async () => {
    const callModel = vi.fn(async () =>
      month({
        calendar: [
          { day: 30, publish: "Post hors mois", note: "Morning." },
          { day: 12, publish: "Post valide", note: "Afternoon." },
          { day: 4, publish: "Autre post", note: "Morning." },
        ],
      })
    );

    // Février 2026 compte 28 jours : le 30 n'existe pas.
    const result = await generatePresenceWithModel(INPUT, callModel);

    expect(result.calendar.map((entry) => entry.day)).toEqual([4, 12]);
    expect(result.posts).toHaveLength(1);
  });
});
