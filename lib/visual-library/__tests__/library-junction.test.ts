import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import { buildInventory, LIBRARY_DIR, parseThemesCsv, type Inventory } from "@/lib/visual-library/inventory";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA JONCTION QUI SE CASSERAIT EN SILENCE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Une illustration retirée, un thème qui pointe dans le vide — et le moteur
 * refuse de composer sans qu'on sache pourquoi. Ce fichier le dit avant.
 */
const ROOT = join(__dirname, "..", "..", "..");
const DIR = join(ROOT, LIBRARY_DIR);
const themes = parseThemesCsv(readFileSync(join(DIR, "themes.csv"), "utf8"));
const illustrations = readdirSync(join(DIR, "01-illustrations"))
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.slice(0, -4));
const committed = inventoryJson as Inventory;

describe("themes.csv et le dossier des illustrations disent la même chose", () => {
  it("chaque identifiant de themes.csv existe dans 01-illustrations", () => {
    const missing = [...themes.keys()].filter((id) => !illustrations.includes(id));
    expect(missing, "themes.csv pointe vers des dessins absents").toEqual([]);
  });

  it("chaque illustration hors xtra- a des thèmes", () => {
    const orphans = illustrations.filter((id) => !id.startsWith("xtra-") && !themes.has(id));
    expect(orphans, "des dessins qu'aucun thème ne peut faire tirer").toEqual([]);
  });

  it("aucun xtra- n'a de thème — et aucun n'est tirable", () => {
    expect([...themes.keys()].filter((id) => id.startsWith("xtra-"))).toEqual([]);
    for (const e of committed.entries.filter((x) => x.id.startsWith("xtra-"))) expect(e.drawable, e.id).toBe(false);
  });

  it("les cinq identifiants manquants du pack ne sont nulle part supposés présents", () => {
    const ids = committed.entries.map((e) => e.id);
    for (const absent of ["shape-pebble", "shape-ribbon-fold", "bg-marble-vein", "bg-concrete-soft", "bg-candle-glow"]) {
      expect(ids).not.toContain(absent);
    }
  });

  it("64 illustrations tirables, 142 fichiers, aucun PNG", () => {
    expect(committed.entries.filter((e) => e.drawable)).toHaveLength(64);
    expect(committed.entries).toHaveLength(142);
    expect(committed.entries.some((e) => e.file.endsWith(".png"))).toBe(false);
  });

  it("les six dessins à reprendre sont intégrés comme les autres", () => {
    for (const id of ["emdr-lighthouse", "practice-notebook", "agency-open-gate", "practice-doorway", "practice-two-cups", "eft-nest"]) {
      expect(committed.entries.find((e) => e.id === id)?.drawable, id).toBe(true);
    }
  });
});

describe("l'inventaire lu par le moteur est celui du dossier", () => {
  it("inventory.generated.json est à jour — sinon : bun scripts/visual-library/build-inventory.ts", () => {
    expect(buildInventory(ROOT)).toEqual(committed);
  });

  it("chaque entrée a une clé de dépôt sous library/<famille>/", () => {
    for (const e of committed.entries) expect(e.storagePath).toBe(`library/${e.family}/${e.id}.${e.ext}`);
  });
});
