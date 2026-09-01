import Anthropic from "@anthropic-ai/sdk";

/*
 * Shared Anthropic client, strictly server-side. `ANTHROPIC_API_KEY` is
 * never exposed to the client and never prefixed `NEXT_PUBLIC_`; the SDK
 * reads it automatically from the environment.
 *
 * No client component imports this module — that's the rule that keeps the
 * key out of the bundle, and it's verified by scanning the build output, not
 * by eye.
 *
 * `getAnthropicClient()` fails explicitly if `ANTHROPIC_API_KEY` is unset,
 * before any construction — not on the SDK's first call against an
 * already-built client. Behavior ported from `eklio-fr-us-migration-53dnk1`
 * (taken as-is; that branch itself is not merged).
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Generation is disabled until it is configured server-side."
    );
  }

  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/** The model used by every generation in the product. */
export const GENERATION_MODEL = "claude-opus-5";
