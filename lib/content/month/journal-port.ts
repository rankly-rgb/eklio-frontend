/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE JOURNAL CÔTÉ SERVEUR — ÉTAGE C2 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LES DEUX TABLES EXISTENT DEPUIS LE 2026-09-23 ET PERSONNE NE LES ÉCRIT.
 *
 * `20260923100000_a_paid_batch_survives_a_crash.sql` crée
 * `content_generation_runs` et `content_generation_results`, avec la contrainte
 * d'unicité qui empêche deux lots ouverts sur le même mois, le drapeau `settled`
 * qui empêche la double facturation, et `abandon_stale_generation_runs()` pour
 * les vingt-neuf jours d'Anthropic. Sa propre en-tête dit pourquoi : « Le
 * harnais local résout ça avec un fichier. Vercel n'a pas de système de fichiers
 * qui survive à l'invocation. »
 *
 * Et aucun fichier TypeScript ne les nommait. C'est la même forme que F46, F47,
 * F49 et F50 — un mécanisme complet d'un côté, sans son appelant de l'autre —
 * sauf qu'ici le côté écrit est le SQL et le côté manquant est tout le reste.
 *
 * ── ⚠ CE MODULE NE DÉCIDE RIEN, IL SE SOUVIENT ──────────────────────────
 *
 * Il ne publie pas : un mois n'entre dans `content_items` qu'entier et contrôlé,
 * ce qui est le travail de `month/assemble.ts`. Il sépare les deux choses que la
 * panne du 2026-09-23 a confondues pour 0,81 $ : le TRAVAIL PAYÉ, qui doit
 * survivre à tout, et la PUBLICATION, qui doit rester atomique.
 *
 * ── L'ORDRE D'ÉCRITURE N'EST PAS NÉGOCIABLE ─────────────────────────────
 *
 *   1. la ligne de `runs`, avec `batch_id`, AVANT la première attente ;
 *   2. une ligne de `results` PAR SUJET, `result` à null, dans la même écriture
 *      — c'est la liste des sujets du lot ;
 *   3. puis chaque `result` se remplit à l'arrivée de sa réponse.
 *
 * Sans l'étape 2, la table reste vide pendant les vingt-cinq minutes où la
 * question se pose. Un `batch_id` sans sa liste de sujets ne se reprend pas : on
 * aurait sauvé de quoi RETROUVER le travail payé, pas de quoi le RECONNAÎTRE.
 */

/**
 * L'état d'une réponse pour un sujet.
 *
 * ⚠ IL EST DÉFINI ICI ET LE HARNAIS L'IMPORTE, PAS L'INVERSE. Un module du
 * chemin produit qui importerait `scripts/local-render/` emporterait un accès au
 * système de fichiers dans une fonction serverless — et le recensement le
 * compterait pour porté alors qu'il serait déplacé. Le sens de la dépendance est
 * donc : le harnais peut lire `lib/`, jamais le contraire.
 */
export type JournalEntry = {
  /** La sortie du modèle, telle que `validateCopy` l'a rendue. */
  result: unknown;
  /** Ce que cet appel a consommé, pour que le coût reste juste après reprise. */
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /**
   * Le crédit a-t-il déjà été soldé pour ce sujet ?
   *
   * ⚠ SANS CE DRAPEAU, UNE REPRISE FACTURE DEUX FOIS. Le premier passage a
   * réservé puis soldé un crédit ; le second, reprenant le même résultat, en
   * réserverait un autre. C'est `content_generation_results.settled` en base.
   */
  settled: boolean;
};

/** Ce qu'une reprise retrouve. Le miroir en base de `Journal`. */
export type RunJournal = {
  runId: string;
  /** `null` quand la ligne existe mais que le lot n'est pas encore soumis. */
  batchId: string | null;
  /** Les sujets que ce lot porte, lus depuis `results`, pas retirés. */
  topicIds: string[];
  entries: Record<string, JournalEntry>;
  state: RunState;
  /** Ce que le mois a coûté jusqu'ici, pour ne pas le recalculer. */
  costUsd: number;
};

export type RunState = "submitted" | "collected" | "published" | "abandoned";

/*
 * ⚠ LE MINIMUM DEMANDÉ À SUPABASE, ET RIEN DE PLUS. Comme `serverCreditPort` et
 * `bank-guard`, ce module reçoit son accès au monde : une doublure suffit alors
 * à éprouver la reprise sans base, ce que la règle de vérification de cette
 * session exige — des lignes posées à la main, sans repaiement ni redébit.
 */
export type JournalDb = {
  from(table: "content_generation_runs" | "content_generation_results"): JournalTable;
};

export type JournalTable = {
  select(columns: string): JournalQuery;
  insert(rows: Record<string, unknown> | Array<Record<string, unknown>>): JournalWrite;
  update(patch: Record<string, unknown>): JournalFilter;
};

export type JournalQuery = {
  eq(column: string, value: unknown): JournalQuery;
  in(column: string, values: unknown[]): JournalQuery;
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
  then<R>(
    onfulfilled: (v: { data: unknown[] | null; error: { message: string } | null }) => R
  ): Promise<R>;
};

export type JournalWrite = {
  select(columns: string): { maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> };
  then<R>(onfulfilled: (v: { error: { message: string } | null }) => R): Promise<R>;
};

export type JournalFilter = {
  eq(column: string, value: unknown): JournalFilter;
  /*
   * ⚠ IL EST LÀ PARCE QUE SON ABSENCE A COÛTÉ UN DÉFAUT, attrapé par le test de
   * reprise le 2026-09-26. `markSettled` recevait `topicIds` et filtrait sur le
   * seul `run_id` : il marquait soldés les TROIS sujets du lot, dont celui qui
   * n'avait jamais reçu de réponse. Un sujet jamais écrit passait pour payé —
   * c'est-à-dire un post acheté et jamais livré, que plus rien ne réclamerait.
   *
   * C'est la forme de F49 : un paramètre qui affirme une comptabilité qu'il ne
   * fait pas. Le type le rend maintenant exprimable.
   */
  in(column: string, values: unknown[]): JournalFilter;
  then<R>(onfulfilled: (v: { error: { message: string } | null }) => R): Promise<R>;
};

/** Ce qui a empêché le journal de faire son travail, dit plutôt que tu. */
export class JournalError extends Error {}

/*
 * ⚠ CE PREMIER DU MOIS EST LE MÊME QUE PARTOUT AILLEURS. La table porte
 * `check (month = date_trunc('month', month)::date)` : une date au milieu du mois
 * serait refusée par la base, ce qui est le bon endroit, mais la refuser ici dit
 * lequel des appelants s'est trompé.
 */
function firstOfMonth(month: string): string {
  if (!/^\d{4}-\d{2}-01$/.test(month)) {
    throw new JournalError(
      `month must be the first of a month (YYYY-MM-01), got ${month} — content_generation_runs_month_check would refuse it`
    );
  }
  return month;
}

type RunRow = {
  id: string;
  batch_id: string | null;
  state: string;
  cost_usd: number | string | null;
};

type ResultRow = {
  topic_id: string;
  result: unknown;
  usage: unknown;
  settled: boolean;
};

const EMPTY_USAGE: JournalEntry["usage"] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function usageOf(raw: unknown): JournalEntry["usage"] {
  const u = (raw ?? {}) as Partial<JournalEntry["usage"]>;
  return {
    input: u.input ?? 0,
    output: u.output ?? 0,
    cacheRead: u.cacheRead ?? 0,
    cacheWrite: u.cacheWrite ?? 0,
  };
}

/**
 * Le journal d'un mois s'il en existe un de REPRENABLE, sinon `null`.
 *
 * ── ⚠ « REPRENABLE » EXCLUT `published` ET `abandoned` ──────────────────
 *
 * Un mois `published` est en base : le reprendre écrirait trente posts une
 * seconde fois. Un mois `abandoned` a dépassé les vingt-neuf jours où Anthropic
 * garde le lot lisible : son `batch_id` ne rend plus rien, et faire croire à une
 * reprise possible coûterait un aller-retour pour apprendre que le travail est
 * perdu. Dans les deux cas la réponse est « pas de reprise », et l'appelant
 * repart d'un mois neuf — ce qui, pour `published`, veut dire ne rien faire.
 */
export async function findResumableRun(
  db: JournalDb,
  brandKitId: string,
  month: string
): Promise<RunJournal | null> {
  const { data, error } = await db
    .from("content_generation_runs")
    .select("id, batch_id, state, cost_usd")
    .eq("brand_kit_id", brandKitId)
    .eq("month", firstOfMonth(month))
    .maybeSingle();

  if (error) throw new JournalError(`content_generation_runs: ${error.message}`);
  if (!data) return null;

  const run = data as RunRow;
  if (run.state !== "submitted" && run.state !== "collected") return null;

  const results = await db
    .from("content_generation_results")
    .select("topic_id, result, usage, settled")
    .eq("run_id", run.id)
    .then((r) => r);
  if (results.error) throw new JournalError(`content_generation_results: ${results.error.message}`);

  const rows = (results.data ?? []) as ResultRow[];
  const entries: Record<string, JournalEntry> = {};
  for (const row of rows) {
    /*
     * ⚠ UNE LIGNE SANS `result` N'EST PAS UNE ENTRÉE, ET ELLE COMPTE QUAND
     * MÊME. Elle dit « ce sujet fait partie du lot payé, sa réponse n'est pas
     * arrivée » — donc elle entre dans `topicIds` et pas dans `entries`. C'est
     * la distinction que l'étape 2 de l'ordre d'écriture existe pour tenir.
     */
    if (row.result === null || row.result === undefined) continue;
    entries[row.topic_id] = {
      result: row.result,
      usage: usageOf(row.usage),
      settled: row.settled === true,
    };
  }

  return {
    runId: run.id,
    batchId: run.batch_id,
    topicIds: rows.map((r) => r.topic_id),
    entries,
    state: run.state,
    costUsd: Number(run.cost_usd ?? 0),
  };
}

/**
 * Ouvre la ligne du mois, ou rend celle qui existe.
 *
 * ⚠ ELLE NE FORCE RIEN. `content_generation_runs_unique (brand_kit_id, month)`
 * est l'arbitre : deux invocations simultanées voient l'une un insert accepté,
 * l'autre un refus, et la seconde relit. Un `upsert` écraserait le `batch_id` de
 * la première — c'est-à-dire l'identifiant d'un lot déjà payé.
 */
export async function openRun(
  db: JournalDb,
  brandKitId: string,
  month: string
): Promise<{ runId: string; created: boolean }> {
  const existing = await db
    .from("content_generation_runs")
    .select("id, batch_id, state, cost_usd")
    .eq("brand_kit_id", brandKitId)
    .eq("month", firstOfMonth(month))
    .maybeSingle();
  if (existing.error) throw new JournalError(`content_generation_runs: ${existing.error.message}`);
  if (existing.data) return { runId: (existing.data as RunRow).id, created: false };

  const inserted = await db
    .from("content_generation_runs")
    .insert({ brand_kit_id: brandKitId, month: firstOfMonth(month), state: "submitted" })
    .select("id")
    .maybeSingle();
  if (inserted.error) throw new JournalError(`content_generation_runs insert: ${inserted.error.message}`);
  if (!inserted.data) throw new JournalError("content_generation_runs insert returned no row");
  return { runId: (inserted.data as { id: string }).id, created: true };
}

/**
 * L'identifiant du lot ET la liste de ses sujets, dans le même appel.
 *
 * ⚠ LES DEUX ÉCRITURES SONT ICI PARCE QUE LES SÉPARER A DÉJÀ COÛTÉ. Un
 * `batch_id` seul a fait rattacher un lot payé à un tirage REFAIT, le
 * 2026-09-23 : les deux ensembles se sont trouvés identiques par coïncidence
 * d'ordonnancement (`next_topic_for_kit` trie par `created_at desc, id`) et le
 * mois est passé. Un sujet ajouté ou expiré entre les deux, et la reprise paie
 * un lot dont elle ne sait plus lire les réponses.
 */
export async function rememberBatch(
  db: JournalDb,
  runId: string,
  batchId: string,
  topicIds: string[]
): Promise<void> {
  if (topicIds.length === 0) {
    throw new JournalError(
      "refusing to remember a batch with no topics: a batch id without its topic list cannot be resumed"
    );
  }

  const patched = await db
    .from("content_generation_runs")
    .update({ batch_id: batchId, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .then((r) => r);
  if (patched.error) throw new JournalError(`content_generation_runs update: ${patched.error.message}`);

  const rows = await db
    .from("content_generation_results")
    .insert(topicIds.map((topicId) => ({ run_id: runId, topic_id: topicId, result: null })))
    .then((r) => r);
  if (rows.error) throw new JournalError(`content_generation_results insert: ${rows.error.message}`);
}

/** Écrit un résultat dès qu'il arrive, sans attendre les suivants. */
export async function rememberResult(
  db: JournalDb,
  runId: string,
  topicId: string,
  entry: Omit<JournalEntry, "settled">
): Promise<void> {
  /*
   * ⚠ `settled` N'EST PAS ÉCRIT ICI, ET C'EST VOLONTAIRE. Arriver n'est pas
   * être payé : l'écrire au même moment ferait croire à une reprise qu'un crédit
   * a été consommé pour une réponse qui n'a encore rien coûté au compteur.
   * `markSettled` est un geste séparé, après le règlement.
   */
  const patched = await db
    .from("content_generation_results")
    .update({ result: entry.result, usage: entry.usage })
    .eq("run_id", runId)
    .eq("topic_id", topicId)
    .then((r) => r);
  if (patched.error) throw new JournalError(`content_generation_results update: ${patched.error.message}`);
}

/**
 * Dit qu'un crédit a été consommé pour ce sujet.
 *
 * ⚠ C'EST LE DRAPEAU QUI EMPÊCHE LA DOUBLE FACTURATION. Une reprise qui
 * relirait `entries` sans lui réserverait un second crédit pour un post déjà
 * payé — trente posts achetés, soixante débités.
 */
export async function markSettled(
  db: JournalDb,
  runId: string,
  topicIds: string[]
): Promise<void> {
  if (topicIds.length === 0) return;
  const patched = await db
    .from("content_generation_results")
    .update({ settled: true })
    .eq("run_id", runId)
    /* ⚠ ET SUR CES SUJETS-LÀ. Sans cette ligne, un sujet sans réponse passe soldé. */
    .in("topic_id", topicIds)
    .then((r) => r);
  if (patched.error) throw new JournalError(`content_generation_results settle: ${patched.error.message}`);
}

/** Ce que le mois a coûté jusqu'ici, pour qu'une reprise ne le recalcule pas. */
export async function rememberCost(
  db: JournalDb,
  runId: string,
  costUsd: number,
  state: RunState
): Promise<void> {
  const patched = await db
    .from("content_generation_runs")
    .update({ cost_usd: costUsd, state, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .then((r) => r);
  if (patched.error) throw new JournalError(`content_generation_runs cost: ${patched.error.message}`);
}

/**
 * Le mois est en base : la ligne passe à `published` et se ferme.
 *
 * ⚠ ELLE N'EST PAS SUPPRIMÉE. Le harnais local vide son fichier, parce qu'un
 * fichier local ne sert à rien après coup. Ici ce qu'un mois a coûté doit rester
 * lisible : c'est la seule trace du prix réel d'un mois livré, et c'est le
 * chiffre sur lequel se décide si l'abonnement à 39 $ tient.
 */
export async function publishRun(
  db: JournalDb,
  runId: string,
  costUsd: number
): Promise<void> {
  const now = new Date().toISOString();
  const patched = await db
    .from("content_generation_runs")
    .update({ state: "published", cost_usd: costUsd, closed_at: now, updated_at: now })
    .eq("id", runId)
    .then((r) => r);
  if (patched.error) throw new JournalError(`content_generation_runs publish: ${patched.error.message}`);
}

/**
 * Les sujets qu'une reprise doit encore FAIRE ÉCRIRE, et ceux qu'elle doit
 * seulement RÉGLER.
 *
 * ⚠ C'EST LA SEULE DÉCISION DE CE MODULE, ET ELLE EST PURE. Trois catégories, et
 * confondre les deux dernières est exactement ce qui fait repayer :
 *
 *   - `toWrite`   aucun résultat : la réponse n'est jamais arrivée ;
 *   - `toSettle`  un résultat, pas de `settled` : payé au fournisseur, pas
 *                 encore décompté du quota de la praticienne ;
 *   - `done`      un résultat ET `settled` : on n'y touche plus.
 */
export function resumePlan(journal: RunJournal): {
  toWrite: string[];
  toSettle: string[];
  done: string[];
} {
  const toWrite: string[] = [];
  const toSettle: string[] = [];
  const done: string[] = [];
  for (const topicId of journal.topicIds) {
    const entry = journal.entries[topicId];
    if (!entry) toWrite.push(topicId);
    else if (entry.settled) done.push(topicId);
    else toSettle.push(topicId);
  }
  return { toWrite, toSettle, done };
}
