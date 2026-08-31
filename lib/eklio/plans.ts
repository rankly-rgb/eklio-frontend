import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Plan = {
  tier: string;
  label: string;
  price_cents: number;
  directions_limit: number;
  regenerations_limit: number;
  sort_order: number;
};

/**
 * L'allocation vit dans `plans`, et nulle part ailleurs — pas dans un défaut
 * de colonne, pas dans une branche de fonction, pas dans une constante de
 * route. Changer ce qu'un palier donne est un UPDATE sur cette table.
 *
 * ⚠ Ne jamais recopier ces nombres (3 / 79 / 149 / 249…) dans le code : un
 * nombre copié dans une route est un nombre qui sera faux le premier jour où
 * l'un d'eux bouge.
 */
export async function listPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("tier,label,price_cents,directions_limit,regenerations_limit,sort_order")
    .order("sort_order");

  if (error || !data) return [];
  return data as Plan[];
}

/** Total de runs = 1 + regenerations_limit. `directions_limit` est le nombre
 *  de directions produites PAR run, pas un nombre de runs. */
export function totalRuns(plan: Plan): number {
  return 1 + plan.regenerations_limit;
}

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
