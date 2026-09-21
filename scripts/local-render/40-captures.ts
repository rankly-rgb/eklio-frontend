/*
 * Les captures, à 1440 px, sur la base locale et le compte de test.
 *
 * Tout ce qui est photographié ici est servi par `next dev` contre la base
 * rejouée : aucune maquette, aucun double, aucun texte écrit à la main.
 *
 *   npx tsx scripts/local-render/40-captures.ts
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { admin, testKit, TEST_EMAIL, MONTH } from "./lib";

const BASE = "http://127.0.0.1:3000";
const OUT = "design/preview-2026-09-21";
const WIDTH = 1440;
/* Chromium est préinstallé dans cet environnement ; Playwright ne le télécharge pas. */
const CHROMIUM = "/opt/pw-browsers/chromium";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
}

async function main() {
  const db = admin();
  const { kitId } = await testKit(db);
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 1000 } });
  const page = await context.newPage();

  /* ── L'écran de connexion réel ─────────────────────────────────────── */
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', "local-harness-only");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await settle(page);

  /* ── 1. Le flux du mois ────────────────────────────────────────────── */
  await page.goto(`${BASE}/app/content?month=${MONTH}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/01-month-stream.png`, fullPage: true });

  await page.goto(`${BASE}/app/content?month=${MONTH}&view=calendar`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/02-month-calendar.png`, fullPage: true });

  /* ── 2. Le panneau « New post » ────────────────────────────────────── */
  await page.getByRole("button", { name: "New post" }).first().click();
  await page.waitForURL(/\/app\/content\/[0-9a-f-]{36}/, { timeout: 30000 });
  await settle(page);
  const freshItem = page.url().split("/").pop() ?? "";
  await page.screenshot({ path: `${OUT}/03-new-post-write-panel.png`, fullPage: true });

  /*
   * ── 3. Un post manuel incomplet, panneau de génération visible ──────
   *
   * Un titre écrit à la main, pas de légende, pas d'alt : exactement l'état
   * dans lequel on repose un post qu'on a commencé. Le panneau reste au-dessus
   * — c'est ce que le chantier de la partie 1 a mis à la place du formulaire
   * vide, et c'est ce qu'il faut pouvoir regarder.
   */
  await page.fill("#content-title", "the first Tuesday back");
  await page.locator("#content-caption").click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/06-manual-post-incomplete.png`, fullPage: true });

  /* ── 4. Les deux relectures ────────────────────────────────────────── */
  const { data: items } = await db
    .from("content_items")
    .select("id, title, compose_archetype, caption")
    .eq("brand_kit_id", kitId)
    .order("created_at", { ascending: true });

  const written = (items ?? []).filter((item) => (item.caption ?? "").length > 0);
  const carousel = written.find((item) => item.compose_archetype === "carousel");
  const simple = written.find((item) => item.compose_archetype !== "carousel");

  if (simple) {
    await page.goto(`${BASE}/app/content/${simple.id}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.screenshot({ path: `${OUT}/04-write-it-review-single.png`, fullPage: true });
  }
  if (carousel) {
    await page.goto(`${BASE}/app/content/${carousel.id}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.screenshot({ path: `${OUT}/05-write-it-review-carousel.png`, fullPage: true });
  }

  /* ── 5. La planche des douze premiers visuels ──────────────────────── */
  /*
   * ⚠ LES DOUZE PREMIERS QUI COMPOSENT, ET LE COMPTE DES REFUS. Le moteur
   * refuse une carte qui ne tient pas à ses planchers typographiques ; prendre
   * « les douze premiers écrits » produirait une planche à trous sans dire
   * pourquoi. Les refus sont comptés et rendus avec le reste.
   */
  const pngs: string[] = [];
  const refusedToCompose: Array<{ title: string; archetype: string | null; because: string }> = [];
  for (const item of written) {
    if (pngs.length >= 12) break;
    const response = await page.request.get(`${BASE}/api/content-items/${item.id}/image`);
    if (!response.ok()) {
      refusedToCompose.push({
        title: item.title ?? "(untitled)",
        archetype: item.compose_archetype,
        because: (await response.text()).slice(0, 200),
      });
      continue;
    }
    pngs.push(`data:image/png;base64,${Buffer.from(await response.body()).toString("base64")}`);
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
<h1>Twelve visuals — real path, local base, test account — card width ${cardWidth}px</h1>
<ol>${pngs
    .map((src, index) => `<li><img src="${src}" alt=""><figcaption>${index + 1}</figcaption></li>`)
    .join("")}</ol>`;

  for (const [name, cardWidth] of [["07-visuals-12-1080x1350", 1080], ["08-visuals-12-at-350", 350]] as const) {
    const file = `/tmp/board-${cardWidth}.html`;
    await writeFile(file, board(cardWidth), "utf8");
    const boardPage = await context.newPage();
    await boardPage.setViewportSize({ width: cardWidth === 1080 ? 2320 : WIDTH, height: 1200 });
    await boardPage.goto(`file://${file}`, { waitUntil: "load" });
    await boardPage.waitForTimeout(800);
    await boardPage.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    await boardPage.close();
  }

  console.log(JSON.stringify({
    step: "captures",
    out: OUT,
    freshItem,
    written: written.length,
    visuals: pngs.length,
    refusedToCompose,
    single: simple?.id ?? null,
    carousel: carousel?.id ?? null,
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
