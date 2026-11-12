/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN MOIS SEO POUR UNE ABONNÉE ET UN MOIS DONNÉS — LE MÊME CHEMIN QUE LA ROUTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE — CE QUI EST LE PRODUIT : `runSeoMonthForUser` (que la route appelle
 * pour chaque abonnée), le rédacteur OpenAI du produit avec le plafond du produit
 * (`SEO_MONTH_CAP_USD`), et tout ce qui est en dessous : contexte, plan,
 * `claim_seo_slot`, livre, contrôles, triggers.
 * ⚠ CE QUI N'EST PAS LA ROUTE : le choix du MOIS et de l'ABONNÉE. La route prend
 * toujours le mois suivant et toutes les abonnées ; ce script en prend une, et le
 * mois qu'on lui donne — que la BASE accepte ou refuse (`seo_month_entitled`).
 *
 *   … bun scripts/seo-pages/run-user-month.ts --confirm --since <…> --user <uuid> --month 2026-11-01 --out <fichier>
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { arg, prepareSession, spentSince } from "./session";

const { since, before } = await prepareSession();
const userId = arg("--user");
const month = arg("--month");
if (!userId || !month) throw new Error("--user et --month requis");

const { createAdminClient } = await import("@/lib/supabase/server");
const { openAiTransport, spendMeter } = await import("@/lib/content/generate/openai");
const { SEO_MONTH_CAP_USD } = await import("@/lib/seo/kinds");
const { openAiSeoWriter } = await import("@/lib/seo/writer");
const { runSeoMonthForUser } = await import("@/lib/seo/server-ports");

const meter = spendMeter(SEO_MONTH_CAP_USD);
const outcome = await runSeoMonthForUser(createAdminClient(), {
  userId,
  month,
  runId: randomUUID(),
  writer: openAiSeoWriter({ transport: openAiTransport(process.env.OPENAI_API_KEY!), meter }),
});
const after = await spentSince(since);
const report = { label: "REAL PRODUCT PATH (runSeoMonthForUser) — local database", userId, month, spentBeforeUsd: before, spentAfterUsd: after.usd, outcome };
console.log(JSON.stringify(report, null, 2));
const OUT = arg("--out");
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
