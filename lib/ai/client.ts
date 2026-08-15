import Anthropic from "@anthropic-ai/sdk";

/*
 * Client Anthropic partagé, strictement serveur. ANTHROPIC_API_KEY n'est
 * jamais exposée au client ni préfixée NEXT_PUBLIC_ ; le SDK la lit
 * automatiquement depuis l'environnement.
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
