import { parseKitTier, type KitTier } from "@/lib/kit/tiers";

/*
 * Les métadonnées qui voyagent avec une session Checkout.
 *
 * Module PUR, partagé par les deux bouts de la chaîne : le checkout les écrit,
 * le webhook les relit. C'est la seule raison d'être de ce fichier — une clé
 * écrite `eklio_project_id` d'un côté et lue `projectId` de l'autre donnerait
 * un paiement encaissé qu'on ne saurait rattacher à personne, et l'erreur ne
 * se verrait qu'en production, sur de l'argent réel.
 *
 * Le préfixe `eklio_` évite toute collision avec les métadonnées que Stripe ou
 * un futur outil tiers pourrait poser sur le même objet.
 */

export const METADATA_KEYS = {
  userId: "eklio_user_id",
  projectId: "eklio_project_id",
  tier: "eklio_tier",
} as const;

export type CheckoutMetadata = {
  userId: string;
  /** Null quand le checkout part de `/pricing`, avant tout choix de projet. */
  projectId: string | null;
  tier: KitTier;
};

/**
 * Métadonnées à poser sur la session (et sur l'abonnement, qui ne les hérite
 * pas).
 *
 * Stripe n'accepte que des chaînes : un `projectId` absent devient une chaîne
 * vide plutôt qu'un `null`, que l'API refuserait.
 */
export function buildCheckoutMetadata({
  userId,
  projectId,
  tier,
}: CheckoutMetadata): Record<string, string> {
  return {
    [METADATA_KEYS.userId]: userId,
    [METADATA_KEYS.projectId]: projectId ?? "",
    [METADATA_KEYS.tier]: tier,
  };
}

/**
 * Relit les métadonnées d'un objet Stripe. Rend `null` si l'essentiel manque.
 *
 * L'essentiel, c'est l'utilisateur et le tier : sans eux, il n'y a rien à
 * écrire dans `purchases`. Le projet, lui, peut légitimement être absent.
 *
 * Rendre `null` plutôt que de deviner est délibéré : le webhook doit pouvoir
 * DIRE qu'il a reçu un event inexploitable, pas inventer un rattachement.
 */
export function parseCheckoutMetadata(
  raw: Record<string, string> | null | undefined
): CheckoutMetadata | null {
  if (!raw) return null;

  const userId = raw[METADATA_KEYS.userId]?.trim();
  const tier = parseKitTier(raw[METADATA_KEYS.tier]);
  if (!userId || !tier) return null;

  const projectId = raw[METADATA_KEYS.projectId]?.trim();

  return { userId, projectId: projectId ? projectId : null, tier };
}
