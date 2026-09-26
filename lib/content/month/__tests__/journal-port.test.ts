import { beforeEach, describe, expect, it } from "vitest";
import {
  findResumableRun,
  JournalError,
  markSettled,
  openRun,
  publishRun,
  rememberBatch,
  rememberCost,
  rememberResult,
  resumePlan,
  type JournalDb,
} from "@/lib/content/month/journal-port";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA REPRISE, PROUVÉE PAR DES LIGNES POSÉES À LA MAIN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE QUI EST ÉPROUVÉ ICI EST UNE ABSENCE DE DÉPENSE, et une absence ne se
 * voit pas en regardant un résultat. La doublure compte donc les ÉCRITURES : ce
 * qui n'est pas réécrit n'a pas été repayé, ce qui n'est pas resoldé n'a pas été
 * redébité.
 *
 * Les lignes sont posées directement dans la doublure, comme la panne du
 * 2026-09-23 les a laissées : un lot soumis, quelques réponses arrivées, une
 * partie soldée. C'est l'état qu'aucun test ne pouvait produire avant, parce que
 * rien en TypeScript n'écrivait ces deux tables.
 */

type Row = Record<string, unknown>;

/** Une base en mémoire qui se laisse poser à la main et qui compte ce qu'on lui fait. */
function fakeDb() {
  const runs: Row[] = [];
  const results: Row[] = [];
  const writes: string[] = [];

  function table(name: "content_generation_runs" | "content_generation_results") {
    const rows = name === "content_generation_runs" ? runs : results;

    const query = (filters: Array<[string, unknown]>) => {
      const ins: Array<[string, unknown[]]> = [];
      const matching = () =>
        rows.filter(
          (r) =>
            filters.every(([col, val]) => r[col] === val) &&
            ins.every(([col, vals]) => vals.includes(r[col]))
        );
      const q = {
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return q;
        },
        in(col: string, vals: unknown[]) {
          ins.push([col, vals]);
          return q;
        },
        async maybeSingle() {
          return { data: matching()[0] ?? null, error: null };
        },
        then<R>(fn: (v: { data: unknown[] | null; error: null }) => R) {
          return Promise.resolve(fn({ data: matching(), error: null }));
        },
      };
      return q;
    };

    return {
      select: () => query([]),
      insert(payload: Row | Row[]) {
        const incoming = Array.isArray(payload) ? payload : [payload];
        for (const row of incoming) {
          /* La contrainte d'unicité de la table, tenue par la doublure. */
          if (name === "content_generation_runs") {
            const clash = runs.find(
              (r) => r.brand_kit_id === row.brand_kit_id && r.month === row.month
            );
            if (clash) {
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: "duplicate key value violates content_generation_runs_unique" },
                  }),
                }),
                then: <R,>(fn: (v: { error: { message: string } }) => R) =>
                  Promise.resolve(
                    fn({ error: { message: "duplicate key value violates content_generation_runs_unique" } })
                  ),
              };
            }
          }
          rows.push({ id: `row-${rows.length + 1}`, settled: false, cost_usd: 0, ...row });
          writes.push(`insert ${name} ${JSON.stringify(row)}`);
        }
        const last = rows[rows.length - 1];
        return {
          select: () => ({ maybeSingle: async () => ({ data: last, error: null }) }),
          then: <R,>(fn: (v: { error: null }) => R) => Promise.resolve(fn({ error: null })),
        };
      },
      update(patch: Row) {
        const filters: Array<[string, unknown]> = [];
        const ins: Array<[string, unknown[]]> = [];
        const f = {
          eq(col: string, val: unknown) {
            filters.push([col, val]);
            return f;
          },
          in(col: string, vals: unknown[]) {
            ins.push([col, vals]);
            return f;
          },
          then<R>(fn: (v: { error: null }) => R) {
            for (const row of rows) {
              if (
                filters.every(([col, val]) => row[col] === val) &&
                ins.every(([col, vals]) => vals.includes(row[col]))
              ) {
                Object.assign(row, patch);
                writes.push(`update ${name} ${JSON.stringify(patch)}`);
              }
            }
            return Promise.resolve(fn({ error: null }));
          },
        };
        return f;
      },
    };
  }

  return {
    db: { from: table } as unknown as JournalDb,
    runs,
    results,
    writes,
  };
}

const KIT = "kit-1";
const MONTH = "2027-07-01";

describe("le journal en base", () => {
  let world: ReturnType<typeof fakeDb>;
  beforeEach(() => {
    world = fakeDb();
  });

  it("refuse un mois qui n'est pas un premier — la base le refuserait aussi", async () => {
    await expect(findResumableRun(world.db, KIT, "2027-07-15")).rejects.toThrow(JournalError);
  });

  it("ouvre la ligne du mois, puis rend la même sans en créer une seconde", async () => {
    const first = await openRun(world.db, KIT, MONTH);
    expect(first.created).toBe(true);
    const second = await openRun(world.db, KIT, MONTH);
    expect(second.created, "une seconde ligne : le mois serait payé deux fois").toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(world.runs).toHaveLength(1);
  });

  /*
   * ⚠ L'IDENTIFIANT ET LA LISTE, DANS LE MÊME GESTE. C'est le défaut du
   * 2026-09-23 : un `batch_id` seul a fait rattacher un lot payé à un tirage
   * refait.
   */
  it("écrit une ligne par sujet avec l'identifiant du lot", async () => {
    const { runId } = await openRun(world.db, KIT, MONTH);
    await rememberBatch(world.db, runId, "batch-abc", ["t1", "t2", "t3"]);
    expect(world.runs[0].batch_id).toBe("batch-abc");
    expect(world.results).toHaveLength(3);
    expect(world.results.every((r) => r.result === null)).toBe(true);
  });

  it("refuse de retenir un lot sans sujets", async () => {
    const { runId } = await openRun(world.db, KIT, MONTH);
    await expect(rememberBatch(world.db, runId, "batch-abc", [])).rejects.toThrow(/cannot be resumed/);
  });

  it("un résultat qui arrive n'est pas pour autant soldé", async () => {
    const { runId } = await openRun(world.db, KIT, MONTH);
    await rememberBatch(world.db, runId, "batch-abc", ["t1"]);
    await rememberResult(world.db, runId, "t1", {
      result: { line: "a" },
      usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0 },
    });
    expect(world.results[0].result).toEqual({ line: "a" });
    expect(world.results[0].settled, "arrivé n'est pas payé").toBe(false);
  });
});

/*
 * ── ⚠ LA PANNE, POSÉE À LA MAIN ─────────────────────────────────────────
 *
 * Trois sujets. `t1` est arrivé et soldé, `t2` est arrivé et pas soldé, `t3`
 * n'est jamais arrivé. C'est exactement ce qu'une panne au milieu d'un lot
 * laisse, et c'est la seule forme qui distingue les trois décisions.
 */
describe("la reprise après une panne", () => {
  function crashed() {
    const world = fakeDb();
    world.runs.push({
      id: "run-1",
      brand_kit_id: KIT,
      month: MONTH,
      batch_id: "batch-abc",
      state: "submitted",
      cost_usd: 0.37,
    });
    world.results.push(
      { id: "r1", run_id: "run-1", topic_id: "t1", result: { line: "un" }, usage: { input: 9 }, settled: true },
      { id: "r2", run_id: "run-1", topic_id: "t2", result: { line: "deux" }, usage: { input: 8 }, settled: false },
      { id: "r3", run_id: "run-1", topic_id: "t3", result: null, usage: {}, settled: false }
    );
    world.writes.length = 0;
    return world;
  }

  it("rattache le lot déjà payé au lieu d'en créer un autre", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    expect(journal).not.toBeNull();
    expect(journal!.batchId, "un lot resoumis, c'est le mois repayé").toBe("batch-abc");
    expect(journal!.runId).toBe("run-1");
    expect(
      world.writes,
      `la reprise a écrit alors qu'elle ne faisait que lire : ${world.writes.join(" | ")}`
    ).toEqual([]);
  });

  it("retrouve la liste des sujets du lot, réponse arrivée ou non", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    expect(journal!.topicIds).toEqual(["t1", "t2", "t3"]);
    expect(
      Object.keys(journal!.entries).sort(),
      "un sujet sans réponse ne doit pas paraître répondu"
    ).toEqual(["t1", "t2"]);
  });

  it("garde le coût déjà engagé au lieu de le recalculer", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    expect(journal!.costUsd).toBe(0.37);
  });

  /*
   * ⚠ LES TROIS DÉCISIONS, ET C'EST LE CŒUR. Confondre `toSettle` et `done`
   * redébite ; confondre `toWrite` et `toSettle` repaie le fournisseur.
   */
  it("ne fait réécrire que ce qui manque, et ne fait resolder que ce qui n'est pas soldé", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    const plan = resumePlan(journal!);
    expect(plan.toWrite, "t3 est le seul sans réponse").toEqual(["t3"]);
    expect(plan.toSettle, "t2 est payé au fournisseur, pas encore décompté").toEqual(["t2"]);
    expect(plan.done, "t1 est fini : le retoucher redébiterait").toEqual(["t1"]);
  });

  it("un sujet déjà soldé ne repasse jamais par le règlement", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    const plan = resumePlan(journal!);
    await markSettled(world.db, journal!.runId, plan.toSettle);
    /* t1 était déjà à true, il ne doit pas avoir été réécrit. */
    const settles = world.writes.filter((w) => w.includes('"settled":true'));
    expect(settles.length, "un seul geste de règlement pour un seul sujet dû").toBe(1);
    expect(plan.done).not.toContain("t2");
  });

  /*
   * ⚠ ET LE SUJET JAMAIS ÉCRIT RESTE NON SOLDÉ. C'est ce test qui a trouvé le
   * défaut : `markSettled` filtrait sur le seul `run_id` et marquait payés les
   * trois sujets du lot. Un sujet jamais écrit passant pour payé, c'est un post
   * acheté que plus rien ne réclame.
   */
  it("un sujet sans réponse n'est jamais marqué payé", async () => {
    const world = crashed();
    const journal = await findResumableRun(world.db, KIT, MONTH);
    await markSettled(world.db, journal!.runId, resumePlan(journal!).toSettle);
    const t3 = world.results.find((r) => r.topic_id === "t3")!;
    expect(t3.result, "t3 n'a toujours pas de réponse").toBeNull();
    expect(t3.settled, "t3 n'a rien coûté au quota : le marquer payé perd un post acheté").toBe(false);
    const t2 = world.results.find((r) => r.topic_id === "t2")!;
    expect(t2.settled, "t2 était dû").toBe(true);
  });

  it("aucun règlement du tout quand rien n'est dû", async () => {
    const world = crashed();
    await markSettled(world.db, "run-1", []);
    expect(world.writes).toEqual([]);
  });

  /*
   * ⚠ UN MOIS PUBLIÉ NE SE REPREND PAS. Le reprendre écrirait trente posts une
   * seconde fois ; un mois abandonné a dépassé les vingt-neuf jours où le lot
   * reste lisible, et faire croire à une reprise coûterait un aller-retour pour
   * apprendre que le travail est perdu.
   */
  it.each(["published", "abandoned"])("un mois %s n'est pas reprenable", async (state) => {
    const world = crashed();
    world.runs[0].state = state;
    expect(await findResumableRun(world.db, KIT, MONTH)).toBeNull();
  });

  it("rien à reprendre quand aucune ligne n'existe", async () => {
    const world = fakeDb();
    expect(await findResumableRun(world.db, KIT, MONTH)).toBeNull();
  });

  /*
   * ⚠ ET LA LIGNE N'EST PAS SUPPRIMÉE À LA PUBLICATION. Ce que le mois a coûté
   * est la seule mesure du prix réel d'un mois livré — le chiffre sur lequel se
   * décide si l'abonnement à 39 $ tient.
   */
  it("la publication ferme la ligne et garde le coût", async () => {
    const world = crashed();
    await publishRun(world.db, "run-1", 0.574);
    expect(world.runs).toHaveLength(1);
    expect(world.runs[0].state).toBe("published");
    expect(world.runs[0].cost_usd).toBe(0.574);
    expect(world.runs[0].closed_at).toBeTruthy();
  });

  it("le coût s'écrit en cours de route, pas seulement à la fin", async () => {
    const world = crashed();
    await rememberCost(world.db, "run-1", 0.41, "collected");
    expect(world.runs[0].cost_usd).toBe(0.41);
    expect(world.runs[0].state).toBe("collected");
  });
});
