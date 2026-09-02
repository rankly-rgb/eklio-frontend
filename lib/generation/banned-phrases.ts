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
