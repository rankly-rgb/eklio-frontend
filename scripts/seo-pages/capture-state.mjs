/*
 * ⚠ HARNAIS — capture l'écran « Website pages » d'une praticienne d'un État NON
 * vérifié (profil B, New York), servi par `next start` contre la façade LOCALE.
 * Rien n'est généré pour elle : on capture ce que la page lui dit.
 *
 *   node scripts/seo-pages/capture-state.mjs <email> <base url> <out file>
 */
import { chromium } from "playwright";

const [email, base, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "local-only");
await Promise.all([
  page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${base}/app/pages`, { waitUntil: "networkidle" });
if (new URL(page.url()).pathname.startsWith("/login")) throw new Error(`not signed in: ${page.url()}`);
const text = await page.locator("main").innerText();
await page.evaluate((t) => {
  const b = document.createElement("div");
  b.textContent = t;
  b.setAttribute("style", "position:fixed;top:0;left:0;right:0;z-index:99999;background:#241B23;color:#FAF7F2;font:600 12px/1.6 monospace;padding:4px 12px;text-align:center");
  document.body.appendChild(b);
}, "REAL PRODUCT PATH — /app/pages served by next start · profile B (LCSW, New York, unverified state) · LOCAL database, 2026-11-12");
await page.screenshot({ path: out, fullPage: true });
console.log(text);
await browser.close();
