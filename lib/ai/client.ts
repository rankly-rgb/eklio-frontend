import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Le client Claude. Strictement serveur : ANTHROPIC_API_KEY n'est jamais
 * exposée au bundle client et n'est jamais préfixée NEXT_PUBLIC_.
 */
export function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante côté serveur.");
  return new Anthropic({ apiKey });
}

export const GENERATION_MODEL = "claude-opus-5";
