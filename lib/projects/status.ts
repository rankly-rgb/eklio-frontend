import type { ProjectStatus } from "@/types/supabase";

/*
 * Libellés d'affichage des statuts de projet.
 *
 * `projects.status` est une colonne `text` contrainte par un CHECK en base
 * (`brief`, `brief_complete`, `directions`, `kit`) : ce sont des identifiants
 * techniques, pas du texte affichable, et ils appartiennent au schéma porté par
 * le repo `eklio-backend`. On ne touche donc JAMAIS à la valeur stockée — on
 * mappe seulement valeur DB → libellé anglais au moment du rendu.
 *
 * Le mapping vit ici, hors du tableau de bord, parce que le brief fait avancer
 * ce statut (`brief` → `brief_complete`) et que les écrans suivants l'afficheront.
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  brief: "brief in progress",
  brief_complete: "brief complete",
  directions: "creative directions",
  kit: "brand kit",
};

/*
 * Le type généré rend `status` en `string` (le CHECK n'est pas un enum
 * Postgres) : on retombe sur la valeur brute plutôt que sur `undefined` si la
 * base venait à porter un statut que le front ne connaît pas encore.
 */
export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;
}
