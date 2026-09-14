import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  buildStructuredFields,
  checkProse,
  type DirectoryProse,
  type StructuredFields,
} from "@/lib/directory/profile";
import { readCatalog } from "@/lib/catalog/read";

/*
 * ── CE QUI ALIMENTE L'ÉCRAN DU PROFIL D'ANNUAIRE ────────────────────────
 *
 * Le profil a DEUX moitiés et elles n'ont pas la même origine :
 *
 *   les champs structurés   dérivables aujourd'hui, sans modèle — ce sont les
 *                           réponses du brief, résolues en libellés par le
 *                           catalogue
 *   la prose                produite par une génération, rangée dans
 *                           `directory_profiles` par `save_directory_profile`
 *
 * ⚠ ET RIEN N'APPELLE ENCORE `save_directory_profile`. Vérifié : zéro appel
 * dans les deux dépôts. La prose n'est donc, à ce jour, produite par personne
 * — l'écran le DIT, plutôt que d'afficher un vide qu'on prendrait pour une
 * panne. Le jour où la génération l'écrit, cette fonction la trouve et l'écran
 * la rend sans changer d'une ligne.
 *
 * ⚠ ON N'INVENTE PAS LA PROSE À PARTIR DE LA PAGE « À PROPOS ». Ce serait un
 * choix produit que personne n'a pris, et un profil d'annuaire assemblé à la
 * volée ressemblerait à un livrable rédigé sans en être un. Les champs
 * structurés, eux, ne sont pas une invention : ce sont ses propres réponses.
 */

type Client = SupabaseClient<Database>;

export type DirectoryProfileView = {
  /** Toujours présents dès qu'elle a répondu au brief. `{}` est valide. */
  structured: StructuredFields;
  /** La prose rangée en base, ou `null` si personne ne l'a encore produite. */
  prose: DirectoryProse | null;
  /**
   * ⚠ Pourquoi la prose est absente, quand elle l'est. Deux causes très
   * différentes, et un écran qui les confond fait chercher au mauvais endroit :
   * rien n'a été produit, ou ce qui a été rangé ne passe plus les bornes.
   */
  proseIssue: "not_produced" | "stored_prose_rejected" | null;
};

/** La forme que `get_directory_profile` rend. */
type StoredProfile = {
  first_paragraph?: unknown;
  body?: unknown;
  structured?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function loadDirectoryProfile(
  supabase: Client,
  brandKitId: string,
  projectId: string,
  platform: "psychology_today" | "google_business" = "psychology_today"
): Promise<DirectoryProfileView> {
  const [stored, brief, catalog] = await Promise.all([
    supabase.rpc("get_directory_profile", {
      p_brand_kit_id: brandKitId,
      p_platform: platform,
    }),
    supabase
      .from("project_briefs")
      .select("state, specialty_ids, modality_ids, client_persona_ids")
      .eq("project_id", projectId)
      .maybeSingle(),
    /*
     * Tolérant, comme partout ailleurs sur cette page : un catalogue illisible
     * rend des champs structurés vides, pas un écran en erreur. Les libellés
     * sont du confort de lecture ; la prose est le livrable.
     */
    readCatalog(supabase).catch(() => null),
  ]);

  if (stored.error) console.error("[directory] get_directory_profile", stored.error.message);
  if (brief.error) console.error("[directory] project_briefs", brief.error.message);

  /*
   * ⚠ RÉSOLUTION PAR LIBELLÉ, ET UN IDENTIFIANT INCONNU NE PRODUIT RIEN.
   * `labelList`, dans `lib/directory/profile.ts`, purge les trous : une
   * spécialité retirée du catalogue raccourcit la liste au lieu d'y laisser
   * une chaîne vide. C'est le troisième des quatre défauts permissifs du
   * dépôt — `array_to_string` écarte les NULL en silence — pris à l'endroit
   * où il se produirait.
   */
  const labelsOf = (
    rows: readonly { id: string; label: string }[] | undefined,
    ids: readonly string[] | null | undefined
  ) => (ids ?? []).map((id) => rows?.find((row) => row.id === id)?.label);

  const structured = buildStructuredFields({
    state: brief.data?.state ?? null,
    specialties: labelsOf(catalog?.specialties, brief.data?.specialty_ids),
    modalities: labelsOf(catalog?.modalityCards, brief.data?.modality_ids),
    personas: labelsOf(catalog?.personaCards, brief.data?.client_persona_ids),
    /*
     * Le brief ne demande PAS les assurances acceptées — il n'y a pas de
     * colonne. Une liste vide fait disparaître la clé plutôt que d'écrire
     * « Insurance: » suivi de rien, ce que `buildStructuredFields` garantit.
     */
    insurances: [],
  });

  const row = (stored.data ?? null) as StoredProfile | null;
  if (!row) return { structured, prose: null, proseIssue: "not_produced" };

  /*
   * ⚠ ON REVÉRIFIE CE QUI SORT DE LA BASE. Les bornes y sont (deux CHECK), donc
   * ceci ne devrait jamais échouer — et c'est précisément pour ça que le jour
   * où ça échoue, il faut le voir plutôt que rendre une prose tronquée ou
   * dédoublée sur un profil qu'elle va publier sous son nom.
   */
  const verdict = checkProse(asString(row.first_paragraph), asString(row.body));
  if (!verdict.ok) {
    console.error("[directory] prose rangée refusée", verdict.problems);
    return { structured, prose: null, proseIssue: "stored_prose_rejected" };
  }

  return { structured, prose: verdict.prose, proseIssue: null };
}
