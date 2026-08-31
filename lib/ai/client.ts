import Anthropic from "@anthropic-ai/sdk";

/*
 * Client Anthropic partagé, strictement serveur. `ANTHROPIC_API_KEY` n'est
 * jamais exposée au client ni préfixée `NEXT_PUBLIC_` ; le SDK la lit
 * automatiquement depuis l'environnement.
 *
 * Aucun composant client n'importe ce module — c'est la règle qui garde la clé
 * hors du bundle, et elle est vérifiée en balayant la sortie du build, pas à
 * l'œil.
 *
 * `getAnthropicClient()` échoue explicitement si `ANTHROPIC_API_KEY` est
 * absente, avant toute construction — pas au premier appel du SDK sur le
 * client déjà construit. Comportement porté depuis
 * `eklio-fr-us-migration-53dnk1` (repris tel quel, la branche elle-même
 * n'est pas fusionnée).
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

/** Le modèle utilisé par toutes les générations du produit. */
export const GENERATION_MODEL = "claude-opus-5";
