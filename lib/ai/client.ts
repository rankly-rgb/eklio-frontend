import Anthropic from "@anthropic-ai/sdk";

/*
 * Client Anthropic partagé, strictement serveur. `ANTHROPIC_API_KEY` n'est
 * jamais exposée au client ni préfixée `NEXT_PUBLIC_` ; le SDK la lit
 * automatiquement depuis l'environnement.
 *
 * Aucun composant client n'importe ce module — c'est la règle qui garde la clé
 * hors du bundle, et elle est vérifiée en balayant la sortie du build, pas à
 * l'œil.
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/** Le modèle utilisé par toutes les générations du produit. */
export const GENERATION_MODEL = "claude-opus-5";
