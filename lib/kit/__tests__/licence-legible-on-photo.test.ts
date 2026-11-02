import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { contrastRatio } from "@/lib/brand/color";
import { render } from "@/lib/compose/engine";
import { DRAWABLE, PHOTOS, PHOTO_FIGURE_CONTRAST, PHOTO_TEXT_CONTRAST } from "@/lib/compose/decor";
import { CONTRAST_TARGET } from "@/lib/kit/render/luminance";
import type { Box, Placed } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CHAQUE LIGNE, ET D'ABORD LA MENTION DE LICENCE, AU PIRE PIXEL DU RENDU
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le voile d'un fond photo est LOCAL (troisième session, 2026-11-01) : résolu
 * bande par bande contre des bornes mesurées. Ici il est vérifié sur le RENDU :
 * des cartes composées par le moteur, sur chacun des 27 fonds, sous chaque
 * famille du catalogue, claire et sombre ; le fond rastérisé sans glyphes ni
 * traits ; et pour chaque ligne posée à même le fond — la mention de licence
 * comprise — le PIRE pixel sous sa boîte doit tenir 4,5:1 contre son encre ;
 * pour chaque dessin, 3:1.
 *
 * ⚠ AVEC `contrastRatio` (lib/brand/color.ts). La version précédente de ce test
 * mesurait avec `contrast` de lib/compose/palette.ts, dont la luminance ne
 * linéarise pas le bleu (F99) : son « 11/11 lisible » n'établissait rien.
 *
 * (Rastérisé ici pour mesurer ; la composition, elle, ne rastérise rien.)
 */

const MIGRATIONS = "../eklio-backend/supabase/migrations";
function catalogue(): Array<{ id: string; direction: DirectionPalette }> {
  const out: Array<{ id: string; direction: DirectionPalette }> = [];
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const insert = /insert into public\.palette_families[\s\S]*?;/i.exec(readFileSync(`${MIGRATIONS}/${file}`, "utf8"));
    if (!insert) continue;
    for (const row of insert[0].matchAll(
      /\('([a-z_]+)',\s*\d+,\s*(?:true|false),\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})'/g
    )) {
      const [, id, primary, secondary, light, dark, paper] = row;
      out.push({ id, direction: { primary, secondary, light, dark, paper } });
    }
  }
  return out;
}
const FAMILIES = catalogue();
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/** Le pire contraste entre `ink` et les pixels du fond sous `box`. */
function worstUnder(px: Uint8Array | Buffer, box: Box, ink: string): number {
  const seen = new Map<number, number>();
  let worst = Infinity;
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(1350, Math.ceil(box.y + box.h)); y += 1) {
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(1080, Math.ceil(box.x + box.w)); x += 1) {
      const i = (y * 1080 + x) * 4;
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let c = seen.get(k);
      if (c === undefined) seen.set(k, (c = contrastRatio(ink, hex(px[i], px[i + 1], px[i + 2]))));
      if (c < worst) worst = c;
    }
  }
  return worst;
}

function inField(b: Box, placed: Placed[]): boolean {
  return placed.some((p) => p.role === "field" && b.x >= p.box.x - 0.5 && b.y >= p.box.y - 0.5 && b.x + b.w <= p.box.x + p.box.w + 0.5 && b.y + b.h <= p.box.y + p.box.h + 0.5);
}

type Measured = { family: string; dark: boolean; photos: number; worstText: number; worstLicence: number; worstFigure: number };
const measured: Measured[] = [];

describe("le plancher et la mesure", () => {
  it("le plancher du texte sur photo est celui du produit (4,5:1), celui d'un dessin celui des aplats (3:1)", () => {
    expect(PHOTO_TEXT_CONTRAST).toBe(CONTRAST_TARGET);
    expect(PHOTO_FIGURE_CONTRAST).toBe(3);
  });
  it("six familles au moins sont lues, et 27 fonds sont tirables", () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(6);
    expect(PHOTOS).toHaveLength(27);
  });
});

describe.each(FAMILIES)("$id", ({ id, direction }) => {
  it.each([false, true])("fond sombre : %s — sur les 27 fonds, chaque ligne tient 4,5:1 et chaque dessin 3:1, au pire pixel", (dark) => {
    const palette = cardPalette("k", direction, dark);
    const m: Measured = { family: id, dark, photos: 0, worstText: Infinity, worstLicence: Infinity, worstFigure: Infinity };
    /*
     * Une carte sur deux prend un fond photo, au rang PAIR du dessin (F102) ; le
     * fond est le rang modulo 27. Les rangs pairs 0 à 52 couvrent les 27 fonds.
     */
    for (let k = 0; k < 2 * PHOTOS.length; k += 2) {
      const out = render({
        archetype: "single_statement",
        payload: { statement: "Old rules can linger long after the room they were made for has changed." },
        palette,
        eyebrow: "BEHIND THE PRACTICE",
        headline: "Old rules",
        footer: "Ember consulting · LMFT 123456",
        illustration: DRAWABLE[k],
      });
      if (!out.svg.includes("data-photo=")) continue;
      m.photos += 1;
      const ground = out.svg.replace(/<g data-role="(text|figure)"[\s\S]*?<\/g>/g, "");
      const px = new Resvg(ground).render().pixels;
      for (const p of out.composition.placed) {
        if (p.role === "text") {
          for (const line of p.lines) {
            if (inField(line.box, out.composition.placed)) continue;
            const w = worstUnder(px, line.box, line.fill);
            m.worstText = Math.min(m.worstText, w);
            if (p.band === "footer") m.worstLicence = Math.min(m.worstLicence, w);
            expect(w, `${PHOTOS[k % PHOTOS.length]} — ${p.band} « ${line.text} »`).toBeGreaterThanOrEqual(PHOTO_TEXT_CONTRAST);
          }
        }
        if (p.role === "figure") {
          for (const s of p.strokes) {
            const w = worstUnder(px, s.box, s.fill !== "none" ? s.fill : s.stroke);
            m.worstFigure = Math.min(m.worstFigure, w);
            expect(w, `${PHOTOS[k % PHOTOS.length]} — dessin`).toBeGreaterThanOrEqual(PHOTO_FIGURE_CONTRAST);
          }
        }
      }
    }
    measured.push(m);
    writeFileSync("/tmp/eklio-photo-contrast.json", JSON.stringify(measured, null, 1));
  }, 240_000);
});
