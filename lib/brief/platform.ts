import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LA QUALIFICATION DE PLATEFORME ──────────────────────────────────────
 *
 * L'offre promet des pages « publiées par Eklio sur son CMS ». On ne peut donc
 * vendre The Foundation qu'à quelqu'un dont le site tourne sur une plateforme
 * qu'on saura atteindre.
 *
 * ⚠ LA LISTE N'EST PAS ICI, ET C'EST LE POINT DE CE MODULE. Elle est en base
 * (`site_platforms`), parce que la question « Squarespace expose-t-il une API
 * de création de pages » n'est pas tranchée. Le jour où elle le sera, la
 * réponse doit coûter un UPDATE — pas un déploiement, pas une revue, pas une
 * fenêtre de livraison.
 *
 * Ce fichier ne contient donc AUCUN nom de plateforme. Il contient la forme de
 * la décision, et rien d'autre. Un test le vérifie littéralement.
 */

type Client = SupabaseClient<Database>;

/**
 * Les trois états, miroir de `site_platforms.status`.
 *
 * ⚠ TROIS, PAS DEUX. Deux auraient forcé à ranger Squarespace du côté d'une
 * réponse qu'on n'a pas. `conditional` dit la vérité : l'inscription est
 * prise, et ce qui n'est pas garanti est dit avant le paiement.
 */
export type PlatformStatus = "accepted" | "conditional" | "refused";

export type SitePlatform = {
  id: string;
  label: string;
  status: PlatformStatus;
  /** La phrase qu'elle lit. `null` seulement pour une plateforme acceptée. */
  notice: string | null;
};

/**
 * Le catalogue, lu en base.
 *
 * ── ÉCHEC FERMÉ, ET DANS LE SENS INHABITUEL ─────────────────────────────
 *
 * Une erreur de lecture rend une liste VIDE, ce qui rend `qualify()` refusant
 * pour tout le monde. C'est volontaire et c'est l'inverse de ce qu'on ferait
 * pour un plafond anti-abus : ici, laisser passer signifie encaisser 390 $ en
 * promettant une publication sur une plateforme dont on ne sait rien. Une
 * inscription refusée à tort se voit tout de suite et se répare ; une promesse
 * qu'on ne peut pas tenir se découvre à la livraison.
 */
export async function loadSitePlatforms(supabase: Client): Promise<SitePlatform[]> {
  const { data, error } = await supabase
    .from("site_platforms")
    .select("id, label, status, notice")
    .order("sort_order");

  if (error) {
    console.error("[platform] lecture site_platforms", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    status: row.status as PlatformStatus,
    notice: row.notice,
  }));
}

export type Qualification =
  | { ok: true; status: "accepted"; platform: SitePlatform }
  | { ok: true; status: "conditional"; platform: SitePlatform; notice: string }
  | { ok: false; reason: "refused"; platform: SitePlatform; notice: string }
  | { ok: false; reason: "unknown_platform" }
  | { ok: false; reason: "not_answered" };

/**
 * La décision, pure.
 *
 * ⚠ UNE PLATEFORME INCONNUE EST REFUSÉE, PAS IGNORÉE. Un identifiant qui n'est
 * plus au catalogue — retiré, renommé — ne doit pas se lire comme « pas de
 * contrainte ». C'est la forme exacte du défaut que ce dépôt documente depuis
 * le lot 6 : une valeur qui disparaît sans erreur.
 */
export function qualify(
  platformId: string | null | undefined,
  platforms: readonly SitePlatform[]
): Qualification {
  if (!platformId) return { ok: false, reason: "not_answered" };

  const platform = platforms.find((entry) => entry.id === platformId);
  if (!platform) return { ok: false, reason: "unknown_platform" };

  if (platform.status === "accepted") {
    return { ok: true, status: "accepted", platform };
  }

  /*
   * ⚠ `notice` NE PEUT PAS ÊTRE NULL ICI — la base l'impose
   * (`site_platforms_notice_where_needed` : tout ce qui n'est pas `accepted`
   * porte une phrase). Le repli existe quand même, parce qu'un écran qui
   * refuse sans expliquer est pire qu'un écran qui explique maladroitement, et
   * parce qu'une contrainte en base ne protège pas un type TypeScript.
   */
  const notice =
    platform.notice ??
    "We cannot publish to that platform yet. Everything we write for you would still be yours to paste.";

  return platform.status === "conditional"
    ? { ok: true, status: "conditional", platform, notice }
    : { ok: false, reason: "refused", platform, notice };
}

/**
 * Enregistre le refus, pour qu'il se compte.
 *
 * ⚠ CE N'EST PAS DE L'ANALYTIQUE D'ENTONNOIR. `funnel_events` est purgée à 180
 * jours et illisible hors `service_role` ; la question à laquelle ces lignes
 * répondent — combien de clientes refusons-nous, et pour quelle plateforme —
 * est celle qui décidera s'il faut écrire un client Squarespace, et elle se
 * pose sur des trimestres.
 *
 * La RPC refuse elle-même ce qui n'est pas un vrai refus (une plateforme
 * acceptée, conditionnelle ou inconnue) et refuse d'agrafer la ligne au projet
 * de quelqu'un d'autre. On ne redécide donc rien ici : on appelle.
 *
 * N'échoue jamais bruyamment : un compteur manqué ne doit pas empêcher de dire
 * non à quelqu'un.
 */
export async function recordPlatformRefusal(
  supabase: Client,
  platformId: string,
  projectId: string | null
): Promise<void> {
  const { error } = await supabase.rpc("record_platform_refusal", {
    p_platform_id: platformId,
    /*
     * ⚠ `?? undefined`, PAS `null`. L'argument a une valeur par défaut en base
     * (`p_project_id uuid default null`), donc les types générés le rendent
     * optionnel — `string | undefined`, jamais `null`. Envoyer `null` est un
     * écart de type que `rpc-signatures.test.ts` attrape, et le sens est le
     * même : ne pas nommer de projet.
     */
    p_project_id: projectId ?? undefined,
  });

  if (error) {
    console.error("[platform] record_platform_refusal", error);
  }
}
