import type { SupabaseClient } from "@supabase/supabase-js";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import type { Palette } from "@/lib/compose/types";
import type { ContentItem } from "@/lib/data/content";
import type { Database } from "@/types/supabase";
import { capitaliseTitle, eyebrowFor } from "@/lib/content/bands";
import { licenceMention } from "@/lib/content/licence";

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
  practiceName: string | null,
  /**
   * La mention de licence, quand le brief la porte.
   *
   * ⚠ LE PIED EST L'ENDROIT JUSTE, et il n'y en a pas d'autre. Californie B&P
   * §4980.44 exige le type et le numéro dans TOUTE publicité ; le pied est la
   * seule bande présente sur les onze archétypes, déjà en mono, déjà petite,
   * et elle porte déjà le nom du cabinet. Mettre la mention dans le surtitre
   * la ferait entrer en concurrence avec le libellé d'intention ; dans le
   * contenu, elle volerait la place du diagramme.
   */
  /*
   * ── ⚠ ELLE EST OBLIGATOIRE DEPUIS F56, ET ELLE ÉTAIT FACULTATIVE ──────
   *
   * Elle portait `?`. Le seul appelant de production — `reviewCardFor`, que
   * l'écran de relecture ET la route d'image partagent — ne la passait pas. Le
   * repli rendait donc le nom du cabinet seul, et CHAQUE carte qu'une praticienne
   * regarde ou télécharge sortait sans numéro de licence. Un seul test la passait,
   * et un autre affirmait que l'omission était le comportement attendu.
   *
   * Sans le `?`, le compilateur nomme tous les appelants. C'est la seule forme de
   * ce contrôle qu'on ne peut pas oublier de brancher — la leçon de F50.
   */
  licence: string | null
): { eyebrow: string; headline: string; footer: string } {
  const fallback = practiceName?.trim() || "Eklio";
  return {
    /*
     * ⚠ LE THÈME PASSAIT EN PREMIER, ET IL PASSE MAINTENANT EN DERNIER.
     *
     * Un thème dérivé est une phrase, pas une étiquette : les dix posts d'un
     * même thème portaient donc le même surtitre de quatorze mots. Ce qui est
     * propre à CETTE carte — le libellé d'angle de son sujet, puis son titre —
     * vient d'abord, et `eyebrowFor` ramène le tout à une à quatre mots.
     */
    eyebrow: eyebrowFor(
      { angleLabel: item.topic?.angle_label, title: item.title, theme: item.theme },
      practiceName
    ),
    // ⚠ La casse est corrigée ICI, sur le chemin que l'écran de relecture et
    // la route d'image partagent — pas à l'écriture. Un mois déjà en base
    // s'affiche donc corrigé, sans migration de données.
    headline: capitaliseTitle(item.title?.trim() || fallback),
    /*
     * ⚠ SÉPARÉE PAR UN POINT MÉDIAN, PAS PAR UNE VIRGULE. « Willow Clinic,
     * LMFT 12345 » se lit comme une adresse ; « Willow Clinic · LMFT 12345 »
     * se lit comme deux informations, ce qu'elles sont.
     */
    footer: licence ? `${fallback} · ${licence}` : fallback,
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
  practiceName: string | null,
  /*
   * ⚠ LA MENTION VIENT DE L'APPELANT, ET ELLE N'EST PAS FACULTATIVE (F56).
   * `null` est une réponse — un brief sans licence — et c'est à l'écran de le
   * dire ; l'OUBLIER n'en est pas une, et c'est ce qui arrivait.
   */
  licence: string | null
): Promise<ReviewCard | null> {
  if (!direction) return null;

  const bands = cardBands(item, practiceName, licence);

  /*
   * ── LE PAYLOAD DE CE POST-CI PASSE AVANT CELUI DU SUJET ───────────────
   *
   * ⚠ ET SANS ÇA, UN POST ÉCRIT À LA DEMANDE N'AVAIT PAS DE CARTE. Une idée
   * libre ne vient d'aucun sujet de banque : son diagramme est écrit sur
   * `content_items.payload`, et ce module n'allait le chercher que sur
   * `content_topics`. Un carrousel non plus — ses cartes sont sur le post.
   * L'écran de relecture affichait donc, pour les deux cas que « Write it »
   * produit le plus souvent, exactement l'absence de carte que ce chantier
   * existe pour supprimer.
   *
   * L'ordre est celui de la propriété : ce qui est écrit SUR son post est à
   * elle, le sujet de banque est du stock partagé.
   */
  let payload: unknown = item.payload ?? null;
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
    const { data, error } = await supabase
      .from("content_topics")
      .select("payload, archetype_key")
      .eq("id", item.topic.id)
      .maybeSingle();

    /*
     * ⚠ L'ERREUR EST JOURNALISÉE, PUIS LA PAGE CONTINUE. `content_topics`
     * n'existe pas sur un déploiement dont les migrations du chantier ne sont
     * pas appliquées : la lecture échoue, il n'y a pas de carte à composer, et
     * c'est une réponse acceptable — l'écran de relecture rend le reste.
     *
     * Ce qui ne serait PAS acceptable est de l'avaler en silence. La version
     * précédente ne lisait même pas `error` : une table absente et un sujet
     * retiré de la banque produisaient exactement la même page, et rien ne
     * permettait de les distinguer depuis les logs.
     */
    if (error) {
      console.error("[content] reviewCardFor: content_topics", {
        code: error.code ?? null,
        message: error.message,
      });
    }
    if (data) {
      // ⚠ Le payload du sujet ne réécrit PAS celui du post : `apply_on_demand_write`
      //   a pu écrire une version plus précise que le stock.
      payload = payload ?? data.payload;
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

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F56 — LA MENTION DE LICENCE, LUE SUR LE CHEMIN DE LECTURE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ TROUVÉ LE 2026-09-26 EN VÉRIFIANT UN MOIS SORTI DU CHEMIN PRODUIT.
 *
 * La composition à l'écriture porte bien la mention — `month/compose-card.ts`
 * REFUSE un pied qui ne la porte pas. Mais rien n'est stocké : `content_items`
 * n'a pas de colonne de pied, et la carte est RECOMPOSÉE à la lecture. Or
 * `reviewCardFor` appelait `cardBands(item, practiceName)` sans la mention, et le
 * repli rendait le nom du cabinet seul.
 *
 * Donc chaque carte qu'une praticienne regarde — et chaque image qu'elle
 * TÉLÉCHARGE pour la publier, par `app/api/content-items/[id]/image` — sortait
 * sans numéro de licence. C'est exactement l'infraction que F45 reprochait à
 * l'autre générateur, et elle était vivante sur le chemin de lecture.
 *
 * ⚠ ET LA LECTURE EST ICI, PAS DANS L'ÉCRAN. Deux écrans la faisaient chacun à
 * leur façon, ou pas du tout. Un seul endroit lit le brief et la matrice, et les
 * deux appelants s'en servent.
 */

/**
 * La mention de licence d'un projet, ou `null` quand le brief ne la porte pas.
 *
 * ⚠ L'ABRÉVIATION VIENT DE `license_type_states`, ET `verified_at` EST LU. Un État
 * dont personne n'a encore lu la règle publicitaire ne rend pas d'abréviation
 * (F12) : la mention retombe alors sur `LICENCE_ABBREVIATION`, une table du code,
 * ce qui est le comportement de `licenceMention` et non le nôtre à décider.
 */
export async function licenceMentionFor(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const brief = await supabase
    .from("project_briefs")
    .select("license_type_id, license_number, license_state_code, state")
    .eq("project_id", projectId)
    .maybeSingle();
  if (brief.error || !brief.data) return null;
  const row = brief.data as {
    license_type_id: string | null;
    license_number: string | null;
    license_state_code: string | null;
    state: string | null;
  };

  /* ⚠ Le même repli que le préalable et que le harnais : le champ dédié, sinon l'État du cabinet. */
  const stateCode = (row.license_state_code || row.state || "").toUpperCase();
  let abbreviation: string | null = null;
  if (row.license_type_id && stateCode) {
    const matrix = await supabase
      .from("license_type_states")
      .select("abbreviation, verified_at")
      .eq("license_type_id", row.license_type_id)
      .eq("state_code", stateCode)
      .maybeSingle();
    const m = matrix.data as { abbreviation?: string | null; verified_at?: string | null } | null;
    abbreviation = m?.verified_at ? (m.abbreviation ?? null) : null;
  }

  return licenceMention({
    licenseTypeId: row.license_type_id,
    licenseNumber: row.license_number,
    abbreviation,
  });
}
