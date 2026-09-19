import { createAdminClient } from "@/lib/supabase/server";

/*
 * `usp_banned_phrases_check` — le SEUL chemin vers `banned_phrases` (§9.6,
 * §9.11 du contrat). `banned_phrases` n'est LUE nulle part côté client, ni
 * jointe à `readCatalog()` : la fonction est `service_role` uniquement, donc
 * ce module utilise `createAdminClient()`, jamais le client de session.
 *
 * UN SEUL module pour les deux générateurs (cartes de ton, options USP) : la
 * consigne du contrat est explicite — pas deux copies de cet appel.
 */
export async function checkBannedPhrases(text: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("usp_banned_phrases_check", {
    p_text: text,
  });

  if (error) {
    throw new Error(`[banned-phrases] usp_banned_phrases_check: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Les trente clichés, pour CONSTRUIRE un prompt — pas pour vérifier un texte.
 *
 * ⚠ POURQUOI UNE SECONDE FONCTION PLUTÔT QU'UNE LISTE ÉCRITE ICI. Les phrases
 * vivent dans `banned_phrases` et s'y ajoutent sans déploiement. Une liste
 * recopiée dans ce fichier serait une seconde définition de « cliché », et
 * c'est la trente-et-unième qui révélerait la divergence — dans le pire sens,
 * puisque le modèle l'ignorerait et que la base la refuserait.
 *
 * ⚠ ET LE MÊME VERROU QUE LA VÉRIFICATION : `service_role` seule, depuis le
 * serveur. Joignable par `authenticated`, ce serait l'oracle à phrases que
 * FRONTEND_CONTRACT §9.11 refuse.
 *
 * ⚠ ELLE LÈVE, comme `checkBannedPhrases`. Une table, une autorisation, un
 * mode de panne : deux comportements pour la même indisponibilité seraient
 * deux vérités sur le même événement.
 */
export async function listBannedPhrases(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("usp_banned_phrases_list");

  if (error) {
    throw new Error(`[banned-phrases] usp_banned_phrases_list: ${error.message}`);
  }
  return data ?? [];
}
