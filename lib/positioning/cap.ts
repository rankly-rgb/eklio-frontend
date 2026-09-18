import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Le plafond d'affichage du rapport gratuit, lu en base.
 *
 * ⚠ IL EST EN DONNÉE PARCE QUE C'EST UNE DÉCISION DE PRODUIT. Combien de
 * constats une lectrice supporte avant qu'un diagnostic cesse de convaincre
 * n'est pas une question que le code sait trancher. Elle se change par un
 * UPDATE, sans déploiement :
 *
 *   update public.app_settings set value = to_jsonb(5)
 *    where key = 'first_line_findings_shown';
 *
 * ⚠ ET LA VALEUR ACTUELLE EST PROVISOIRE. Elle vaut 3 parce que c'est le
 * chiffre cité en exemple par l'autrice des règles, et pour aucune autre
 * raison : la consigne portait « Plafond d'affichage : [MON CHOIX] » et le
 * repère est resté vide.
 *
 * ⚠ UN RÉGLAGE ILLISIBLE NE VAUT PAS « MONTRE TOUT ». Le repli par défaut est
 * le plus PRUDENT — trois — et non l'absence de plafond : une base
 * momentanément muette ne doit pas produire le rapport de dix reproches que ce
 * réglage existe pour empêcher.
 */
export const FIRST_LINE_FINDINGS_SHOWN_FALLBACK = 3;

export async function firstLineFindingsShown(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "first_line_findings_shown")
    .maybeSingle();

  if (error || data == null) {
    if (error) console.error("[first-line] app_settings", error.message);
    return FIRST_LINE_FINDINGS_SHOWN_FALLBACK;
  }
  const n = Number(data.value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : FIRST_LINE_FINDINGS_SHOWN_FALLBACK;
}
