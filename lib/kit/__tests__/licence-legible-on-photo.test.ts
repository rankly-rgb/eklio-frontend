import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { cardPalette, contrast, type DirectionPalette } from "@/lib/compose/palette";
import { FOOTER } from "@/lib/compose/constants-bands";
import { CANVAS } from "@/lib/compose/constants";
import { imageHref, PHOTOS, PHOTO_TEXT_CONTRAST, solveVeil, VEIL_MIN } from "@/lib/compose/decor";
import { CONTRAST_TARGET, MAX_SCRIM_OPACITY } from "@/lib/kit/render/luminance";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA MENTION DE LICENCE RESTE LISIBLE SUR UN FOND PHOTO — VÉRIFIÉ D'ABORD
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le pied de carte porte la mention de licence ; une carte qui la perd sur une
 * photo fait de la publicité sans elle. Le voile est résolu analytiquement
 * contre le pire pixel (`solveVeil`) ; ici il est MESURÉ : chaque fond du pack,
 * sous chaque palette du catalogue, claire et sombre, rastérisé sur la bande du
 * pied, et c'est le PIRE pixel — pas la moyenne — qui doit tenir 4,5:1 contre
 * l'encre du pied.
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

/** Le pire contraste, pixel par pixel, entre l'encre et le fond voilé sous la bande du pied. */
function worstUnderFooter(photo: string, veil: string, opacity: number, ink: string): number {
  const { x, y, w, h } = FOOTER;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">` +
    `<image href="${imageHref(photo)}" x="0" y="0" width="${CANVAS.width}" height="${CANVAS.height}" preserveAspectRatio="xMidYMid slice"/>` +
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${veil}" opacity="${opacity}"/></svg>`;
  const px = new Resvg(svg).render().pixels;
  let worst = Infinity;
  const seen = new Set<string>();
  for (let i = 0; i < px.length; i += 4) {
    const c = hex(px[i], px[i + 1], px[i + 2]);
    if (seen.has(c)) continue;
    seen.add(c);
    worst = Math.min(worst, contrast(ink, c));
  }
  return worst;
}

describe("le voile du fond photo", () => {
  it("le plancher est celui du texte sur photo du produit (4,5), et le voile ne dépasse pas le sien", () => {
    expect(PHOTO_TEXT_CONTRAST).toBe(CONTRAST_TARGET);
    expect(VEIL_MIN).toBeLessThanOrEqual(MAX_SCRIM_OPACITY);
  });

  it("le catalogue est lu (six familles au moins), et 27 fonds sont tirables", () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(6);
    expect(PHOTOS).toHaveLength(27);
  });

  it("provoqué : une encre trop proche du papier ne reçoit pas de photo", () => {
    expect(solveVeil("#FAF6EE", "#E8E2D6")).toBeNull();
  });
});

describe.each(FAMILIES)("$id", ({ direction }) => {
  it.each([false, true])("fond sombre : %s — la mention de licence tient 4,5:1 au pire pixel, sur chacun des 27 fonds", (dark) => {
    const palette = cardPalette("k", direction, dark);
    const veil = solveVeil(palette.paper, palette.ink);
    if (!veil) return; // pas de photo pour cette palette : la carte garde son papier
    expect(veil.opacity).toBeGreaterThanOrEqual(VEIL_MIN);
    for (const photo of PHOTOS) {
      expect(worstUnderFooter(photo, palette.paper, veil.opacity, palette.ink), photo).toBeGreaterThanOrEqual(PHOTO_TEXT_CONTRAST);
    }
  }, 60_000);
});
