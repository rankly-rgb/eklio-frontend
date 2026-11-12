/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE MOIS SEO, PAR LE VRAI CHEMIN PRODUIT, CONTRE LA PILE LOCALE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE — CE QUI EST LE PRODUIT : le handler `GET` de
 * `app/api/cron/seo-pages/route.ts`, tel quel ; `createAdminClient` (le client
 * supabase-js de production) parlant au vrai PostgREST de la façade locale
 * (`scripts/local-render/edge/up.sh`) ; `seo_quota_for`, `claim_seo_slot`,
 * `reserve_credit`/`settle_credit`, le rédacteur OpenAI, les contrôles, les
 * triggers de `seo_pieces`.
 * ⚠ CE QUI NE L'EST PAS : l'appelant (ce script, à la place de Vercel), la base
 * (locale, migrée depuis zéro), le compte (`00-kit.sql`), l'abonnement (posé à la
 * main, comme le webhook le poserait).
 *
 * ⚠ LE DRAPEAU N'EST ARMÉ QUE DANS CE PROCESSUS. `SEO_GENERATION_ARMED=true` est
 * posé ici, en mémoire, après les gardes. Aucun fichier d'environnement, aucun
 * déploiement ne le porte.
 *
 *   set -a; . <edge>/keys.env; set +a
 *   SUPABASE_SERVICE_ROLE_KEY=$SERVICE EKLIO_OPENAI_API_KEY=… bun scripts/seo-pages/run-month.ts --confirm --out <fichier>
 */
import { writeFileSync } from "node:fs";

const SESSION_STOP_USD = 2.5;
const LOCAL = "http://127.0.0.1:54321";

if (!process.argv.includes("--confirm")) throw new Error("--confirm manquant : ce script dépense de l'argent réel");
const outIndex = process.argv.indexOf("--out");
const OUT = outIndex === -1 ? null : process.argv[outIndex + 1];
if (!process.env.EKLIO_OPENAI_API_KEY) throw new Error("EKLIO_OPENAI_API_KEY absente — rien n'a été appelé");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY (façade locale) absente");

/* ── ⚠ LE PLAFOND DE SESSION, LU DANS LE JOURNAL DE COÛTS ────────────── */
/* `credit_ledger`, lu par la façade avec la clé service LOCALE : les règlements des appels SEO.
   ⚠ `settle_credit` écrit la raison « settled: <raison> » — filtrer sur la raison de la
   réservation rendait 0 $ (premier passage, 2026-11-12). */
async function spentSoFar(): Promise<number> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${LOCAL}/rest/v1/credit_ledger?select=actual_cost_usd&reason=eq.settled:%20seo_piece_write&entry_type=eq.settlement`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`credit_ledger: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ actual_cost_usd: number | null }>;
  return rows.reduce((sum, r) => sum + Number(r.actual_cost_usd ?? 0), 0);
}
const before = await spentSoFar();
const { SEO_MONTH_CAP_USD } = await import("@/lib/seo/kinds");
if (before + SEO_MONTH_CAP_USD > SESSION_STOP_USD) {
  throw new Error(`plafond de session : ${before.toFixed(4)} $ déjà au journal + ${SEO_MONTH_CAP_USD} $ au pire > ${SESSION_STOP_USD} $`);
}

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL;
process.env.OPENAI_API_KEY = process.env.EKLIO_OPENAI_API_KEY;
process.env.SEO_GENERATION_ARMED = "true";
process.env.CRON_SECRET = "seo-local-run";

const { GET } = await import("@/app/api/cron/seo-pages/route");
const startedAt = new Date().toISOString();
const response = await GET(new Request("http://localhost/api/cron/seo-pages", { headers: { authorization: "Bearer seo-local-run" } }));
const body = await response.json();
const after = await spentSoFar();

const report = { label: "REAL PRODUCT PATH — local database", startedAt, status: response.status, spentBeforeUsd: before, spentAfterUsd: after, body };
console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
