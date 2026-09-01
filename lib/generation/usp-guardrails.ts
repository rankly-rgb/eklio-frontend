import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * `usp_stopwords` et `app_settings.usp_similarity_threshold` — lues ICI,
 * directement, avec la clé service-role, plutôt que dupliquées côté
 * frontend. C'est la même correction que celle déjà faite pour
 * `banned_phrases` : deux définitions de « mot vide » ou deux seuils qui
 * dérivent l'un de l'autre sont exactement le problème que ce lot évite
 * ailleurs, pas quelque chose à réintroduire ici.
 *
 * `service_role` lit ces deux tables SANS RPC dédiée : RLS est activée avec
 * zéro policy et `anon`/`authenticated` sont révoqués, mais `service_role`
 * ignore RLS par construction (migration `20260831101000_usp_guardrail_tables.sql`).
 * Une lecture directe est donc légitime ici, contrairement à `banned_phrases`,
 * qui n'a jamais de lecture directe prévue — seulement la RPC de vérification.
 */

const DEFAULT_SIMILARITY_THRESHOLD = 0.55;

export async function fetchUspStopwords(
  admin: SupabaseClient<Database>
): Promise<Set<string>> {
  const { data, error } = await admin.from("usp_stopwords").select("word");
  if (error) {
    throw new Error(`[usp-guardrails] usp_stopwords: ${error.message}`);
  }
  return new Set(data.map((row) => row.word));
}

export async function fetchUspSimilarityThreshold(
  admin: SupabaseClient<Database>
): Promise<number> {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "usp_similarity_threshold")
    .single();

  if (error) {
    throw new Error(`[usp-guardrails] app_settings: ${error.message}`);
  }
  // La valeur est un scalaire jsonb (`0.55`), pas un objet : décodée en
  // nombre JS directement, sans déballage.
  const value = typeof data.value === "number" ? data.value : Number(data.value);
  return Number.isFinite(value) ? value : DEFAULT_SIMILARITY_THRESHOLD;
}

export type UspGuardrails = { stopwords: Set<string>; similarityThreshold: number };

/**
 * Les deux à la fois, UNE fois par requête (§ rapport final, correction
 * demandée) — jamais mis en cache entre requêtes : contrairement au
 * catalogue (§6, TTL de dix minutes délibéré), rien ne justifie ici de
 * servir une valeur pouvant dater de plusieurs minutes pour un réglage qui
 * gouverne un rejet de sécurité.
 */
export async function fetchUspGuardrails(
  admin: SupabaseClient<Database>
): Promise<UspGuardrails> {
  const [stopwords, similarityThreshold] = await Promise.all([
    fetchUspStopwords(admin),
    fetchUspSimilarityThreshold(admin),
  ]);
  return { stopwords, similarityThreshold };
}
