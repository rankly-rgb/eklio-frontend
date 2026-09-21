/*
 * Les visuels du mois, par la route du produit, puis les deux planches.
 *
 * ⚠ CHAQUE PNG EST DEMANDÉ À `GET /api/content-items/[id]/image`, la route que
 * le bouton de téléchargement appelle. Recomposer ici donnerait une planche
 * qui prouve que ce script sait dessiner, pas que le produit sait livrer.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { admin, accountFor, MONTH } from "./lib";
import { THUMB } from "@/lib/compose/constants";

const BASE = "http://127.0.0.1:3000";
const CHROMIUM = "/opt/pw-browsers/chromium";

/** Les onze références reconstruites, et l'archétype que chacune contractualise. */
const REFERENCES: Array<[string, string]> = [
  ["single-statement", "single_statement"],
  ["quadrant-model", "quadrant_model"],
  ["cycle", "cycle"],
  ["surface-and-beneath", "surface_and_beneath"],
  ["comparison-pair", "comparison_pair"],
  ["numbered-strategies", "numbered_strategies"],
  ["lettered-technique", "lettered_technique"],
  ["concentric-control", "concentric_control"],
  ["annotated-curve", "annotated_curve"],
  ["practitioner-card", "practitioner_card"],
  ["carousel", "carousel"],
];

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  const out = arg("out") ?? "design/preview-2026-09-21b";
  const email = arg("email");
  const db = admin();
  const { kitId } = await accountFor(db, email);
  await mkdir(`${out}/visuals`, { recursive: true });

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

  const shots: Array<{ src: string; label: string; archetype: string }> = [];
  const refused: Array<{ title: string; archetype: string | null; because: string }> = [];

  for (const item of items ?? []) {
    /*
     * ⚠ UN CARROUSEL A PLUSIEURS VOLETS, ET LA PLANCHE N'EN DEMANDAIT QU'UN.
     *
     * `GET /api/content-items/[id]/image` sans paramètre rend le PREMIER volet.
     * La planche montrait donc chaque carrousel comme une carte unique portant
     * un badge « 1/6 » — indistinguable d'une phrase seule. Un contrôle
     * indépendant les a notés 1 sur 5 en élaboration, « carrousel livré comme
     * une seule diapositive de couverture », et il avait raison sur ce qu'il
     * voyait : c'est la PREUVE qui était fausse, pas le produit. La route
     * accepte `?slide=N` depuis toujours.
     */
    const wanted: Array<number | null> =
      item.compose_archetype === "carousel"
        ? Array.from({ length: 8 }, (_, i) => i + 1)
        : [null];

    for (const slide of wanted) {
      const url = slide === null
        ? `${BASE}/api/content-items/${item.id}/image`
        : `${BASE}/api/content-items/${item.id}/image?slide=${slide}`;
      const response = await page.request.get(url);
      if (!response.ok()) {
        // Au-delà du dernier volet, la route refuse : c'est la fin, pas un échec.
        if (slide !== null && slide > 1) break;
        refused.push({
          title: item.title ?? "(untitled)", archetype: item.compose_archetype,
          because: (await response.text()).slice(0, 160),
        });
        break;
      }
      const png = Buffer.from(await response.body());
    // Chaque visuel est aussi écrit seul, à sa taille de toile : une planche
    // se regarde, un fichier se rouvre — et c'est celui-là que l'agent de
    // contrôle indépendant reçoit.
      const suffix = slide === null ? "" : `-${slide}`;
      const file = `${String(shots.length + 1).padStart(2, "0")}-${item.compose_archetype ?? "unknown"}${suffix}.png`;
      await writeFile(`${out}/visuals/${file}`, png);
      shots.push({
        src: `data:image/png;base64,${png.toString("base64")}`,
        label: `${shots.length + 1} · ${item.compose_archetype}${slide === null ? "" : ` · volet ${slide}`}`,
        archetype: item.compose_archetype ?? "unknown",
      });
    }
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
<h1>${shots.length} visuels — chemin réel, base locale, compte de test — largeur de carte ${cardWidth}px</h1>
<ol>${shots.map((s) => `<li><img src="${s.src}" alt=""><figcaption>${s.label}</figcaption></li>`).join("")}</ol>`;

  /*
   * ⚠ 390 ET PLUS 350. La lisibilité se mesure désormais à la largeur d'un
   * post pleine largeur dans un fil de téléphone — `THUMB.width` — et c'est de
   * cette valeur que le plancher de 30px à 1080 se déduit. Une planche à 350
   * contrôlerait autre chose que ce que le moteur garantit.
   */
  for (const [name, cardWidth, viewport] of [
    ["01-thirty-visuals-1080x1350", 1080, 3480],
    [`02-thirty-visuals-at-${THUMB.width}`, THUMB.width, 1600],
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

  /*
   * ── LES ONZE PLANCHES « RÉFÉRENCE / PRODUIT » ────────────────────────
   *
   * ⚠ LES DEUX CÔTÉS NE SE VALENT PAS, ET LA PLANCHE LE DIT. À gauche une
   * référence RECONSTRUITE depuis la spécification écrite, qui n'est passée
   * par aucun morceau de `lib/compose` — sans quoi la comparaison mesurerait
   * la conformité du moteur à lui-même. À droite un visuel du mois réel quand
   * cet archétype y figure ; sinon la case le dit plutôt que de se remplir
   * avec un rendu d'un autre archétype.
   */
  const pairs: Array<{ archetype: string; note: string }> = [];
  for (const [file, key] of REFERENCES) {
    const reference = await readFile(`design/reference/posts/${file}.svg`, "utf8");
    const produced = shots.find((s) => s.archetype === key);
    pairs.push({ archetype: key, note: produced ? "apparié" : "absent du mois" });

    const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; padding: 28px; background: #f7f5f1; font: 12px/1.5 ui-monospace, monospace; color: #3a352f; }
  h1 { font-size: 15px; letter-spacing: .1em; text-transform: uppercase; margin: 0 0 6px; }
  p.sub { margin: 0 0 20px; opacity: .7; }
  .row { display: flex; gap: 28px; align-items: flex-start; }
  .col { width: 520px; }
  .frame { width: 520px; border: 1px solid #ddd6cc; background: #fff; }
  .frame svg, .frame img { display: block; width: 100%; height: auto; }
  .empty { padding: 90px 24px; text-align: center; opacity: .55; background: #efece6; }
  figcaption { margin-top: 8px; opacity: .7; }
</style>
<h1>${key} — référence / produit</h1>
<p class="sub">à gauche : <strong>référence reconstruite, pas un rendu produit</strong> — à droite : <strong>chemin réel, base locale, compte de test</strong></p>
<div class="row">
  <div class="col"><div class="frame">${reference}</div><figcaption>référence reconstruite depuis la spécification</figcaption></div>
  <div class="col"><div class="frame">${
    produced
      ? `<img src="${produced.src}" alt="">`
      : `<div class="empty">cet archétype n'apparaît pas dans le mois rendu</div>`
  }</div><figcaption>${produced ? produced.label : "—"}</figcaption></div>
</div>`;
    const tmp = `/tmp/pair-${key}.html`;
    await writeFile(tmp, html, "utf8");
    const pairPage = await context.newPage();
    await pairPage.setViewportSize({ width: 1160, height: 1000 });
    await pairPage.goto(`file://${tmp}`, { waitUntil: "load" });
    await pairPage.waitForTimeout(500);
    await pairPage.screenshot({ path: `${out}/03-pair-${key}.png`, fullPage: true });
    await pairPage.close();
  }

  /*
   * ⚠ LE DÉCOMPTE RESTE CELUI DES POSTS. Un carrousel de six volets est UN
   * post ; compter ses volets ferait passer un mois de trente pour un mois de
   * quarante, et la part de phrases seules s'en trouverait diluée.
   */
  const posts = items?.length ?? 0;
  const lone = (items ?? []).filter((i) => i.compose_archetype === "single_statement").length;
  console.log(JSON.stringify({
    step: "board", out, month: MONTH, items: items?.length ?? 0,
    visuals: shots.length, refused,
    slides: shots.length,
    loneSentence: { count: lone, share: posts ? Number((lone / posts).toFixed(3)) : 0 },
    archetypes: Object.fromEntries(
      [...new Set((items ?? []).map((i) => i.compose_archetype))].map((a) => [
        a ?? "unknown",
        (items ?? []).filter((i) => i.compose_archetype === a).length,
      ])
    ),
    pairs,
  }, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
