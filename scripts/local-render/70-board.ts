/*
 * Les visuels du mois, par la route du produit, puis les deux planches.
 *
 * ⚠ CHAQUE PNG EST DEMANDÉ À `GET /api/content-items/[id]/image`, la route que
 * le bouton de téléchargement appelle. Recomposer ici donnerait une planche
 * qui prouve que ce script sait dessiner, pas que le produit sait livrer.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { admin, accountFor, MONTH } from "./lib";

const BASE = "http://127.0.0.1:3000";
const CHROMIUM = "/opt/pw-browsers/chromium";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  const out = arg("out") ?? "design/preview-2026-09-21b";
  const email = arg("email");
  const db = admin();
  const { kitId } = await accountFor(db, email);
  await mkdir(out, { recursive: true });

  const { data: month } = await db
    .from("content_months").select("id").eq("brand_kit_id", kitId).eq("month", MONTH).single();
  const { data: items } = await db
    .from("content_items").select("id, title, compose_archetype, scheduled_for")
    .eq("month_id", month!.id).order("scheduled_for", { ascending: true });

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email ?? "");
  await page.fill('input[type="password"]', "local-harness-only");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");

  const shots: Array<{ src: string; label: string }> = [];
  const refused: Array<{ title: string; archetype: string | null; because: string }> = [];

  for (const item of items ?? []) {
    const response = await page.request.get(`${BASE}/api/content-items/${item.id}/image`);
    if (!response.ok()) {
      refused.push({
        title: item.title ?? "(untitled)", archetype: item.compose_archetype,
        because: (await response.text()).slice(0, 160),
      });
      continue;
    }
    shots.push({
      src: `data:image/png;base64,${Buffer.from(await response.body()).toString("base64")}`,
      label: `${shots.length + 1} · ${item.compose_archetype}`,
    });
  }

  const board = (cardWidth: number) => `<!doctype html><meta charset="utf-8">
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; background: #f7f5f1; font: 12px/1.4 ui-monospace, monospace; color: #3a352f; }
  h1 { font: 500 16px/1.3 ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 24px; }
  ol { display: flex; flex-wrap: wrap; gap: 24px; list-style: none; margin: 0; padding: 0; }
  li { width: ${cardWidth}px; }
  img { display: block; width: 100%; height: auto; border: 1px solid #ddd6cc; }
  figcaption { margin-top: 6px; opacity: .65; }
</style>
<h1>${shots.length} visuals — real path, local base, test account — card width ${cardWidth}px</h1>
<ol>${shots.map((s) => `<li><img src="${s.src}" alt=""><figcaption>${s.label}</figcaption></li>`).join("")}</ol>`;

  for (const [name, cardWidth, viewport] of [
    ["01-thirty-visuals-1080x1350", 1080, 3480],
    ["02-thirty-visuals-at-350", 350, 1440],
  ] as const) {
    const file = `/tmp/board-${cardWidth}-b.html`;
    await writeFile(file, board(cardWidth), "utf8");
    const boardPage = await context.newPage();
    await boardPage.setViewportSize({ width: viewport, height: 1200 });
    await boardPage.goto(`file://${file}`, { waitUntil: "load" });
    await boardPage.waitForTimeout(1200);
    await boardPage.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await boardPage.close();
  }

  console.log(JSON.stringify({
    step: "board", out, month: MONTH, items: items?.length ?? 0,
    visuals: shots.length, refused,
  }, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
