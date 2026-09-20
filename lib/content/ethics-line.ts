import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LA LIGNE DÉONTOLOGIQUE DE L'ÉCRAN DE RELECTURE ──────────────────────
 *
 * ⚠ ELLE EST CALCULÉE, PAS ÉCRITE. Le texte affiché vient de `ethics_scan()`,
 * la même fonction que les triggers d'écriture appellent — donc la ligne dit
 * ce que la base a réellement regardé, et elle change le jour où une règle
 * change. Une phrase rassurante codée en dur dans le composant resterait vraie
 * à l'écran longtemps après avoir cessé de l'être.
 *
 * ⚠ ET ELLE NE PEUT PAS MENTIR DANS LE SENS DANGEREUX. Un motif `block` ne
 * peut pas apparaître sur un item enregistré : le trigger a refusé l'écriture.
 * Si un `block` remonte quand même ici, c'est que quelque chose a contourné le
 * chemin d'écriture, et la ligne le dit en rouge au lieu de l'avaler.
 *
 * Les `warn` (« award-winning », « nationally recognized ») passent à
 * l'écriture et sont signalés ici : c'est exactement le partage voulu — la base
 * refuse, l'écran conseille, et c'est elle qui corrige ses propres mots.
 */

const matchSchema = z.object({
  rule_id: z.string(),
  severity: z.string(),
  excerpt: z.string(),
});
const scanSchema = z.array(matchSchema);

export type EthicsMatch = z.infer<typeof matchSchema>;

export type EthicsLine = {
  /** `false` quand le scan n'a pas pu tourner : on ne prétend alors rien. */
  scanned: boolean;
  blocking: EthicsMatch[];
  warnings: EthicsMatch[];
};

/** Les familles de règles, dans les mots de la base (`ethics_patterns.rule_id`). */
export const ETHICS_RULE_WORDS: Record<string, string> = {
  outcome_promise: "a promised outcome",
  is_gone: "a symptom promised gone",
  dated_promise: "a result on a deadline",
  guarantee: "a guarantee",
  clinically_proven: "a claim of proof",
  success_rate: "a success rate",
  lasting_relief: "permanent relief",
  therapy_that_works: "therapy that works",
  testimonial_word: "a testimonial",
  clients_say: "what clients say",
  client_reviews: "client reviews",
  star_rating: "a star rating",
  success_story: "a success story",
  best_therapist: "best in a category",
  award_winning: "award-winning",
  weekend_certification: "a weekend certification",
  you_have_condition: "telling a reader what they have",
  scarcity_urgency: "urgency or scarcity",
};

/** Les mots de la règle, ou son identifiant brut plutôt qu'une phrase inventée. */
export function ethicsRuleWords(ruleId: string): string {
  return ETHICS_RULE_WORDS[ruleId] ?? ruleId.replace(/_/g, " ");
}

export function splitEthics(matches: EthicsMatch[]): EthicsLine {
  return {
    scanned: true,
    blocking: matches.filter((m) => m.severity === "block"),
    warnings: matches.filter((m) => m.severity === "warn"),
  };
}

/**
 * Le scan de tout ce que ce post publie, en un seul appel.
 *
 * ⚠ TOUT, Y COMPRIS LES LIBELLÉS DU DIAGRAMME. Un mot posé sur la carte est
 * publié aussi fort qu'une phrase de légende, et c'est précisément l'écart que
 * `20260920160000_a_diagram_label_is_published_text` a fermé côté base. La
 * ligne de cet écran regarde la même surface, sinon elle dirait « rien à
 * signaler » d'un texte que la base, elle, regarde.
 *
 * Les morceaux sont joints par un point-espace et non par un espace : les
 * motifs sont bornés par `[^.!?]{0,30}`, et coller deux champs bout à bout
 * fabriquerait des voisinages qui n'existent sur aucune carte.
 */
export async function ethicsLineFor(
  supabase: SupabaseClient<Database>,
  parts: (string | null | undefined)[]
): Promise<EthicsLine> {
  const text = parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(". ");
  if (text === "") return { scanned: true, blocking: [], warnings: [] };

  const { data, error } = await supabase.rpc("ethics_scan", { p_text: text });
  if (error) return { scanned: false, blocking: [], warnings: [] };

  const parsed = scanSchema.safeParse(data);
  if (!parsed.success) return { scanned: false, blocking: [], warnings: [] };
  return splitEthics(parsed.data);
}

/**
 * Le texte publié d'un payload de diagramme, à plat.
 *
 * Le pendant TypeScript de `content_topic_text(jsonb)`. Les deux existent
 * parce que les deux côtés doivent regarder la même surface ; le test
 * `lib/content/__tests__/ethics-line.test.ts` pin la liste des clés lues.
 */
export const PUBLISHED_TEXT_KEYS = [
  "statement",
  "label",
  "gloss",
  "axis_x",
  "axis_y",
  "acronym",
  "lines",
] as const;

export function payloadPublishedText(payload: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        /*
         * ⚠ `archetype_key` N'EST PAS DU TEXTE PUBLIÉ. C'est une clé de
         * système, et la scanner ferait remonter des règles sur des mots que
         * personne ne lira jamais sur une carte.
         */
        if (key === "archetype_key") continue;
        walk(inner);
      }
    }
  };
  walk(payload);
  return out;
}
