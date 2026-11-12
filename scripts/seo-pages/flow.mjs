/*
 * ⚠ HARNAIS — joue le parcours de la praticienne sur UNE pièce du vrai chemin
 * produit, dans le navigateur, contre la façade LOCALE : relire → cocher →
 * confirmer → le panneau de copie s'ouvre → copier → déclarer l'adresse publiée.
 * Chaque étape passe par `POST /api/seo-pieces/[id]` et donc par la RLS, le
 * GRANT par colonne et les triggers de `seo_pieces`.
 *
 *   node scripts/seo-pages/flow.mjs <email> <base url> <piece title> <out dir>
 */
import { chromium } from "playwright";

const [email, base, title, out] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "local-only");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);

await page.goto(`${base}/app/pages?month=2026-12-01`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: title }).first().click();
await page.waitForLoadState("networkidle");

const steps = [];
steps.push({ step: "export closed before review", ok: (await page.getByRole("heading", { name: "Copy it to your site" }).count()) === 0 });
const confirm = page.getByRole("button", { name: "Confirm my review" });
steps.push({ step: "confirm disabled until checked", ok: await confirm.isDisabled() });
await page.getByLabel("I have read this page as its author, and it says what I mean.").check();
await confirm.click();
await page.getByRole("heading", { name: "Copy it to your site" }).waitFor({ timeout: 15000 });
steps.push({ step: "copy panel opens after review", ok: true });

await page.getByRole("button", { name: "Copy the text" }).click();
await page.waitForTimeout(1500);
const clip = await page.evaluate(() => navigator.clipboard.readText());
steps.push({ step: "copied body starts with the H1 and byline", ok: clip.startsWith("# ") && clip.includes("*By ") });

await page.reload({ waitUntil: "networkidle" });
steps.push({ step: "status after copy", ok: (await page.getByText("Copied — not marked as published yet").count()) > 0 });

await page.screenshot({ path: `${out}/REAL-PRODUCT-PATH_app-pages-copy-panel_2026-12-01.png`, fullPage: false });

await page.fill("#published-url", "https://lenaparktherapy.example/emdr-new-parents");
await page.getByRole("button", { name: "Mark as published" }).click();
await page.getByText("Published at").waitFor({ timeout: 15000 });
steps.push({ step: "published URL recorded", ok: true });

console.log(JSON.stringify(steps, null, 1));
await browser.close();
