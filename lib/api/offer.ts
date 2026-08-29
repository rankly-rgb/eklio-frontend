/*
 * Une réponse qui dit COMMENT CONTINUER, pas ce qui a échoué.
 *
 * Le serveur répond 402 quand la base a refusé faute de paiement, et il joint
 * l'adresse du checkout. Le client n'a donc ni à composer l'URL ni à décider
 * du ton : il navigue.
 *
 * Le registre compte. Elle n'a rien fait de mal — elle n'a simplement pas
 * encore payé, ou elle a épuisé ce qui était offert. « Access denied » sur un
 * écran qu'elle était en train d'utiliser serait la plus mauvaise façon de
 * l'apprendre.
 */

export type Offer = { checkoutUrl: string; message: string | null };

/**
 * Lit une réponse 402. Renvoie `null` si ce n'en est pas une.
 *
 * Le repli sur `/pricing` existe pour le cas où le corps n'est pas lisible :
 * mieux vaut une page de tarifs qu'un cul-de-sac.
 */
export async function readOffer(response: Response): Promise<Offer | null> {
  if (response.status !== 402) return null;

  const body = (await response.json().catch(() => null)) as
    | { checkoutUrl?: string; error?: string }
    | null;

  return {
    checkoutUrl: body?.checkoutUrl ?? "/pricing",
    message: body?.error ?? null,
  };
}
