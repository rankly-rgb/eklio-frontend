/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE MOIS SEO, PAR LE VRAI CHEMIN PRODUIT, CONTRE LA PILE LOCALE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE — CE QUI EST LE PRODUIT : le handler `GET` de
 * `app/api/cron/seo-pages/route.ts`, tel quel ; `createAdminClient` parlant au vrai
 * PostgREST de la façade locale ; `seo_quota_for`, `claim_seo_slot`,
 * `reserve_credit`/`settle_credit`, le rédacteur OpenAI, les contrôles, les
 * triggers de `seo_pieces`.
 * ⚠ CE QUI NE L'EST PAS : l'appelant (ce script, à la place de Vercel), la base
 * (locale, migrée depuis zéro), les comptes (`*-kit.sql`), les abonnements (posés
 * à la main, comme le webhook les poserait), et le garde de session (`session.ts`).
 *
 * ⚠ LE DRAPEAU N'EST ARMÉ QUE DANS CE PROCESSUS.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… EKLIO_OPENAI_API_KEY=… bun scripts/seo-pages/run-month.ts \
 *     --confirm --since <début de session> --out <fichier>
 */
import { writeFileSync } from "node:fs";
import { arg, prepareSession, spentSince } from "./session";

const { since, before } = await prepareSession();
const OUT = arg("--out");

process.env.SEO_GENERATION_ARMED = "true";
process.env.CRON_SECRET = "seo-local-run";

const { GET } = await import("@/app/api/cron/seo-pages/route");
const startedAt = new Date().toISOString();
const response = await GET(new Request("http://localhost/api/cron/seo-pages", { headers: { authorization: "Bearer seo-local-run" } }));
const body = await response.json();
const after = await spentSince(since);

const report = { label: "REAL PRODUCT PATH — local database", startedAt, status: response.status, spentBeforeUsd: before, spentAfterUsd: after.usd, body };
console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
