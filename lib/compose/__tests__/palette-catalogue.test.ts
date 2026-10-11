import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  cardPalette,
  colourDistance,
  contrast,
  mix,
  TINT_INK_MIN_CONTRAST,
  TINT_MIN_DISTANCE,
  type DirectionPalette,
} from "@/lib/compose/palette";
import type { Palette } from "@/lib/compose/types";
import { checkTints } from "@/lib/content/month-checks";
import { composeCard } from "@/lib/content/month/compose-card";
import { FIXTURE_CATALOG } from "@/lib/brief/fixtures/catalog";

/*
 * ── ⚠ TOUTES LES FAMILLES DU CATALOGUE PASSENT LE CONTRÔLE DE TEINTES (F72) ──
 *
 * Mesuré le 2026-10-04 : trois des six familles échouaient en fond clair et
 * quatre en fond sombre. Une praticienne sur deux voyait ses diagrammes tomber
 * au portillon, et AUCUN test ne le voyait : ceux de l'orchestrateur ne
 * composent que des `single_statement`, sur la palette de référence.
 *
 * Le catalogue est lu là où il vit, dans la migration qui l'insère, et pas
 * recopié ici : une famille ajoutée au catalogue entre dans ce test sans qu'on
 * y pense. Les cartes sont COMPOSÉES, et le contrôle lit le SVG, comme au
 * portillon.
 */

const MIGRATIONS = "../eklio-backend/supabase/migrations";
const ROLES = ["primary", "secondary", "light", "dark", "paper"] as const;

function catalogue(): Array<{ id: string; direction: DirectionPalette }> {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  const out: Array<{ id: string; direction: DirectionPalette }> = [];
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
    /*
     * ⚠ UNE MIGRATION QUI RÉÉCRIRAIT UN RÔLE ÉCHAPPERAIT À CETTE LECTURE. Elle
     * doit faire échouer le test plutôt que passer inaperçue.
     */
    expect(sql, `${file} réécrit un rôle de palette : ce test doit apprendre à le lire`).not.toMatch(
      /update\s+public\.palette_families\s+set\s+(?:[^;]*,\s*)?(primary|secondary|light|dark|paper)_hex\s*=/i
    );
    const insert = /insert into public\.palette_families[\s\S]*?;/i.exec(sql);
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

const item = (label: string, gloss: string) => ({ label, gloss });
const DIAGRAMS: Record<string, unknown> = {
  quadrant_model: {
    axis_x: "effort",
    axis_y: "rest",
    items: [
      item("Sunday dread", "starts before the alarm"),
      item("Rest fails", "the body stays braced"),
      item("Still bracing", "nothing asked it to"),
      item("Sleep breaks", "waking at four"),
    ],
  },
  cycle: { nodes: [item("Push harder", "the list gets done"), item("Run empty", "nothing left by Friday"), item("Brace again", "Monday asks the same")] },
  concentric_control: { rings: [item("The workload", "not yours to set"), item("The pace", "partly yours to set"), item("The stopping", "entirely yours")] },
  comparison_pair: {
    left: [item("Looks fine", "shows up on time"), item("Sounds steady", "answers every message")],
    right: [item("Feels braced", "shoulders never drop"), item("Sleeps light", "awake before the alarm")],
  },
  surface_and_beneath: { surface: item("Handling it", "every deadline met"), beneath: item("Running empty", "no memory of resting") },
};

function svgFor(archetype: string, palette: Palette): string {
  return composeCard({
    archetype,
    payload: DIAGRAMS[archetype],
    palette,
    eyebrow: "EDUCATE",
    headline: "Rest is not a reward",
    footer: "Rowan Mercier Therapy · LMFT 123456",
    licenceMention: "LMFT 123456",
  }).svg;
}

describe("le catalogue est lu dans la migration, et il est entier", () => {
  it("six familles, et ce sont celles de la grille du formulaire", () => {
    expect(FAMILIES.map((f) => f.id)).toEqual(FIXTURE_CATALOG.paletteFamilies.map((f) => f.id));
    for (const f of FAMILIES) {
      const fixture = FIXTURE_CATALOG.paletteFamilies.find((x) => x.id === f.id)!;
      for (const role of ROLES) expect(f.direction[role].toUpperCase()).toBe(fixture[`${role}_hex`].toUpperCase());
    }
  });
});

describe.each(FAMILIES)("$id", ({ direction }) => {
  it.each([false, true])("fond sombre : %s — chaque diagramme passe le contrôle de teintes", (dark) => {
    const palette = cardPalette("k", direction, dark);
    for (const archetype of Object.keys(DIAGRAMS)) {
      expect(checkTints(svgFor(archetype, palette), direction), archetype).toEqual([]);
    }
  });

  it.each([false, true])("fond sombre : %s — quatre aplats distincts, chacun lisible sous son encre", (dark) => {
    const palette = cardPalette("k", direction, dark);
    expect(palette.tints).toHaveLength(4);
    expect(palette.inkOnTints).toHaveLength(4);
    for (let i = 0; i < 4; i += 1) {
      expect(contrast(palette.tints[i], palette.inkOnTints[i])).toBeGreaterThanOrEqual(TINT_INK_MIN_CONTRAST);
      expect([direction.dark, direction.paper]).toContain(palette.inkOnTints[i]);
      for (let j = i + 1; j < 4; j += 1) {
        expect(colourDistance(palette.tints[i], palette.tints[j])).toBeGreaterThanOrEqual(TINT_MIN_DISTANCE);
      }
    }
  });
});

describe("⚠ le test sait échouer", () => {
  /*
   * Les taux fixes d'avant F72, rejoués à la main sur slate : le même contrôle,
   * sur le même diagramme, doit refuser. Sans ce cas, un `checkTints` qui ne
   * regarderait plus rien laisserait ce fichier vert.
   */
  it("les taux fixes d'avant font tomber slate au portillon", () => {
    const slate = FAMILIES.find((f) => f.id === "slate_bone")!.direction;
    const before = cardPalette("k", slate, false);
    const fixed: Palette = {
      ...before,
      tints: [
        mix(slate.light, slate.dark, 0.1),
        mix(slate.secondary, slate.paper, 0.42),
        mix(slate.primary, slate.paper, 0.52),
        mix(slate.dark, slate.paper, 0.62),
      ],
    };
    expect(checkTints(svgFor("quadrant_model", fixed), slate).map((f) => f.check)).toContain("tints.tooClose");
  });
});
