import type { Catalog } from "@/lib/catalog/types";

/*
 * `scope_key` — MÊME calcul que la base, verbatim (contrat §9.6) :
 * `lower(primary_specialty_id) || ':' || lower(coalesce(state, 'us'))`, où
 * `primary_specialty_id` est celle des spécialités du brief qui a le PLUS
 * BAS `sort_order` dans le catalogue `specialties` — jamais
 * `specialty_ids[0]`, qui n'a aucun ordre garanti (tableau brut, écrit tel
 * quel par l'autosave). `usp_fingerprint_confirm` calcule la même chose côté
 * base ; les deux ne doivent jamais pouvoir diverger.
 */
export function computeScopeKey(
  specialtyIds: string[],
  state: string | null,
  specialties: Catalog["specialties"]
): string | null {
  const primary = specialtyIds
    .map((id) => specialties.find((entry) => entry.id === id))
    .filter((entry): entry is Catalog["specialties"][number] => Boolean(entry))
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  if (!primary) return null;
  return `${primary.id.toLowerCase()}:${(state ?? "us").toLowerCase()}`;
}
