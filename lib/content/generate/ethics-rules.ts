import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LES RÈGLES DÉONTOLOGIQUES, POUR LE PRÉFIXE DU MODÈLE ────────────────
 *
 * ⚠ LUES DEPUIS `ethics_rules`, JAMAIS RECOPIÉES. Elles entrent dans le
 * préfixe mis en cache (`cachedPrefix`), donc dans chaque post écrit. Une
 * copie en TypeScript voudrait dire qu'une septième règle ajoutée en base
 * n'atteindrait jamais le modèle — et personne ne le verrait, puisque les
 * posts continueraient de sortir.
 *
 * ⚠ ET UNE LECTURE QUI ÉCHOUE NE REND PAS UNE LISTE VIDE.
 *
 * C'est la décision la plus importante de ce fichier. Un préfixe sans règles
 * produit des posts que rien n'a bornés, sous le nom d'une praticienne
 * licenciée, et ils sortiraient parfaitement bien formés — le validateur ne
 * regarde que la forme. La garde en base refuserait l'écriture la plupart du
 * temps, mais elle ne couvre pas tout ce que ces six règles disent.
 *
 * Donc on lève. Pas de génération vaut mieux qu'une génération non bornée.
 */

export class EthicsRulesUnavailableError extends Error {
  constructor(detail: string) {
    super(
      `The advertising rules could not be read, so nothing was generated: ${detail}. ` +
        `Writing without them would produce copy under a licensee's name that nothing bounded.`
    );
    this.name = "EthicsRulesUnavailableError";
  }
}

export type EthicsRule = { id: string; short_label: string; description: string };

export async function ethicsRulesFor(
  supabase: SupabaseClient<Database>
): Promise<EthicsRule[]> {
  const { data, error } = await supabase
    .from("ethics_rules")
    .select("id, short_label, description")
    .eq("active", true)
    .order("sort_order");

  if (error) {
    throw new EthicsRulesUnavailableError(`${error.code ?? "?"} ${error.message}`);
  }
  if (!data || data.length === 0) {
    /*
     * Zéro règle active est un état de base, pas une erreur de transport — et
     * il mène au même endroit : un préfixe qui ne borne rien.
     */
    throw new EthicsRulesUnavailableError("no active rule in ethics_rules");
  }

  return data.map((row) => ({
    id: row.id,
    short_label: row.short_label,
    description: row.description,
  }));
}
