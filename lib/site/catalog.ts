import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { siteCatalog } from "@/lib/site/rpc";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * Le catalogue de l'éditeur de site — types de section, constructeurs, bornes.
 *
 * Même raisonnement que `lib/catalog/read.ts` : contenu identique pour tout le
 * monde, change rarement, lisible seulement par une session authentifiée. Un
 * cache MÉMOIRE par processus est donc exactement le bon grain. On réutilise
 * le même TTL de dix minutes pour n'avoir qu'une seule constante de fraîcheur
 * à expliquer.
 *
 * ⚠ Les bornes viennent d'ICI et de nulle part ailleurs. Les coder en dur dans
 * l'éditeur donnerait deux vérités le jour où `site_spec_limits` bouge, et
 * l'utilisatrice découvrirait la vraie en se faisant refuser une écriture.
 */

const TTL_MS = 10 * 60 * 1000;

type Client = SupabaseClient<Database>;
type CacheEntry = { value: SiteCatalog; expiresAt: number };

let cache: CacheEntry | null = null;
let inFlight: Promise<SiteCatalog> | null = null;

/** Vide le cache — tests, et un éventuel webhook d'édition du catalogue. */
export function invalidateSiteCatalog(): void {
  cache = null;
  inFlight = null;
}

export async function readSiteCatalog(supabase: Client): Promise<SiteCatalog> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = siteCatalog(supabase)
    .then((result) => {
      if (!result.ok) {
        // Un catalogue partiel donnerait un sélecteur de sections vide et des
        // compteurs de caractères sans plafond, sans le dire. Mieux vaut
        // échouer franchement : l'appelant rend une erreur d'une phrase.
        throw new Error(`[site-catalog] ${result.error.code}: ${result.error.message}`);
      }
      cache = { value: result.data, expiresAt: Date.now() + TTL_MS };
      return result.data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
