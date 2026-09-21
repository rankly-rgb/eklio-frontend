import { hasNoGeneratedPosts } from "@/lib/content/partition";
import type { ContentMonth, ContentMonthRecord, ContentResult } from "@/lib/data/content";

/*
 * ── QUEL ÉCRAN, POUR QUEL ÉTAT ──────────────────────────────────────────
 *
 * La décision vivait dans le JSX de `/app/content`, en ternaires imbriqués.
 * Elle marchait, et elle avait un angle mort exact : **on ne pouvait pas
 * l'éprouver.** Sans infrastructure de rendu React dans ce dépôt, la seule
 * façon de prouver que la page se rend correctement dans une configuration
 * donnée était de la déployer et de regarder — ce qui est précisément ce qui
 * a laissé « Something went wrong » atteindre une preview.
 *
 * Elle est ici, pure, et `__tests__/month-screen.test.ts` la parcourt dans les
 * quatre configurations que le débogage demandait :
 *
 *   1. sans variables ET sans migrations   — la preview telle qu'elle était
 *   2. avec migrations, sans variables
 *   3. avec les deux, zéro post
 *   4. avec les deux, un mois généré
 *
 * ⚠ AUCUN JSX ICI, ET AUCUNE LECTURE D'ENVIRONNEMENT. `armed` et `detail` sont
 * des ARGUMENTS : la page les lit et les passe. Une fonction qui lirait
 * `process.env` elle-même ne pourrait pas être éprouvée dans les deux sens.
 */

/** Les deux vues de `/app/content`. Le flux est le défaut. */
export type MonthView = "stream" | "calendar";

export type MonthScreen =
  /** Cet environnement est en retard sur le code. Pas une panne, pas de réessai. */
  | { kind: "not_deployed"; detail: string | null }
  /** Une vraie panne. C'est le seul cas qui dit « réessayez ». */
  | { kind: "failed"; message: string; detail: string | null }
  /** Son mois est vide, et c'est un état normal. */
  | { kind: "empty"; automatic: boolean }
  /** Eklio écrit son mois en ce moment. */
  | { kind: "generating" }
  /** La génération a échoué, et rien n'a été facturé. */
  | { kind: "generation_failed" }
  /** Il y a des cartes à montrer. */
  | { kind: "month" }
  /**
   * La grille du mois.
   *
   * ⚠ ELLE NE DÉPEND QUE DE LA VUE ET DE LA LECTURE. Un mois sans post généré
   * a toujours un calendrier : c'est là qu'elle voit ses propres posts, ses
   * brouillons sans date, et qu'elle en crée.
   */
  | { kind: "calendar" };

export function monthScreen(input: {
  result: ContentResult<ContentMonth>;
  record: ContentMonthRecord | null;
  /** La génération mensuelle est-elle armée DANS CET ENVIRONNEMENT ? */
  automatic: boolean;
  /** La cause technique, déjà filtrée par l'appelant selon l'environnement. */
  detail: string | null;
  /** Celle qu'elle regarde. Le flux par défaut. */
  view: MonthView;
}): MonthScreen {
  const { result, record, automatic, detail, view } = input;

  if (!result.ok) {
    /*
     * ⚠ DEUX CODES, UN SEUL ÉCRAN — ET C'EST VOULU. `not_deployed` (la RPC
     * n'existe pas ici) et `schema_mismatch` (la base est plus ancienne que le
     * code) sont deux symptômes du même fait : cet environnement n'a pas reçu
     * les migrations. Elle n'a rien à faire dans les deux cas, et lui montrer
     * deux écrans différents pour une distinction qui ne la concerne pas
     * serait de la précision sans usage.
     */
    if (result.code === "not_deployed" || result.code === "schema_mismatch") {
      return { kind: "not_deployed", detail };
    }
    return { kind: "failed", message: result.message, detail };
  }

  /*
   * ⚠ LA VUE CALENDRIER GAGNE SUR TOUS LES ÉTATS DE LECTURE RÉUSSIE, ET
   * C'EST LE CORRECTIF.
   *
   * L'état vide, l'attente de génération et l'échec de génération décrivent
   * tous **le flux de cartes** : ils disent où en est le mois qu'Eklio écrit.
   * Le calendrier répond à une autre question — « qu'est-ce qui est posé sur
   * quel jour, et qu'est-ce que j'ajoute » — et cette question a une réponse
   * même quand Eklio n'a rien écrit.
   *
   * Avant, « vide » était évalué au-dessus de la vue et court-circuitait les
   * deux. Le bouton « Open the calendar » basculait bien l'état — il devenait
   * « Back to the cards » — et rendait le même écran vide. La grille ne
   * s'affichait jamais, et le texte de l'état vide promettait pourtant
   * qu'elle pouvait planifier et écrire ses propres posts.
   *
   * ⚠ LES DEUX REFUS DE LECTURE RESTENT AU-DESSUS, eux. On ne dessine pas une
   * grille à partir de données qu'on n'a pas pu lire.
   */
  if (view === "calendar") return { kind: "calendar" };

  /*
   * ⚠ « VIDE » VEUT DIRE « AUCUN POST GÉNÉRÉ », PAS « AUCUN ITEM ».
   *
   * Le compte portait sur tous les items, donc un brouillon qu'elle avait créé
   * elle-même suffisait à faire croire à l'écran que le mois existait. La
   * preview montrait exactement ça : une carte vide de janvier à la place de
   * l'état vide, sur un mois où rien n'avait jamais été généré.
   *
   * La question à laquelle l'état vide répond est « Eklio a-t-il écrit mon
   * mois ? ». Trois brouillons à elle n'y répondent pas oui.
   */
  const empty = hasNoGeneratedPosts(result.data);

  /*
   * ⚠ L'ÉTAT DU MOIS NE COMPTE QUE S'IL N'Y A RIEN À MONTRER. Un mois marqué
   * `generating` qui porte déjà des cartes doit montrer les cartes : elle
   * préfère lire ce qui est écrit plutôt qu'un écran d'attente pour le reste.
   */
  if (empty && record?.status === "generating") return { kind: "generating" };
  if (empty && record?.status === "failed") return { kind: "generation_failed" };
  if (empty) return { kind: "empty", automatic };

  return { kind: "month" };
}
