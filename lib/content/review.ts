import type { SupabaseClient } from "@supabase/supabase-js";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import type { Palette } from "@/lib/compose/types";
import type { ContentItem } from "@/lib/data/content";
import type { Database } from "@/types/supabase";

/*
 * ── CE QU'IL FAUT POUR COMPOSER UN POST, RASSEMBLÉ UNE FOIS ─────────────
 *
 * L'écran de relecture et la route de téléchargement doivent composer LA MÊME
 * carte : si l'une décidait ses bandeaux autrement que l'autre, le PNG
 * téléchargé ne serait pas celui qu'elle a regardé — et elle ne le découvrirait
 * qu'après l'avoir publié.
 *
 * Donc les deux passent par ici.
 */

export type ReviewCard = {
  archetypeKey: string;
  payload: unknown;
  palette: Palette;
  eyebrow: string;
  headline: string;
  footer: string;
};

/**
 * Les trois bandeaux.
 *
 * ⚠ AUCUN N'EST VIDE, ET AUCUN N'EST INVENTÉ. Le moteur mesure une bande à
 * partir de son texte ; une chaîne vide n'a pas de hauteur et produit une carte
 * dont l'équilibre a été prouvé sur un autre document. Les replis vont donc du
 * plus précis au plus général et s'arrêtent sur le nom du cabinet, qui est
 * toujours là — jamais sur une formule générique.
 */
export function cardBands(
  item: Pick<ContentItem, "theme" | "title" | "topic">,
  practiceName: string | null
): { eyebrow: string; headline: string; footer: string } {
  const fallback = practiceName?.trim() || "Eklio";
  return {
    /*
     * Le thème du mois d'abord : c'est le groupe auquel ce post appartient, et
     * c'est ce qui fait qu'une série de trente se lit comme trois suites. Le
     * libellé d'angle ensuite, qui dit au moins pourquoi cette carte existe.
     */
    eyebrow: (item.theme?.trim() || item.topic?.angle_label?.trim() || fallback).toUpperCase(),
    headline: item.title?.trim() || fallback,
    footer: fallback,
  };
}

/**
 * La carte composable de cet item, ou `null` quand il n'y en a pas.
 *
 * ⚠ `null` EST UNE RÉPONSE, PAS UN ÉCHEC. Un post sans sujet de banque et sans
 * archétype qui se déduise de son titre n'a rien à composer, et l'écran le dit
 * (« nothing to compose yet ») au lieu de fabriquer un payload plausible. Un
 * diagramme inventé à partir d'un titre serait un diagramme qu'elle n'a pas
 * écrit et que personne n'a relu.
 *
 * Une seule exception, et elle est littérale plutôt que devinée :
 * `single_statement` n'a qu'un champ, `statement`, et `displayText` du module
 * dit que la ligne d'affichage EST cette phrase. Le titre d'un post est cette
 * phrase. La correspondance est une égalité, pas une heuristique.
 */
export async function reviewCardFor(
  supabase: SupabaseClient<Database>,
  item: ContentItem,
  direction: DirectionPalette | null,
  practiceName: string | null
): Promise<ReviewCard | null> {
  if (!direction) return null;

  const bands = cardBands(item, practiceName);

  let payload: unknown = null;
  /*
   * ⚠ PAS `item.archetype`. Celui-là est le FORMAT DU POST (`statement`,
   * `question`, `notes`…) et n'a aucun rapport avec les onze mises en page du
   * moteur. La confusion a été attrapée par le compilateur en câblant cet
   * écran ; elle est documentée dans la migration
   * `20260921110000_a_layout_is_hers_to_change`.
   *
   * L'ordre est : ce qu'elle a gardé, sinon ce que le sujet portait.
   */
  let archetypeKey = item.compose_archetype ?? item.topic?.archetype_key ?? "single_statement";

  if (item.topic) {
    /*
     * ⚠ LU AVEC LE CLIENT DE SESSION, SANS NOUVELLE MIGRATION. La RLS de
     * `content_topics` laisse déjà voir un sujet assigné à un de ses kits ;
     * ajouter une RPC pour relire ce qu'une policy autorise déjà, ce serait une
     * seconde porte sur la même pièce.
     */
    const { data } = await supabase
      .from("content_topics")
      .select("payload, archetype_key")
      .eq("id", item.topic.id)
      .maybeSingle();
    if (data) {
      payload = data.payload;
      /*
       * Le sujet est relu ici plutôt que cru sur parole : `topic.archetype_key`
       * arrive bien dans le json de l'item, mais le payload doit de toute façon
       * être lu, et lire les deux dans le même aller-retour évite qu'une clef
       * et un payload dépareillés se croisent.
       */
      archetypeKey = item.compose_archetype ?? data.archetype_key;
    }
  }

  if (payload === null) {
    if (archetypeKey !== "single_statement") return null;
    const statement = item.title?.trim();
    if (!statement) return null;
    payload = { statement };
  }

  return {
    archetypeKey,
    payload,
    /*
     * ⚠ CLAIRE, TOUJOURS, SUR CET ÉCRAN. Le choix clair/sombre appartient au
     * planificateur du mois (`DARK_CARD_RATIO`), pas à cette page : aucune
     * colonne ne porte ce choix par post, donc un sélecteur ici afficherait un
     * réglage qui ne se garde pas. Voir IMPLEMENTATION_REPORT.md, « variante
     * de teinte ».
     */
    palette: cardPalette(item.id, direction, false),
    ...bands,
  };
}
