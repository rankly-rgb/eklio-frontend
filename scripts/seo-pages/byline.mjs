/*
 * ⚠ HARNAIS — relève ce que l'écran affiche comme ligne d'autrice et mention de
 * licence pour chaque pièce d'un mois, ce que contient le bloc copiable « Copy the
 * text », et l'auteur du JSON-LD copiable. Capture la première pièce, bannière de
 * provenance comprise.
 *
 *   node scripts/seo-pages/byline.mjs <email> <base url> <month> <out png> <label>
 */
import { chromium } from "playwright";

const [email, base, month, png, label] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "local-only");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);

await page.goto(`${base}/app/pages?month=${month}`, { waitUntil: "networkidle" });
const hrefs = [...new Set(await page.locator('a[href^="/app/pages/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href"))))];
const out = [];
for (const [i, href] of hrefs.entries()) {
  await page.goto(`${base}${href}`, { waitUntil: "networkidle" });
  const h1 = (await page.locator("article h1").textContent())?.trim();
  const byline = (await page.locator("article p.italic").first().textContent())?.trim();
  if (i === 0) {
    await page.evaluate((t) => {
      const b = document.createElement("div");
      b.textContent = t;
      b.setAttribute("style", "position:fixed;top:0;left:0;right:0;z-index:99999;background:#241B23;color:#FAF7F2;font:600 12px/1.6 monospace;padding:4px 12px;text-align:center");
      document.body.appendChild(b);
    }, label);
    await page.screenshot({ path: png });
  }
  out.push({ href, h1, byline });
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
