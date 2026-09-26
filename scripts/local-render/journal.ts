import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/*
 * ── LE JOURNAL D'UN MOIS EN COURS ───────────────────────────────────────
 *
 * ⚠ IL EXISTE PARCE QU'UNE PANNE A JETÉ 0,81 $ D'APPELS DÉJÀ PAYÉS.
 *
 * Le remplissage de banque accumulait 695 réponses en mémoire et insérait à la
 * fin ; PostgreSQL est tombé au 280ᵉ appel et tout est parti. Le même défaut
 * existait à DEUX endroits de plus dans la génération mensuelle, et le pire
 * n'était pas celui qu'on croit.
 *
 * ── CE QU'UN LOT EN COURS A DE PARTICULIER ──────────────────────────────
 *
 * Un lot Batch est FACTURÉ À LA SOUMISSION. Entre `batches.create` et
 * `batches.results`, il se passe vingt-cinq à trente minutes pendant
 * lesquelles l'argent est dépensé et le résultat n'existe nulle part chez
 * nous. Si le processus meurt dans cette fenêtre — redémarrage de conteneur,
 * base tombée, plafond atteint — non seulement les résultats sont perdus,
 * mais **l'identifiant du lot ne survivait que dans une ligne de log**. Rien
 * ne pouvait aller les rechercher : il fallait re-soumettre, et repayer.
 *
 * Le journal est écrit AVANT que la première réponse n'arrive, dès que le lot
 * a un identifiant. C'est la seule fenêtre où une écriture change quelque
 * chose.
 *
 * ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────
 *
 * Il ne publie rien. Un mois ne s'écrit en base qu'une fois entier et une fois
 * contrôlé — `checkMonth` ne peut pas juger un mélange sur vingt-neuf posts.
 * Le journal sépare donc deux choses qui étaient confondues : le TRAVAIL PAYÉ,
 * qui doit survivre à tout, et la PUBLICATION, qui doit rester atomique.
 */

/*
 * ⚠ UNE SEULE DÉFINITION, ET ELLE EST DANS `lib/`. Le journal local et le
 * journal en base portent la même entrée : la dupliquer les laisserait
 * diverger — c'est `settled` qui empêche la double facturation des deux côtés,
 * et une entrée qui l'aurait perdu d'un seul côté ne le dirait pas.
 *
 * Le sens de la dépendance est délibéré : ce fichier est du harnais, il peut
 * lire `lib/` ; l'inverse emporterait `node:fs` dans une fonction serverless.
 */
import type { JournalEntry } from "@/lib/content/month/journal-port";
export type { JournalEntry };

export type Journal = {
  month: string;
  email: string;
  /** L'identifiant du lot, écrit dès sa création. */
  batchId: string | null;
  /**
   * Les sujets que ce lot porte, écrits avec lui.
   *
   * ⚠ UN IDENTIFIANT DE LOT SANS SA LISTE DE SUJETS NE SE REPREND PAS.
   *
   * Rencontré en vrai le 2026-09-23 : une reprise a rattaché le bon lot — déjà
   * payé — puis a REFAIT SON TIRAGE. Les deux ensembles se sont trouvés
   * identiques, et le mois est passé : `next_topic_for_kit` trie par
   * `created_at desc, id`, donc deux tirages consécutifs sur la même banque
   * rendent la même chose. **C'est une coïncidence d'ordonnancement, pas une
   * garantie** — un sujet ajouté, expiré ou pris par une autre praticienne
   * entre les deux, et la reprise paie un lot dont elle ne sait plus lire les
   * réponses.
   *
   * La liste est donc écrite AVEC l'identifiant, dans la même écriture.
   */
  topicIds: string[];
  entries: Record<string, JournalEntry>;
};

const path = (month: string, email: string) =>
  `.eklio-journal/${month}-${email.replace(/[^a-z0-9]+/gi, "-")}.json`;

export function loadJournal(month: string, email: string): Journal {
  const file = path(month, email);
  if (!existsSync(file)) return { month, email, batchId: null, topicIds: [], entries: {} };
  try {
    const read = JSON.parse(readFileSync(file, "utf8")) as Partial<Journal>;
    // ⚠ Un journal écrit avant que `topicIds` n'existe se relit sans lever :
    // il n'a pas de liste, donc il ne prétend pas en avoir une.
    return { month, email, batchId: read.batchId ?? null,
             topicIds: read.topicIds ?? [], entries: read.entries ?? {} };
  } catch {
    /*
     * ⚠ UN JOURNAL ILLISIBLE EST UN JOURNAL VIDE, PAS UNE PANNE. Il n'est
     * qu'une optimisation de reprise : refuser de démarrer parce qu'il est
     * corrompu coûterait plus que de tout regénérer.
     */
    return { month, email, batchId: null, topicIds: [], entries: {} };
  }
}

export function saveJournal(j: Journal): void {
  const file = path(j.month, j.email);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(j, null, 2), "utf8");
}

/** Écrit l'identifiant du lot AVANT d'attendre quoi que ce soit. */
export function rememberBatch(j: Journal, batchId: string, topicIds: string[]): Journal {
  // ⚠ L'identifiant ET les sujets, dans la même écriture : un lot dont on a
  // perdu la liste des sujets est un lot payé qu'on ne sait plus lire.
  const next = { ...j, batchId, topicIds };
  saveJournal(next);
  return next;
}

/** Écrit un résultat dès qu'il arrive, sans attendre les suivants. */
export function rememberResult(
  j: Journal,
  topicId: string,
  entry: JournalEntry
): Journal {
  j.entries[topicId] = entry;
  saveJournal(j);
  return j;
}

/** Un mois publié n'a plus de journal : il a une ligne en base. */
export function clearJournal(j: Journal): void {
  saveJournal({ ...j, batchId: null, topicIds: [], entries: {} });
}
