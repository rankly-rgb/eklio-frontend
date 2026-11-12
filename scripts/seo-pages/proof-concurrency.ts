/*
 * ══════════════════════════════════════════════════════════════════════════
 *  PREUVES DU CRON PARALLÈLE SUR LA VRAIE BASE LOCALE — RÉDACTEUR FIXTURE, 0 $
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ HARNAIS. Ce qui est le PRODUIT : `runSeoMonthForUser` et tout ce qui est en
 * dessous (contexte, reprise, plan, `claim_seo_slot`, livre, contrôles, triggers).
 * Ce qui ne l'est PAS : le rédacteur, une FIXTURE qui n'appelle aucun modèle et
 * coûte 0 $ (le livre réserve, puis règle 0). Ses textes n'ont aucun sens : ils
 * finissent souvent en quarantaine, ce qui n'importe pas ici — on compte les
 * emplacements, les pièces et les cibles.
 *
 *   bun scripts/seo-pages/proof-concurrency.ts concurrent <user> <month>
 *   bun scripts/seo-pages/proof-concurrency.ts interrupt  <user> <month>
 *   (interne) bun scripts/seo-pages/proof-concurrency.ts hang <user> <month>
 */
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
const [mode, userId, month] = process.argv.slice(2);
if (!mode || !userId || !month) throw new Error("usage: concurrent|interrupt <user> <month>");

const { createAdminClient } = await import("@/lib/supabase/server");
const { runSeoMonthForUser } = await import("@/lib/seo/server-ports");
const { fixtureOutput } = await import("@/lib/seo/__tests__/fixture-output");
type Writer = Parameters<typeof runSeoMonthForUser>[1]["writer"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seed = Math.floor(Math.random() * 1e6);
function fixtureWriter(latencyMs: number): Writer {
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  return {
    model: "fixture-no-model",
    worstCaseUsd: () => 0.01,
    worstCaseRepairUsd: () => 0.01,
    async write(req) {
      await sleep(latencyMs);
      const output = fixtureOutput({ query: req.brief.primaryQuery, seed: seed++, bodyWords: req.brief.kind === "local_page" ? 900 : 1300 });
      return { output, problem: null, model: "fixture-no-model", costUsd: 0, usage };
    },
    async repairField() {
      return { value: null, model: "fixture-no-model", costUsd: 0, usage };
    },
  };
}

function sql(q: string): string {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-d", "eklio_local_verify", "-At", "-F", " ", "-c", q], { encoding: "utf8" }).trim();
}
function state(label: string) {
  const claims = sql(`select status, count(*) from seo_slot_claims where user_id='${userId}' and month='${month}' group by 1 order by 1`);
  const pieces = sql(`select status, count(*) from seo_pieces where user_id='${userId}' and month='${month}' group by 1 order by 1`);
  const dupTargets = sql(`select count(*) from (select target_id from seo_pieces where user_id='${userId}' group by 1 having count(*) > 1) d`);
  const assignedNoPiece = sql(
    `select count(*) from seo_targets t where t.user_id='${userId}' and t.status='assigned' and t.assigned_month='${month}' and not exists (select 1 from seo_pieces p where p.target_id=t.id)`
  );
  const live = sql(`select count(*) from seo_pieces where user_id='${userId}' and month='${month}' and status <> 'quarantined'`);
  const used = sql(`select kind, count(*) from seo_slot_claims where user_id='${userId}' and month='${month}' and status='used' group by 1 order by 1`);
  console.log(JSON.stringify({ label, claims: claims.split("\n").filter(Boolean), used: used.split("\n").filter(Boolean), pieces: pieces.split("\n").filter(Boolean), livePieces: Number(live), duplicateTargets: Number(dupTargets), assignedWithoutPiece: Number(assignedNoPiece) }));
  return { live: Number(live), dup: Number(dupTargets), orphan: Number(assignedNoPiece) };
}
const summary = (o: Awaited<ReturnType<typeof runSeoMonthForUser>>) =>
  o.ok
    ? { ok: true, recovery: o.recovery, pieces: o.month.pieces.map((p) => `${p.kind}:${p.status}${p.detail ? `(${p.detail})` : ""}`) }
    : { ok: false, stage: o.stage, ...(o.stage === "busy" ? { recovery: o.recovery } : {}) };

if (mode === "hang") {
  // L'exécution qu'on va couper : ses premiers jets « durent » dix minutes.
  await runSeoMonthForUser(createAdminClient(), { userId, month, runId: randomUUID(), writer: fixtureWriter(600_000) });
  process.exit(0);
}

if (mode === "concurrent") {
  state("before");
  const t0 = Date.now();
  const [a, b] = await Promise.all([
    runSeoMonthForUser(createAdminClient(), { userId, month, runId: randomUUID(), writer: fixtureWriter(1500) }),
    runSeoMonthForUser(createAdminClient(), { userId, month, runId: randomUUID(), writer: fixtureWriter(1500) }),
  ]);
  console.log(JSON.stringify({ elapsedMs: Date.now() - t0, runA: summary(a), runB: summary(b) }));
  const s = state("after two simultaneous runs");
  const ok = s.live <= 3 && s.dup === 0 && s.orphan === 0;
  console.log(ok ? "PROOF OK: no 4th piece, no duplicate target, no orphan target" : "PROOF FAILED");
  process.exit(ok ? 0 : 1);
}

if (mode === "interrupt") {
  state("before");
  const child = spawn("bun", [process.argv[1], "hang", userId, month], { stdio: "inherit", env: process.env });
  // On attend que l'exécution ait pris ses emplacements et soit au milieu de ses appels.
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    if (Number(sql(`select count(*) from seo_slot_claims where user_id='${userId}' and month='${month}' and status='claimed'`)) > 0) break;
  }
  await sleep(1500);
  child.kill("SIGKILL");
  await sleep(500);
  state("after SIGKILL mid-run");

  const immediate = await runSeoMonthForUser(createAdminClient(), { userId, month, runId: randomUUID(), writer: fixtureWriter(200) });
  console.log(JSON.stringify({ step: "next call right away (claims younger than SEO_STALE_CLAIM_MS)", outcome: summary(immediate) }));
  state("after the immediate call");

  // Le déclenchement suivant, plus de dix minutes après : `staleMs: 0` le simule, la base reste la vraie.
  const later = await runSeoMonthForUser(createAdminClient(), { userId, month, runId: randomUUID(), writer: fixtureWriter(200), staleMs: 0 });
  console.log(JSON.stringify({ step: "next call once the claims are stale", outcome: summary(later) }));
  const s = state("after resume");
  const ok = s.live <= 3 && s.dup === 0 && s.orphan === 0;
  console.log(ok ? "PROOF OK: resumed, no duplicate, no orphan target, no slot left claimed" : "PROOF FAILED");
  process.exit(ok ? 0 : 1);
}
