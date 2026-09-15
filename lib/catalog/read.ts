import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
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
 *   - les policies `*_select_all` ne s'ouvrent pas à n'importe qui : soit la
 *     lecture porte une session, soit elle porte le jeton d'un brief anonyme
 *     vivant (§ `20260915053102` côté eklio-backend) — dans les deux cas un
 *     cache de données Next indexerait l'appelant ;
 *   - le contenu est IDENTIQUE pour tout le monde — les deux policies rendent
 *     les mêmes lignes, pas un sous-ensemble par appelant — donc un cache par
 *     processus est exactement le bon grain, et il survit entre requêtes sur
 *     une même instance.
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

/*
 * ── LES TABLES SANS LESQUELLES LE BRIEF NE POSE PAS SA QUESTION ─────────
 *
 * Aucune de ces tables n'est légitimement vide : les migrations du catalogue
 * épinglent leurs effectifs par un garde-fou qui fait échouer la migration.
 * Une liste vide côté front ne veut donc jamais dire « rien à afficher », elle
 * veut dire « la lecture n'a rien ramené » — et PostgREST répond 200 avec `[]`
 * à un SELECT que RLS refuse, sans la moindre erreur.
 *
 * ⚠ C'EST EXACTEMENT COMME ÇA QUE « License type » EST RESTÉ VIDE. Les quinze
 * policies du catalogue portaient `to authenticated` ; le brief anonyme, lui,
 * appelle en `anon`. Zéro ligne, zéro erreur, un intitulé sans rien dessous.
 * La base est réparée (`20260915053102` côté eklio-backend) ; ce garde-fou-ci
 * est ce qui fait qu'une prochaine régression du même genre se VOIT.
 */
const REQUIRED: readonly (keyof Catalog)[] = [
  "licenseTypes",
  "specialties",
  "problemCards",
  "gainCards",
  "personaCards",
  "toneCards",
  "paletteFamilies",
  "typePairings",
  "primaryActions",
  "siteGoals",
  "ethicsRules",
  "sessionStyleCards",
  "notAFitCards",
  "modalityCards",
  "modalityProminenceOptions",
  /*
   * La matrice titre/État. Vide = l'écran 1 ne peut plus filtrer ses puces, et
   * proposerait de nouveau les dix titres dans les cinquante États — c'est
   * exactement le défaut qu'elle répare, donc elle est REQUISE.
   */
  "licenseTypeStates",
  "degrees",
];

/** Les tables vides, s'il y en a. Un catalogue sain rend une liste vide. */
function missingTables(catalog: Catalog): string[] {
  return REQUIRED.filter((key) => catalog[key].length === 0);
}

export async function readCatalog(supabase: Client): Promise<Catalog> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = fetchCatalog(supabase)
    .then((value) => {
      /*
       * ⚠ UN CATALOGUE AMPUTÉ N'ENTRE PAS DANS LE CACHE, et il ne rentre pas
       * non plus dans un rendu.
       *
       * Le cache est un cache de MODULE, partagé par tous les appelants de
       * l'instance : une seule lecture creuse — une visiteuse anonyme sous une
       * policy trop étroite, une coupure réseau à moitié réussie — servirait
       * des étapes vides à TOUT LE MONDE pendant dix minutes, y compris aux
       * utilisatrices connectées dont la lecture, elle, aurait marché.
       *
       * Le commentaire de `fetchCatalog` disait déjà « mieux vaut échouer
       * franchement » pour une erreur PostgREST. Zéro ligne est le MÊME
       * défaut, dans le seul costume qui ne lève rien — alors il lève ici.
       */
      const missing = missingTables(value);
      if (missing.length > 0) {
        throw new Error(
          `[catalog] ${missing.length} table(s) vides : ${missing.join(", ")}. ` +
            "Le catalogue n'est jamais légitimement vide (les migrations en " +
            "épinglent les effectifs) : c'est une lecture refusée par RLS, pas " +
            "un catalogue sans contenu."
        );
      }
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
    licenseTypeStates,
    degrees,
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
     * ⚠ PAS DE `.eq("active", true)` ICI, et ce n'est pas un oubli :
     * `license_type_states` ne porte pas de colonne `active`. Une juridiction
     * ne « retire » pas un titre en douceur — elle le délivre ou non, et la
     * ligne est présente ou absente.
     */
    all(supabase.from("license_type_states").select("*").order("state_code")),
    all(supabase.from("degrees").select("*").eq("active", true).order("sort_order")),
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
    licenseTypeStates,
    degrees,
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
    licenseTypeStates: licenseTypeStates.data ?? [],
    degrees: degrees.data ?? [],
  };
}
