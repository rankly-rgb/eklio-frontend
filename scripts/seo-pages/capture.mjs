/*
 * ⚠ HARNAIS — capture l'écran « Website pages » de la praticienne de test, servi
 * par `next start` contre la façade LOCALE. Le nom du fichier et la bannière
 * disent d'où vient ce qu'on voit : les pièces du VRAI chemin produit.
 *
 *   node scripts/seo-pages/capture.mjs <email> <base url> <out dir>
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

/* ⚠ Jamais une bannière « produit » sur un écran de connexion (premier essai, 2026-11-12). */
const assertSignedIn = () => {
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error(`not signed in: ${page.url()}`);
};

const banner = (text) =>
  page.evaluate((t) => {
    const b = document.createElement("div");
    b.textContent = t;
    b.setAttribute("style", "position:fixed;top:0;left:0;right:0;z-index:99999;background:#241B23;color:#FAF7F2;font:600 12px/1.6 monospace;padding:4px 12px;text-align:center");
    document.body.appendChild(b);
  }, text);

const label = "REAL PRODUCT PATH — pieces written by the cron route → claim_seo_slot → OpenAI → checks → seo_pieces · LOCAL database, 2026-11-12";

await page.goto(`${base}/app/pages?month=2026-12-01`, { waitUntil: "networkidle" });
assertSignedIn();
await banner(label);
await page.screenshot({ path: `${out}/REAL-PRODUCT-PATH_app-pages-list_2026-12-01.png`, fullPage: true });

const first = await page.locator('a[href^="/app/pages/"]').first().getAttribute("href");
await page.goto(`${base}${first}`, { waitUntil: "networkidle" });
assertSignedIn();
await banner(label);
await page.screenshot({ path: `${out}/REAL-PRODUCT-PATH_app-pages-piece-review_2026-12-01.png`, fullPage: false });

console.log(JSON.stringify({ list: `${out}/REAL-PRODUCT-PATH_app-pages-list_2026-12-01.png`, piece: first }));
await browser.close();
