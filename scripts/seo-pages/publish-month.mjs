/*
 * ⚠ HARNAIS — publie, PAR LE VRAI FLUX, toutes les pièces d'un mois d'une
 * praticienne de test : pour chacune, l'écran de la pièce, la case « I have read
 * this page as its author », « Confirm my review », « Copy the text », puis
 * « Where did you publish it? » avec une URL DE TEST (domaine .example). Chaque
 * geste passe par `POST /api/seo-pieces/[id]`, donc par la RLS, le GRANT par
 * colonne et les triggers de `seo_pieces`.
 *
 *   node scripts/seo-pages/publish-month.mjs <email> <base url> <month> <test site base>
 */
import { chromium } from "playwright";

const [email, base, month, site] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "local-only");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);

await page.goto(`${base}/app/pages?month=${month}`, { waitUntil: "networkidle" });
const hrefs = [...new Set(await page.locator('a[href^="/app/pages/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href"))))];
const done = [];
for (const href of hrefs) {
  await page.goto(`${base}${href}`, { waitUntil: "networkidle" });
  if ((await page.getByText("Published at").count()) > 0) {
    done.push({ href, already: true });
    continue;
  }
  if ((await page.getByRole("button", { name: "Confirm my review" }).count()) > 0) {
    await page.getByLabel("I have read this page as its author, and it says what I mean.").check();
    await page.getByRole("button", { name: "Confirm my review" }).click();
    await page.getByRole("heading", { name: "Copy it to your site" }).waitFor({ timeout: 15000 });
  }
  await page.getByRole("button", { name: "Copy the text" }).click();
  await page.waitForTimeout(800);
  const slug = (await page.locator("text=/^\\/[a-z0-9-]+$/").first().textContent())?.trim() ?? `/${href.split("/").pop()}`;
  await page.fill("#published-url", `${site}${slug}`);
  await page.getByRole("button", { name: /Mark as published|Update the address/ }).click();
  await page.getByText("Published at").waitFor({ timeout: 15000 });
  done.push({ href, url: `${site}${slug}` });
}
console.log(JSON.stringify(done, null, 1));
await browser.close();
