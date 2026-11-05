/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA PRODUCTION D'UN MOIS POUR UNE FICHE (2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   bun scripts/production-path/eklio-ops/month.ts --kit <id> [--month 2027-01-01]            simulation
 *   bun scripts/production-path/eklio-ops/month.ts --kit <id> [--month 2027-01-01] --write    écriture
 *
 * ⚠ LE MÊME CHEMIN QUE LA ROUTE ARMÉE (`app/api/cron/content-month/route.ts`) :
 * `selectDueMonths`, puis `orchestrateMonthForKit` avec `openAiTransport` et
 * `spendMeter(MONTH_CAP_USD)`, sur le même client service. Il en diffère en
 * QUATRE points, et seulement ceux-là :
 *   1. une seule fiche, nommée (`--kit`), au lieu de toutes les fiches dues ;
 *   2. le mois est donné (`--month`) au lieu d'être le mois suivant ;
 *   3. `--write` remplace `CONTENT_GENERATION_ARMED` comme interrupteur ;
 *   4. pas de budget de démarrage de 30 s : une seule fiche, pas de report.
 */
import { POSTS_PER_MONTH } from "../../../lib/content/bank";
import { openAiTransport, spendMeter } from "../../../lib/content/generate/openai";
import { nextMonthKey } from "../../../lib/content/generate/queue";
import { selectDueMonths } from "../../../lib/content/month/due";
import { MONTH_CAP_USD, orchestrateMonthForKit } from "../../../lib/content/month/run-for-kit";
import { serverDuePort } from "../../../lib/content/month/server-ports";
import { licenceMentionFor } from "../../../lib/content/review";
import { bankFloors, flag, option, production, refuse, requireEnv, requireKit, requireMigrations, table } from "./common";
import { measureMonth } from "./measure";

const write = flag("--write");
const db = production();
await requireMigrations(db);
const kit = await requireKit(db, option("--kit"));
const month = option("--month") ?? nextMonthKey(new Date());
const key = write ? requireEnv(["OPENAI_API_KEY"]).OPENAI_API_KEY : null;

/* ── Le contrôle préalable : tout ce qui ferait partir un mois pour rien ── */
const { data: existing } = await db.from("content_months").select("id, status").eq("brand_kit_id", kit.id).eq("month", month).maybeSingle();
/*
 * Un mois LIVRÉ (`proposed`, `approved`) ne se refait pas. Un mois `failed` se
 * retente ; un mois `generating` est un run interrompu, que l'orchestrateur
 * reprend par son journal sans repayer ce qui a été écrit.
 */
if (existing && (existing.status === "proposed" || existing.status === "approved")) refuse(`le mois ${month} est déjà livré pour ce kit (statut ${existing.status})`);
if (existing?.status === "generating") console.log(`  ⚠ un run de ${month} est resté en cours : il sera REPRIS par son journal (ne lancez pas deux fois en même temps).`);
const licence = await licenceMentionFor(db as never, kit.project_id);
if (!licence) refuse("la fiche n'a pas de mention de licence : aucune carte ne peut être publiée sans elle");
const floors = await bankFloors(db, kit.id);
if (floors.failing.length) refuse(`le banc de ce kit ne porte pas un mois : ${floors.failing.join(" ; ")} — lancer bank-fill.ts d'abord`);
const { due, skipped } = await selectDueMonths(serverDuePort(db as never), { month, posts: POSTS_PER_MONTH });
const account = due.find((a) => a.brandKitId === kit.id);
if (!account) {
  const why = (skipped as Array<{ brandKitId?: string; reason?: string }>).find((s) => s.brandKitId === kit.id)?.reason ?? "non listé parmi les comptes dus";
  refuse(`le kit n'est pas dû pour ${month} : ${why}`);
}

console.log(`\nPRODUCTION D'UN MOIS — kit ${kit.id} — ${month} — ${write ? "ÉCRITURE" : "SIMULATION (rien ne sera écrit ni dépensé)"}`);
console.log(`  mention de licence : ${licence} · banc : ${floors.total} tirables, marge de posts à phrase +${floors.margin}`);
console.log(`  plafond de dépense du mois : ${MONTH_CAP_USD} $ (un mois coûte ~0,70 $ mesuré en répétition)\n`);
console.log("  Ce que l'écriture fera, table par table :");
table([
  { table: "topic_assignments", "lignes": "~57", "quoi": "les sujets tirés pour le mois (relâchés si le mois est refusé)" },
  { table: "content_generation_runs", "lignes": "1", "quoi": "le journal du run, son coût" },
  { table: "content_generation_results", "lignes": "~57", "quoi": "une réponse du modèle par sujet tiré" },
  { table: "content_months", "lignes": "1", "quoi": "le mois, publié ou refusé" },
  { table: "content_items", "lignes": "30", "quoi": "les publications, avec dessin et fond" },
  { table: "credit_ledger", "lignes": "~60", "quoi": "réservation puis règlement d'un crédit par post" },
  { table: "Storage (cartes)", "lignes": "30", "quoi": "une carte PNG par publication" },
]);
if (!write) {
  console.log(`\n  SIMULATION : aucun appel au modèle, aucune écriture. Relancer avec --write.\n`);
  process.exit(0);
}

const outcome = await orchestrateMonthForKit(db as never, account!, month, { transport: openAiTransport(key!), meter: spendMeter(MONTH_CAP_USD) });
console.log(`\n  COÛT MESURÉ : ${outcome.costUsd.toFixed(4)} $`);
if (!outcome.ok) {
  console.log(`  ✗ MOIS REFUSÉ — étape ${outcome.stage} : ${outcome.refusal}`);
  console.log(`  État laissé : le run est « abandoned », le mois « failed », les sujets relâchés ; aucune publication n'est visible. Voir RUNBOOK.md.\n`);
  process.exit(1);
}

const out = option("--out") ?? `planche-${kit.id.slice(0, 8)}-${month}`;
const m = await measureMonth(db, kit.id, month, out);
const pass = (ok: boolean) => (ok ? "✓" : "✗");
console.log("\n  ACCEPTATION");
table([
  { critère: "Publications écrites", attendu: "30", mesuré: String(outcome.month.written), "": pass(outcome.month.written === 30) },
  { critère: "Cartes stockées", attendu: "30", mesuré: String(outcome.cards.stored), "": pass(outcome.cards.stored === 30) },
  { critère: "Cartes vides", attendu: "0", mesuré: String(m.metrics.emptyCards), "": pass(m.metrics.emptyCards === 0) },
  { critère: "Ligne de licence ≥ 4,5:1", attendu: "30/30", mesuré: `${m.metrics.licenceLegible} (pire ${m.metrics.worstLicence})`, "": pass(m.metrics.licenceLegible === "30/30") },
  { critère: "Contrôles déontologiques", attendu: "tous verts", mesuré: outcome.ok ? "verts (le mois ne sort pas autrement)" : "—", "": pass(outcome.ok) },
  { critère: "Cartes sous le plancher de remplissage", attendu: "0", mesuré: String(m.metrics.underFillFloor.length), "": pass(m.metrics.underFillFloor.length === 0) },
  { critère: "Formats distincts par fenêtre de neuf", attendu: "3 partout", mesuré: `min ${m.metrics.formatsPerWindow.min}`, "": pass(m.metrics.formatsPerWindow.min === 3) },
  { critère: "Plus longue série d'un format", attendu: "≤ 3", mesuré: String(m.metrics.longestFormatRun), "": pass(m.metrics.longestFormatRun <= 3) },
  { critère: "Coût du mois", attendu: "< 1 $", mesuré: `${outcome.costUsd.toFixed(4)} $`, "": pass(outcome.costUsd < 1) },
]);
console.log(`\n  Entonnoir : ${JSON.stringify(outcome.month.funnel)}`);
console.log(`  Planche à 390 px (chemin de production, données de cette fiche) : ${m.sheet}\n`);
