import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { SitePlatform } from "@/lib/brief/platform";
import type { Catalog, PaletteFamily } from "@/lib/catalog/types";

/*
 * Lecture du catalogue — ton, palettes, paires typographiques, personas,
 * problèmes, gains, licences, spécialités, actions, objectifs, déontologie.
 *
 * Il vit EN BASE (§6) : la copy du brief doit pouvoir changer sans déploiement.
 * En contrepartie il change rarement, donc on le met en cache agressivement.
 *
 * Le cache est un cache MÉMOIRE de module, avec un TTL. Deux raisons de ne pas
 * passer par `unstable_cache` / `use cache` :
 *   - les tables de catalogue ne sont lisibles que par le rôle `authenticated`
 *     (policies `*_select_all` sur `{authenticated}`), donc la lecture porte
 *     forcément une session — un cache de données Next indexerait la session ;
 *   - le contenu est IDENTIQUE pour tout le monde, donc un cache par processus
 *     est exactement le bon grain, et il survit entre requêtes sur une même
 *     instance.
 *
 * Le TTL de dix minutes est le délai entre « quelqu'un corrige une carte de
 * ton en base » et « le brief l'affiche ». Sans déploiement, comme demandé.
 */

const TTL_MS = 10 * 60 * 1000;

type CacheEntry = { value: Catalog; expiresAt: number };
let cache: CacheEntry | null = null;
/* Une lecture concurrente ne doit pas en déclencher six. */
let inFlight: Promise<Catalog> | null = null;

type Client = SupabaseClient<Database>;

/** Vide le cache — utilisé par les tests et par un éventuel webhook d'édition. */
export function invalidateCatalog(): void {
  cache = null;
  inFlight = null;
}

export async function readCatalog(supabase: Client): Promise<Catalog> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = fetchCatalog(supabase)
    .then((value) => {
      cache = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

async function fetchCatalog(supabase: Client): Promise<Catalog> {
  /*
   * Onze lectures écrites une à une plutôt que par un helper générique : le
   * typage de PostgREST est indexé par nom de table, et une fonction générique
   * perdrait exactement ce qui rend ces lectures sûres.
   *
   * `active = true` partout, `sort_order` partout : c'est la base qui décide de
   * ce qui s'affiche et dans quel ordre, pas le front.
   */
  const all = <T>(query: PromiseLike<T>) => query;
  const [
    licenseTypes,
    specialties,
    problemCards,
    gainCards,
    personaCards,
    toneCards,
    paletteFamilies,
    typePairings,
    primaryActions,
    siteGoals,
    ethicsRules,
    sessionStyleCards,
    notAFitCards,
    modalityCards,
    modalityProminenceOptions,
    sitePlatforms,
  ] = await Promise.all([
    all(supabase.from("license_types").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("specialties").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("problem_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("gain_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("client_persona_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("tone_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("palette_families").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("type_pairings").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("primary_actions").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("site_goals").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("ethics_rules").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("session_style_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("not_a_fit_cards").select("*").eq("active", true).order("sort_order")),
    all(supabase.from("modality_cards").select("*").eq("active", true).order("sort_order")),
    all(
      supabase.from("modality_prominence_options").select("*").eq("active", true).order("sort_order")
    ),
    /*
     * ⚠ PAS DE `.eq("active", true)` ICI, et ce n'est pas un oubli.
     * `site_platforms` n'a pas de colonne `active` : elle porte `status`, et
     * les trois valeurs doivent atteindre l'écran. Une plateforme `refused`
     * reste proposée — c'est elle qui porte la phrase qui explique ce qu'on
     * pourra faire et ce qu'on ne pourra pas.
     */
    all(supabase.from("site_platforms").select("*").order("sort_order")),
  ]);

  const responses = {
    licenseTypes,
    specialties,
    problemCards,
    gainCards,
    personaCards,
    toneCards,
    paletteFamilies,
    typePairings,
    primaryActions,
    siteGoals,
    ethicsRules,
    sessionStyleCards,
    notAFitCards,
    modalityCards,
    modalityProminenceOptions,
    sitePlatforms,
  };

  for (const [name, response] of Object.entries(responses)) {
    if (response.error) {
      // Un catalogue partiel ferait un brief aux étapes vides, sans le dire.
      // Mieux vaut échouer franchement : l'appelant rend une erreur d'une
      // phrase qui dit quoi faire.
      throw new Error(
        `[catalog] lecture de ${name} : ${response.error.message}`
      );
    }
  }

  return {
    licenseTypes: licenseTypes.data ?? [],
    specialties: specialties.data ?? [],
    problemCards: problemCards.data ?? [],
    gainCards: gainCards.data ?? [],
    personaCards: personaCards.data ?? [],
    toneCards: toneCards.data ?? [],
    /*
     * `preview_tokens` est un `Json` côté types générés. La base garantit par
     * CHECK qu'il porte exactement les cinq rôles, égaux aux colonnes `*_hex` :
     * la conversion est donc sûre, et elle évite une revalidation par rendu.
     */
    paletteFamilies: (paletteFamilies.data ?? []) as unknown as PaletteFamily[],
    typePairings: typePairings.data ?? [],
    primaryActions: primaryActions.data ?? [],
    siteGoals: siteGoals.data ?? [],
    ethicsRules: ethicsRules.data ?? [],
    sessionStyleCards: sessionStyleCards.data ?? [],
    notAFitCards: notAFitCards.data ?? [],
    modalityCards: modalityCards.data ?? [],
    modalityProminenceOptions: modalityProminenceOptions.data ?? [],
    /*
     * Le `status` est un `text` côté types générés ; la base le borne par
     * CHECK aux trois valeurs de `PlatformStatus`. Même conversion que
     * `paletteFamilies` au-dessus, et pour la même raison.
     */
    sitePlatforms: (sitePlatforms.data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      status: row.status as SitePlatform["status"],
      notice: row.notice,
    })),
  };
}
