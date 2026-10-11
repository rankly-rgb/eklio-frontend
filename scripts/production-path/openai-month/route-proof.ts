/*
 * ── LA ROUTE DE CRON, APPELÉE POUR DE VRAI, CONTRE LA PILE SUPABASE LOCALE ──
 *
 * ⚠ ÉTIQUETTE — CE QUI EST LE PRODUIT : le handler `GET` de
 * `app/api/cron/content-month/route.ts`, tel quel ; `createAdminClient` (le client
 * supabase-js de production) parlant au vrai PostgREST de la pile locale ;
 * `selectDueMonths`, `orchestrateMonthForKit`, l'orchestrateur et tous ses ports ;
 * le transport OpenAI du produit.
 * ⚠ CE QUI NE L'EST PAS : l'appelant (ce script, à la place de Vercel), la base
 * (locale, migrée depuis zéro), le compte et la banque (posés par le harnais),
 * l'abonnement (posé à la main, comme l'achat le poserait).
 *
 * La route borne chaque mois par son propre compteur ; le coût qu'elle rend est
 * inscrit au journal de session, pour que le plafond de 8 $ compte ce qu'elle a
 * dépensé.
 *
 *   EKLIO_OPENAI_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… bun …/route-proof.ts --out route-run.json --confirm
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { arg, confirmOrDie, SPEND_LOG, spentSoFar, SESSION_CAP_USD } from "./session";
import { MONTH_CAP_USD } from "@/lib/content/month/run-for-kit";

confirmOrDie("la preuve de la route");
const OUT = arg("--out") ?? "route-run.json";
if (!process.env.EKLIO_OPENAI_API_KEY) throw new Error("EKLIO_OPENAI_API_KEY absente — rien n'a été appelé");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY (pile locale) absente");
/* ⚠ La route ne doit pas pouvoir dépasser le plafond de session, même au pire de chaque mois. */
if (spentSoFar() + MONTH_CAP_USD > SESSION_CAP_USD) throw new Error("plafond de session : pas de place pour un mois au pire");

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.OPENAI_API_KEY = process.env.EKLIO_OPENAI_API_KEY;
process.env.CONTENT_GENERATION_ARMED = "true";
process.env.CRON_SECRET = "route-proof-local";

const { GET } = await import("@/app/api/cron/content-month/route");
const startedAt = new Date().toISOString();
const response = await GET(
  new Request("http://localhost/api/cron/content-month", { headers: { authorization: "Bearer route-proof-local" } })
);
const body = (await response.json()) as { served?: Array<{ costUsd: number; brandKitId: string }> };
for (const s of body.served ?? []) {
  appendFileSync(SPEND_LOG, JSON.stringify({ at: new Date().toISOString(), label: `route content-month ${s.brandKitId}`, usd: s.costUsd, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }) + "\n");
}
const report = { label: "route de cron produit, pile Supabase locale (PostgREST), OpenAI", startedAt, finishedAt: new Date().toISOString(), status: response.status, body };
writeFileSync(`design/production-first-month/${OUT}`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
