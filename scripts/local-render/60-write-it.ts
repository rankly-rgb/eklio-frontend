/*
 * ── TROIS VRAIS CLICS SUR « WRITE IT » ──────────────────────────────────
 *
 * Playwright conduit l'application comme elle : il se connecte par l'écran de
 * connexion, ouvre « New post » depuis le calendrier, et CLIQUE. Rien n'est
 * posté à la route en passant par-dessus l'interface — c'est le bouton qui
 * part, avec sa clef d'idempotence, son panneau et son décompte de crédits.
 *
 * Trois entrées, celles du panneau :
 *   1. un sujet suggéré, tiré de sa banque ;
 *   2. son idée libre ;
 *   3. un carrousel.
 *
 * ⚠ ET IL RELANCE, PARCE QUE LE BUDGET DE MOTS REFUSE. Un refus `over_budget`
 * n'est pas une panne : c'est le validateur qui fait son travail. Le script
 * recommence avec une autre entrée jusqu'à un nombre de tentatives borné, et
 * le rapport publie combien il en a fallu — c'est le chiffre intéressant.
 *
 *   npx tsx scripts/local-render/60-write-it.ts
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { admin, testKit, TEST_EMAIL, MONTH } from "./lib";

const BASE = "http://127.0.0.1:3000";
const OUT = "design/preview-2026-09-21";
const CHROMIUM = "/opt/pw-browsers/chromium";
const MAX_ATTEMPTS = 6;

type Case = {
  name: string;
  file: string;
  /** Ce qu'on tape ou choisit avant de cliquer. Rend une étiquette lisible. */
  arm: (page: Page, attempt: number) => Promise<string>;
};

async function newPost(page: Page): Promise<string> {
  await page.goto(`${BASE}/app/content?month=${MONTH}&view=calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "New post" }).first().click();
  await page.waitForURL(/\/app\/content\/[0-9a-f-]{36}/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  return page.url().split("/").pop() ?? "";
}

/** Le clic, et l'attente que « Writing… » redevienne autre chose. */
async function clickWriteIt(page: Page): Promise<boolean> {
  await page.getByRole("button", { name: /^Write it$|^Yes, replace it$/ }).click();
  await page
    .waitForFunction(() => !document.body.innerText.includes("Writing…"), { timeout: 240000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  /*
   * ⚠ LA PREUVE EST L'ABSENCE DU PANNEAU, pas un message. Un post écrit passe
   * en `generated` et le panneau disparaît — c'est la règle de `writeScreen`,
   * et c'est ce que l'écran fait vraiment. Lire un libellé d'erreur serait
   * lire une formulation ; lire le panneau, c'est lire l'état.
   */
  return (await page.locator("#write-idea").count()) === 0;
}

const IDEAS_FOR_CAROUSEL = [
  "four small signs that rest is not landing yet",
  "three things a body does on the first Tuesday back",
  "what bracing costs, in four short notes",
  "the cycle of going back to work and bracing again",
  "surface and beneath: what looks like coping after leave",
  "five short steps for the first week back",
];

const CASES: Case[] = [
  {
    name: "from a suggested topic",
    file: "10-write-it-from-suggested-topic.png",
    arm: async (page, attempt) => {
      const topics = page.locator("ul li button");
      const count = await topics.count();
      if (count === 0) throw new Error("the bank offered nothing to choose");
      const pick = topics.nth(attempt % count);
      const title = (await pick.innerText()).split("\n")[0];
      await pick.click();
      return title;
    },
  },
  {
    name: "from her own idea",
    file: "11-write-it-from-free-idea.png",
    arm: async (page) => {
      const idea = "why rest feels hard after going back to work";
      await page.fill("#write-idea", idea);
      return idea;
    },
  },
  {
    name: "a carousel",
    file: "12-write-it-carousel.png",
    arm: async (page, attempt) => {
      const idea = IDEAS_FOR_CAROUSEL[attempt % IDEAS_FOR_CAROUSEL.length];
      await page.fill("#write-idea", idea);
      await page.getByRole("button", { name: "Carousel" }).click();
      return `${idea} · carousel`;
    },
  },
];

async function main() {
  const db = admin();
  const { kitId } = await testKit(db);
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', "local-harness-only");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");

  const done: Array<{ name: string; itemId: string; attempts: number; entry: string }> = [];

  for (const entry of CASES) {
    const itemId = await newPost(page);
    let attempts = 0;
    let written = false;
    let label = "";

    while (attempts < MAX_ATTEMPTS && !written) {
      attempts += 1;
      await page.goto(`${BASE}/app/content/${itemId}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      if ((await page.locator("#write-idea").count()) === 0) { written = true; break; }
      label = await entry.arm(page, attempts - 1);
      written = await clickWriteIt(page);
      console.error(`  ${entry.name} · attempt ${attempts}: ${written ? "written" : "refused"}`);
    }

    if (!written) {
      console.error(`✗ ${entry.name}: ${MAX_ATTEMPTS} attempts, all refused.`);
      continue;
    }

    await page.goto(`${BASE}/app/content/${itemId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${entry.file}`, fullPage: true });
    done.push({ name: entry.name, itemId, attempts, entry: label });
    console.error(`✓ ${entry.name} · ${attempts} attempt(s) · ${entry.file}`);
  }

  /* ── Le carrousel, slide par slide, par la route du produit ────────── */
  const carousel = done.find((d) => d.name === "a carousel");
  const slides: string[] = [];
  if (carousel) {
    for (let number = 1; number <= 8; number += 1) {
      const response = await page.request.get(
        `${BASE}/api/content-items/${carousel.itemId}/image?slide=${number}`
      );
      if (!response.ok()) break;
      const file = `${OUT}/13-carousel-slide-${number}.png`;
      await writeFile(file, await response.body());
      slides.push(file);
    }
    console.error(`✓ carousel: ${slides.length} slides at 1080×1350`);
  }

  const { data: ledger } = await db
    .from("credit_ledger")
    .select("actual_cost_usd");
  const spent = (ledger ?? []).reduce((total, row) => total + Number(row.actual_cost_usd ?? 0), 0);

  console.log(JSON.stringify({
    step: "write-it",
    kitId,
    done,
    slides: slides.length,
    ledgerActualCostUsd: Number(spent.toFixed(6)),
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
