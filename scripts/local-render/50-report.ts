/*
 * Ce que le moteur a répondu, carte par carte, et ce que la caisse a gardé.
 *
 * ⚠ PAR LA ROUTE DU PRODUIT, PAS PAR UNE RECOMPOSITION. `GET
 * /api/content-items/[id]/image` compose et rend le PNG ; quand ça ne tient
 * pas, elle répond 409 `does_not_compose` avec le message du moteur. C'est
 * cette réponse-là qui est le verdict, et la lire évite d'écrire un second
 * assembleur qui pourrait être d'accord avec lui-même.
 *
 * Rien ici n'appelle un modèle. Le coût est lu dans `credit_ledger`.
 */
import { chromium } from "@playwright/test";
import { admin, testKit, TEST_EMAIL } from "./lib";

const BASE = "http://127.0.0.1:3000";
const CHROMIUM = "/opt/pw-browsers/chromium";

async function main() {
  const db = admin();
  const { userId, kitId } = await testKit(db);

  const { data: month } = await db
    .from("content_months")
    .select("id, month, themes, status, theme_source")
    .eq("brand_kit_id", kitId)
    .maybeSingle();

  const { data: items } = await db
    .from("content_items")
    .select("id, title, compose_archetype, register, caption, scheduled_for")
    .eq("brand_kit_id", kitId)
    .order("scheduled_for", { ascending: true });

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', "local-harness-only");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");

  const composed: string[] = [];
  const refused: Array<{ item: string; archetype: string | null; because: string }> = [];

  for (const item of items ?? []) {
    if (!(item.caption ?? "").trim()) continue;
    const response = await page.request.get(`${BASE}/api/content-items/${item.id}/image`);
    if (response.ok()) {
      composed.push(item.id);
      continue;
    }
    const body = await response.text();
    refused.push({
      item: item.title ?? "(untitled)",
      archetype: item.compose_archetype,
      because: body.slice(0, 220),
    });
  }
  await browser.close();

  const { data: ledger } = await db
    .from("credit_ledger")
    .select("kind, reason, estimated_cost_usd, actual_cost_usd")
    .eq("user_id", userId);

  const money = (ledger ?? []).reduce((total, row) => total + Number(row.actual_cost_usd ?? 0), 0);

  console.log(JSON.stringify({
    step: "report",
    month: month ? { month: month.month, status: month.status, themeSource: month.theme_source, themes: month.themes } : null,
    written: (items ?? []).filter((i) => (i.caption ?? "").trim()).length,
    composed: composed.length,
    refusedByTheEngine: refused,
    ledgerRows: ledger?.length ?? 0,
    ledgerActualCostUsd: Number(money.toFixed(6)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
