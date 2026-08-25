import { describe, expect, it, vi } from "vitest";

/*
 * Le mois part-il bien en STREAMING ?
 *
 * C'est le test qui aurait attrapé la panne du kit, repris ici AVANT qu'elle
 * ne se reproduise. Le SDK Anthropic refuse tout appel non streamé au-delà
 * d'environ 21 300 jetons de sortie : un garde CLIENT, levé avant la moindre
 * requête réseau. Zéro seconde, aucun statut HTTP, rien dans l'onglet Réseau —
 * l'utilisateur ne voit qu'un « Something went wrong » et le serveur ne dit
 * rien d'exploitable.
 *
 * Monthly Presence demande 24 000 jetons : il est du MAUVAIS côté du seuil, et
 * `create()` échouerait exactement comme le kit. On vérifie donc le TRANSPORT,
 * pas seulement le contenu.
 */

const streamSpy = vi.fn();
const createSpy = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: () => ({
    messages: {
      create: createSpy,
      stream: (...args: unknown[]) => {
        streamSpy(...args);
        return {
          finalMessage: async () => ({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-opus-5",
            stop_reason: "tool_use",
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
            content: [
              {
                type: "tool_use",
                id: "tu_1",
                name: "compose_monthly_presence",
                input: MONTH,
              },
            ],
          }),
        };
      },
    },
  }),
}));

const { generateMonthlyPresence, PRESENCE_MAX_TOKENS, PRESENCE_TOOL } =
  await import("@/lib/ai/monthly-presence");
const { NON_STREAMING_MAX_TOKENS } = await import("@/lib/ai/kit");

const MONTH = {
  month_focus: "This month attends to what a first session actually involves.",
  posts: [
    {
      title: "What a first session looks like",
      hook: "The first session is mostly logistics and orientation.",
      caption: "We spend the first fifty minutes getting oriented.",
      teaches: "What to expect the first time you sit down.",
    },
  ],
  stories: [
    {
      title: "The waiting room",
      prompt: "Show the room where people wait, and say what happens next.",
      purpose: "Take one unknown off the table before someone reaches out.",
    },
  ],
  calendar: [
    { day: 3, publish: "What a first session looks like", note: "Morning." },
  ],
};

const INPUT = {
  projectName: "Hearth Counseling",
  draft: { practice_name: "Hearth Counseling" },
  month: "2026-03-01",
  monthLabel: "March 2026",
  daysInMonth: 31,
  kit: {
    positioning_statement: "A couples practice for partners who keep circling.",
    brand_story: "Why this practice exists.",
    voice_and_tone: {
      adjectives: ["warm", "direct", "unhurried"],
      do_examples: ["A first session is ninety minutes."],
      dont_examples: ["Naming a timeframe for how someone will feel."],
    },
    website_copy: [
      { page: "home" as const, sections: [{ heading: "Welcome", body: "Body." }] },
    ],
    social_templates: [],
  },
  direction: {
    name: "Quiet Hearth",
    description: "A composed, unhurried presence.",
    palette: { primary: "#2C4A6E" },
    heading_font: "Fraunces",
    body_font: "Inter",
  },
};

describe("transport de la génération Monthly Presence", () => {
  it("passe par messages.stream(), jamais par messages.create()", async () => {
    await generateMonthlyPresence(INPUT);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    // `create()` lèverait côté client à ce budget : il ne doit jamais servir.
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("envoie le budget prévu, et un outil forcé", () => {
    const body = streamSpy.mock.calls[0][0] as Record<string, unknown>;

    expect(body.max_tokens).toBe(PRESENCE_MAX_TOKENS);
    expect(body.model).toBe("claude-opus-5");
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "compose_monthly_presence",
    });
    expect(PRESENCE_TOOL.name).toBe("compose_monthly_presence");
  });

  it("réclame plus que le seuil non streamé — donc le streaming est requis", () => {
    /*
     * Ce n'est pas une préférence : sous ce seuil le streaming serait
     * optionnel, au-dessus il est la seule façon dont l'appel puisse partir.
     * Que `NON_STREAMING_MAX_TOKENS` soit bien le seuil du SDK RÉEL est déjà
     * asserté contre le client Anthropic dans `kit.test.ts` — on ne redouble
     * pas cette vérification, on s'y adosse.
     */
    expect(PRESENCE_MAX_TOKENS).toBeGreaterThan(NON_STREAMING_MAX_TOKENS);
  });

});
