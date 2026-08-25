import { describe, expect, it, vi } from "vitest";

/*
 * Le kit part-il bien en STREAMING ?
 *
 * C'est le test qui aurait attrapé la panne : la génération du kit appelait
 * `messages.create()` avec un budget de 32 000 jetons, et le SDK Anthropic
 * refuse tout appel non streamé au-delà d'environ 21 300 — un garde CLIENT,
 * levé avant la moindre requête réseau. Zéro seconde, aucun statut HTTP, rien
 * dans l'onglet Réseau : la panne était invisible, et l'utilisateur ne voyait
 * qu'un « Something went wrong ».
 *
 * On vérifie donc le TRANSPORT, pas seulement le contenu.
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
              { type: "tool_use", id: "tu_1", name: "compose_brand_kit", input: KIT },
            ],
          }),
        };
      },
    },
  }),
}));

const { generateBrandKit, KIT_MAX_TOKENS } = await import("@/lib/ai/kit");
const { resolveKitScope } = await import("@/lib/kit/tiers");

const KIT = {
  positioning_statement: "A couples practice for partners who keep circling.",
  brand_story: "Why this practice exists, in two short paragraphs.",
  voice_and_tone: {
    adjectives: ["warm", "direct", "unhurried"],
    do_examples: ["A first session is ninety minutes."],
    dont_examples: ["Naming a timeframe for how someone will feel."],
  },
  website_copy: [
    { page: "home", sections: [{ heading: "Welcome", body: "Body copy." }] },
  ],
  social_templates: [],
  website_prompt: "Build a one-page site using #2C4A6E and Fraunces.",
};

describe("transport de la génération du kit", () => {
  it("passe par messages.stream(), jamais par messages.create()", async () => {
    await generateBrandKit({
      projectName: "Hearth Counseling",
      draft: { practice_name: "Hearth Counseling" },
      direction: {
        name: "Quiet Hearth",
        description: "A composed, unhurried presence.",
        palette: { primary: "#2C4A6E" },
        heading_font: "Fraunces",
        body_font: "Inter",
      },
      scope: resolveKitScope("signature", ["home"]),
    });

    expect(streamSpy).toHaveBeenCalledTimes(1);
    // `create()` lèverait côté client à ce budget : il ne doit jamais servir.
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("envoie le budget de jetons prévu, et un outil forcé", () => {
    const body = streamSpy.mock.calls[0][0] as Record<string, unknown>;

    expect(body.max_tokens).toBe(KIT_MAX_TOKENS);
    expect(body.model).toBe("claude-opus-5");
    expect(body.tool_choice).toEqual({ type: "tool", name: "compose_brand_kit" });
  });
});
