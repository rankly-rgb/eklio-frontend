/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES CARTES D'UN MOIS EN PRODUCTION, MESURÉES — ET LEUR PLANCHE (2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   bun scripts/production-path/eklio-ops/measure.ts --kit <id> --month 2027-01-01 [--out dossier]
 *
 * Lecture seule. Les cartes sont recomposées par le chemin réel des cartes
 * stockées (`storeMonthCards` → `serverCardRasteriser`), avec un SEUL point
 * remplacé : le dépôt, qui n'écrit rien ici. On mesure ce que la production
 * a rendu : rien n'est relu dans un journal local.
 *
 * Le remplissage se mesure par LA fonction du moteur (`verticalFillOfSvg`,
 * F136) ; la licence au pire pixel sous chaque ligne du pied, sur la carte
 * rendue sans ses glyphes ; les formats par fenêtre de neuf avec
 * `formatRhythm`, dans l'ordre des dates de publication.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { contrastRatio } from "../../../lib/brand/color";
import { verticalFillOfSvg } from "../../../lib/compose/engine";
import { cardHasVisual } from "../../../lib/compose/library";
import { curatedAccent, type PaletteFamilyRow } from "../../../lib/compose/palette";
import { storeMonthCards } from "../../../lib/content/month/card-store";
import { serverCardRasteriser, serverCardStorePort } from "../../../lib/content/month/card-store-server";
import { readPathPalette } from "../../../lib/content/month/run-for-kit";
import { formatOf, formatRhythm } from "../../../lib/content/month/select";
import { licenceMentionFor } from "../../../lib/content/review";
import { carouselSlides } from "../../../lib/content/slides";
import { render } from "../../../lib/compose/engine";
import { option, production, refuse, requireKit, requireMigrations, type Db } from "./common";

const FILL_FLOOR = 2 / 3;

function worstLicenceContrast(svg: string): number {
  const ground = svg.replace(/<g data-role="(text|figure)"[\s\S]*?<\/g>/g, "");
  const px = new Resvg(ground).render().pixels;
  let worst = Infinity;
  for (const g of svg.matchAll(/<g data-role="text" data-band="footer"[^>]*>([\s\S]*?)<\/g>/g)) {
    for (const t of g[1].matchAll(/<text [^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*data-box="([^"]+)"/g)) {
      const [bx, by, bw, bh] = t[2].split(",").map(Number);
      for (let y = Math.max(0, Math.floor(by)); y < Math.min(1350, Math.ceil(by + bh)); y++) {
        for (let x = Math.max(0, Math.floor(bx)); x < Math.min(1080, Math.ceil(bx + bw)); x++) {
          const i = (y * 1080 + x) * 4;
          const hex = "#" + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
          worst = Math.min(worst, contrastRatio(t[1], hex));
        }
      }
    }
  }
  return worst;
}

export async function measureMonth(db: Db, kitId: string, month: string, out: string) {
  const kit = await requireKit(db, kitId);
  const { data: monthRow } = await db.from("content_months").select("id, status").eq("brand_kit_id", kitId).eq("month", month).maybeSingle();
  if (!monthRow) refuse(`aucun mois ${month} pour le kit ${kitId}`);
  const { data: brief } = await db.from("project_briefs").select("practice_name").eq("project_id", kit.project_id).maybeSingle();
  const licence = await licenceMentionFor(db as never, kit.project_id);
  const read = readPathPalette(kit as never);
  if (!read) refuse("le kit n'a pas de palette complète");
  const { data: families } = await db.from("palette_families").select("primary_hex, secondary_hex, light_hex, dark_hex, paper_hex, accent_hex");
  const accent = curatedAccent(read, (families ?? []) as PaletteFamilyRow[]);
  const direction = { ...read, ...(accent ? { accent } : {}) };

  mkdirSync(join(out, "cartes"), { recursive: true });
  const cards: Array<{ headline: string; archetype: string; svg: string; png: Buffer }> = [];
  const port = serverCardStorePort(db as never);
  const stored = await storeMonthCards(
    { monthItems: port.monthItems, upload: async () => null },
    (async (card: never) => {
      const png = await serverCardRasteriser(card);
      const c = card as { headline: string; archetypeKey: string; illustration: string | null; ground: unknown; payload: unknown; palette: unknown; eyebrow: string; footer: string };
      const slides = carouselSlides(card);
      const svg = slides.kind === "slides" ? slides.slides[0].svg : render({ illustration: c.illustration ?? undefined, ground: c.ground, archetype: c.archetypeKey, payload: c.payload, palette: c.palette, eyebrow: c.eyebrow, headline: c.headline, footer: c.footer } as never).svg;
      cards.push({ headline: c.headline, archetype: c.archetypeKey, svg, png: png as Buffer });
      return png;
    }) as never,
    { kitId, monthId: monthRow!.id, direction: direction as never, practiceName: brief?.practice_name ?? "", licence }
  );

  const { data: items } = await db.from("content_items").select("title, compose_archetype, scheduled_for, illustration_key").eq("month_id", monthRow!.id).order("scheduled_for");
  const order = new Map((items ?? []).map((it, i) => [it.title, i]));
  cards.sort((a, b) => (order.get(a.headline) ?? 99) - (order.get(b.headline) ?? 99));

  const rows = cards.map((c, i) => {
    const idiom = /data-idiom="([a-z_]+)"/.exec(c.svg)?.[1] ?? null;
    const fill = verticalFillOfSvg(c.svg);
    const lic = worstLicenceContrast(c.svg);
    const n = String(i + 1).padStart(2, "0");
    writeFileSync(join(out, "cartes", `${n}.png`), c.png);
    writeFileSync(join(out, "cartes", `${n}.svg`), c.svg);
    return {
      n: i + 1, archetype: c.archetype, idiom,
      visual: cardHasVisual(c.svg),
      fill: Math.round(fill * 1000) / 10,
      underFill: idiom !== "quote_deep" && fill < FILL_FLOOR,
      licenceInSvg: licence ? c.svg.includes(licence) : false,
      licenceContrast: Math.round(lic * 100) / 100,
      library: /data-library="([^"]+)"/.exec(c.svg)?.[1] ?? null,
    };
  });
  const r = formatRhythm((items ?? []).map((it) => formatOf(it.compose_archetype ?? "")));
  const metrics = {
    month, kit: kitId, status: monthRow!.status, items: items?.length ?? 0, cardsStored: stored,
    emptyCards: rows.filter((x) => !x.visual).length,
    licenceLegible: `${rows.filter((x) => x.licenceInSvg && x.licenceContrast >= 4.5).length}/${rows.length}`,
    worstLicence: Math.min(...rows.map((x) => x.licenceContrast)),
    underFillFloor: rows.filter((x) => x.underFill).map((x) => x.n),
    formatsPerWindow: { min: Math.min(...r.distinct), all: r.distinct },
    longestFormatRun: r.longestRun,
    illustrated: rows.filter((x) => x.library).length,
  };
  writeFileSync(join(out, "mesures.json"), JSON.stringify({ metrics, rows }, null, 1) + "\n");
  /* La planche à 390 px : `sheet.py` (Pillow), à côté de ce fichier. */
  const sheet = spawnSync("python3", ["-I", join(dirname(fileURLToPath(import.meta.url)), "sheet.py"), join(out, "cartes"), out], { encoding: "utf8" });
  return { metrics, rows, sheet: sheet.status === 0 ? join(out, "planche-390.jpg") : `planche non produite : ${sheet.stderr.slice(0, 200)}` };
}

if (process.argv[1]?.endsWith("measure.ts")) {
  const db = production();
  await requireMigrations(db);
  const kit = option("--kit");
  const month = option("--month");
  if (!kit || !month) refuse("--kit <id> et --month AAAA-MM-01 sont obligatoires");
  const out = option("--out") ?? `planche-${kit!.slice(0, 8)}-${month}`;
  const res = await measureMonth(db, kit!, month!, out);
  console.log(JSON.stringify(res.metrics, null, 1));
  console.log(`planche : ${res.sheet}`);
}
