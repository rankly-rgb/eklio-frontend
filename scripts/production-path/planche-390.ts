/*
 * Le coup d'œil de B6 réduit à UNE image : la planche d'un mois, rendue à la
 * largeur d'un téléphone (390 px), telle qu'une lectrice la verra.
 *
 *   npx tsx scripts/production-path/planche-390.ts design/production-first-month/planche.html
 *   → design/production-first-month/planche-390.png, et le compte des cartes
 *
 * Il ne juge rien : il prépare le regard. Il refuse seulement une planche qui
 * n'a pas trente cartes — regarder vingt-neuf cartes, c'est valider un mois court.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input || !existsSync(input)) {
  console.error("usage : planche-390.ts <planche.html>");
  process.exit(2);
}
const output = input.replace(/\.html$/, "-390.png");
const EXECUTABLE = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;

async function main() {
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`file://${resolve(input)}`);
  const cards = await page.locator("svg").count();
  await page.screenshot({ path: output, fullPage: true });
  await browser.close();
  console.log(`${cards} carte(s) → ${output}`);
  if (cards !== 30) {
    console.error(`✗ ${cards} cartes, pas 30 : un mois court ne se regarde pas, il se refait.`);
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
