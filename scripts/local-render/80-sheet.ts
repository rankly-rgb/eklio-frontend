/*
 * Une planche-contact des onze archétypes, sur fixtures.
 *
 * ⚠ CETTE PLANCHE NE PROUVE RIEN SUR LE PRODUIT, ET C'EST VOULU. Elle passe
 * par `composeWithFallback` avec des charges utiles fixes : c'est un
 * instrument de RÉGLAGE du moteur de composition, qu'on regarde en boucle
 * pendant qu'on dessine. La preuve, elle, est le mois réel rendu par
 * `70-board.ts` depuis la base locale.
 *
 * Tout fichier qui en sort porte donc la mention « fixture ».
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { composeWithFallback } from "@/lib/compose/fallback";
import { renderCarousel } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes";
import { payloadFor, CARD, type Length } from "@/lib/compose/__tests__/fixtures";

const CHROMIUM = "/opt/pw-browsers/chromium";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};

const DIRECTION = {
  paper: "#FAF6EE",
  light: "#F0E7D8",
  secondary: "#C08A3E",
  primary: "#B4674A",
  dark: "#2B2A27",
};

async function main() {
  const out = arg("out", "/tmp/sheet");
  const length = arg("length", "nominal") as Length;
  const cardW = Number(arg("card", "340"));

  const palette = cardPalette("sheet", DIRECTION as never, false);
  const cells: string[] = [];

  for (const archetype of ARCHETYPE_KEYS) {
    const input = { ...CARD, archetype, palette, payload: payloadFor(archetype, length) };

    /*
     * ⚠ UN CARROUSEL PASSE PAR `renderCarousel`, PAS PAR `render`. Demandé
     * comme un archétype ordinaire, il composait l'enveloppe sans ses volets :
     * la planche montrait une carte vide, et une carte vide sur une planche de
     * réglage se lit comme un bug du moteur alors que c'est l'instrument qui
     * tenait mal l'outil.
     */
    let svgs: string[];
    let note: string;
    if (archetype === "carousel") {
      svgs = renderCarousel(input).map((r) => r.svg);
      note = `${svgs.length} volets`;
    } else {
      const composed = composeWithFallback(input);
      svgs = composed.kind === "carousel" ? composed.slides.map((r) => r.svg) : [composed.result.svg];
      note = composed.kind === "carousel" ? "replié en carrousel" : composed.archetype;
    }
    cells.push(
      `<li><div class="c">${svgs.join('</div><div class="c">')}</div>` +
        `<figcaption>${archetype} → ${note}</figcaption></li>`
    );
  }

  const html =
    `<!doctype html><meta charset="utf-8"><title>planche-contact — fixture</title><style>` +
    `body{margin:0;padding:24px;background:#e9e4dc;font:11px ui-monospace,monospace;color:#3a362f}` +
    `h1{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px}` +
    `ol{display:flex;flex-wrap:wrap;gap:18px;list-style:none;margin:0;padding:0}` +
    `li{width:${cardW}px}.c{width:${cardW}px;margin-bottom:6px;border:1px solid #cbc4b8}` +
    `.c svg{display:block;width:100%;height:auto}figcaption{opacity:.65}` +
    `</style><h1>planche-contact — fixture, pas un rendu produit — longueur « ${length} »</h1>` +
    `<ol>${cells.join("")}</ol>`;

  await mkdir(out, { recursive: true });
  await writeFile(`${out}/sheet.html`, html, "utf8");

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: cardW * 4 + 130, height: 1200 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `${out}/sheet.png`, fullPage: true });
  await browser.close();
  console.log(`planche-contact : ${out}/sheet.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
