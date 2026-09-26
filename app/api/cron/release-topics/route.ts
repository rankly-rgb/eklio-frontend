import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";

/*
 * ── RENDRE LES SUJETS QUE RIEN NE RETIENT PLUS ──────────────────────────
 *
 * ⚠ MESURÉ, PAS CRAINT. Le 2026-09-26, la banque locale portait **994
 * assignations orphelines** : des sujets marqués pris par des exécutions tuées,
 * des lots en erreur, des sessions coupées. Chacune retire un sujet à TOUT LE
 * SEGMENT pendant quatre-vingt-dix jours — c'est la fenêtre anti-collision de
 * F13 — et le tirage suivant voit une banque courte sans que rien ne dise
 * pourquoi. Deux essais sur cinq ont été refusés avant la moindre dépense pour
 * cette seule raison.
 *
 * `release_stale_topic_assignments()` existait et ne tournait QUE dans le
 * harnais, en tête de génération. Une génération qu'on n'a pas lancée ne balaie
 * rien : le résidu s'accumulait entre deux runs, et en production il
 * s'accumulerait entre deux mois.
 *
 * ── ⚠ POURQUOI UNE TÂCHE PLANIFIÉE, ET PAS SEULEMENT AU DÉMARRAGE ───────
 *
 * Au démarrage d'une génération, le balai répare la banque pour CETTE
 * génération. Il ne répare rien pour les praticiennes du même segment qui
 * tirent avant elle : une exécution tuée à 3 h du matin bloque le segment
 * jusqu'à la prochaine génération, quelle qu'elle soit. La fenêtre est de
 * quatre-vingt-dix jours et le délai de grâce de trois heures ; entre les deux,
 * il faut quelque chose qui passe régulièrement.
 *
 * ── ⚠ LE DÉLAI DE GRÂCE EST EN BASE, PAS ICI ────────────────────────────
 *
 * `topic_assignment_grace()` vaut trois heures et `topic_assignment_holds()`
 * protège aussi toute assignation dont un `content_items` existe — une
 * assignation qui a LIVRÉ n'est jamais rendue. Cette route ne décide donc rien :
 * elle appelle. Poser le délai ici en aurait fait un second endroit, et celui
 * des deux qu'on oublie est celui qui décide.
 *
 * ⚠ ET ELLE ÉCHOUE FERMÉ, contrairement à `purge-events`. Un balai qui ne
 * tourne pas laisse des sujets bloqués — récupérable au tour suivant. Un balai
 * qui rendrait des assignations EN COURS ferait tirer deux praticiennes sur le
 * même sujet, ce qui ne se répare pas après coup. La fonction SQL porte cette
 * prudence ; la route se contente de remonter son erreur en 500 plutôt que de
 * répondre « ok » sur un balayage qui n'a pas eu lieu.
 */

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const { data, error } = await createAdminClient().rpc("release_stale_topic_assignments");

  if (error) {
    console.error(`[cron/release-topics] ${error.message}`);
    return NextResponse.json({ ok: false, released: 0 }, { status: 500 });
  }

  const released = typeof data === "number" ? data : 0;

  /*
   * ── ⚠ ET LE MÊME PASSAGE FERME LES LOTS QU'ANTHROPIC NE GARDE PLUS ─────
   *
   * `abandon_stale_generation_runs()` existe depuis le 2026-09-23 et AUCUN
   * fichier TypeScript ne l'appelait — trouvé le 2026-09-26 en recensant le
   * journal. Une fonction planifiée que rien ne planifie ne tourne jamais, et
   * rien ne le dit : elle répond correctement quand on l'appelle à la main.
   *
   * Ce qu'elle laisse faute de tourner : une ligne `submitted` de plus de
   * vingt-neuf jours reste ouverte alors que son lot n'est plus lisible chez
   * Anthropic. `content_generation_runs_unique (brand_kit_id, month)` fait alors
   * qu'aucun nouveau mois ne peut s'ouvrir pour ce kit et ce mois-là : la
   * praticienne est bloquée par la trace d'une panne d'il y a un mois. Et une
   * reprise qui rattacherait ce `batch_id` paierait un aller-retour pour
   * apprendre que le travail est perdu.
   *
   * ⚠ ELLE PASSE ICI PARCE QUE C'EST LE SEUL BALAI QUOTIDIEN QUI EXISTE, et pas
   * parce que les deux sujets se ressemblent : les deux ferment ce qu'une
   * exécution tuée a laissé ouvert. Une seconde entrée de cron pour une requête
   * d'une ligne serait un second endroit à se rappeler d'armer.
   *
   * ⚠ ET ELLE N'EMPÊCHE PAS LA ROUTE DE RÉUSSIR. La libération est ce que cette
   * route existe pour faire ; échouer fermé sur l'abandon rendrait 500 sur un
   * balayage de sujets qui, lui, a eu lieu — et le tour suivant le refarait pour
   * rien. L'écart est DIT, pas avalé : `abandoned: null` dans la réponse, et un
   * `console.error`.
   */
  const stale = await createAdminClient().rpc("abandon_stale_generation_runs");
  let abandoned: number | null = null;
  if (stale.error) {
    console.error(`[cron/release-topics] abandon_stale_generation_runs: ${stale.error.message}`);
  } else {
    abandoned = typeof stale.data === "number" ? stale.data : 0;
    if (abandoned > 0) {
      console.warn(
        `[cron/release-topics] ${abandoned} lot(s) de génération abandonné(s) — plus rattachables chez le fournisseur`
      );
    }
  }

  /*
   * ⚠ ON LE DIT MÊME À ZÉRO, ET SURTOUT QUAND CE N'EST PAS ZÉRO. Un nombre non
   * nul signifie qu'une exécution a été tuée quelque part : c'est la seule trace
   * qu'on en aura, et le harnais l'imprime pour la même raison.
   */
  if (released > 0) {
    console.warn(
      `[cron/release-topics] ${released} assignation(s) rendue(s) — des exécutions n'ont rien livré`
    );
  } else {
    console.info("[cron/release-topics] rien à rendre");
  }
  return NextResponse.json({ ok: true, released, abandoned });
}
