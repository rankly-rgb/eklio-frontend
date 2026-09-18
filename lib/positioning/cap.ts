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
 * ⚠ LA VALEUR EST 3, ET C'EST UNE DÉCISION — plus la valeur provisoire du
 * 17 septembre. La raison, écrite ici parce que `app_settings` est une table
 * clé/valeur sans colonne où la mettre :
 *
 *   UN RAPPORT GRATUIT À TROIS CONSTATS OUVRE UNE CONVERSATION ; À DIX, IL
 *   HUMILIE.
 *
 * Ce n'est pas une contrainte d'écran ni un compromis technique. C'est une
 * affirmation sur ce qu'une clinicienne fait d'un diagnostic qu'elle n'a pas
 * demandé : trois choses, elle les lit ; dix, elle ferme l'onglet et n'écrit à
 * personne. On ne vend rien à quelqu'un qu'on vient d'accabler.
 *
 * Décidée le 18 septembre 2026. Voir aussi DECISIONS.md et
 * `20260918193221_third_person_becomes_present_without_and_the_cap_is_decided`.
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
