import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place the Anthropic client is constructed.
 *
 * Server-only: ANTHROPIC_API_KEY is never exposed to the browser and is never
 * prefixed NEXT_PUBLIC_. Every generation path in this app goes through a
 * server action or route handler that imports from here.
 */

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Generation is disabled until it is configured server-side."
    );
  }

  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Shared across every generation so model choice lives in one place. */
export const GENERATION_MODEL = "claude-opus-5";
