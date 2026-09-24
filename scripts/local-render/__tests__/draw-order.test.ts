import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";

/*
 * ── ⚠ L'ORDRE DES FAMILLES DÉCIDE QUELS FORMATS UN MOIS PEUT PORTER ────
 *
 * Mesuré le 2026-09-23 sur deux mois livrés : ZÉRO CARROUSEL SUR SOIXANTE
 * POSTS, avec vingt-trois carrousels libres en banque. Les cinq tirés ont été
 * refusés comme redondants, au tirage.
 *
 * `redundantAgainst` compare un titre à tous ceux déjà acceptés, sans regarder
 * le FORMAT. La famille tirée en dernier affronte donc les trente-six titres
 * des deux premières. Les rejets suivaient l'ordre de tirage au rejet près :
 * statement 7, simple 15, varied 23.
 *
 * Ce n'était pas un manque de stock, c'était un ordre de passage — et les
 * formats larges, ceux que les références utilisent le plus, étaient éliminés
 * par construction.
 *
 * ⚠ CE TEST N'A PU ÊTRE ÉCRIT QUE PARCE QUE LE RAPPORT DE REJET NOMME
 * L'ARCHÉTYPE. Avant, « aucun carrousel tiré » et « cinq carrousels refusés »
 * se ressemblaient — et ils demandent deux corrections opposées.
 */
const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

describe("le tirage ne condamne pas un format par son rang", () => {
  it("les formats larges passent avant les phrases seules", () => {
    const order = SOURCE.slice(SOURCE.indexOf("const DRAW_ORDER = ["));
    const line = order.slice(0, order.indexOf(";"));
    expect(line.indexOf("varied")).toBeLessThan(line.indexOf("simple"));
    expect(line.indexOf("simple")).toBeLessThan(line.indexOf("statement"));
  });

  it("la boucle de tirage suit DRAW_ORDER, pas l'ordre de l'objet", () => {
    expect(SOURCE).toContain("for (const family of DRAW_ORDER) {");
    expect(SOURCE).not.toContain("for (const [family, archetypes] of Object.entries(FAMILIES))");
  });

  /*
   * Les trois familles sont tirées : en oublier une reviendrait à supprimer
   * silencieusement un tiers du mélange.
   */
  it("aucune famille ne sort de l'ordre de tirage", () => {
    const order = SOURCE.slice(SOURCE.indexOf("const DRAW_ORDER = ["));
    const line = order.slice(0, order.indexOf(";"));
    const families = Object.keys(FORMAT_FAMILIES);
    expect(families).toHaveLength(3);
    for (const f of families) expect(line).toContain(`"${f}"`);
  });

  /*
   * ── ⚠ LE TIRAGE ET LE PLANCHER LISENT LA MÊME LISTE ───────────────────
   *
   * Le plancher par format se calcule sur la part que le tirage VISE. Deux
   * listes de familles tenues à la main auraient divergé au premier archétype
   * ajouté, et le plancher aurait alors mesuré une composition que personne ne
   * vise — un contrôle qui refuse un mois conforme, ou qui en laisse passer un
   * qui ne l'est pas.
   */
  it("les poids de tirage ne portent que les formats de leur famille", () => {
    expect(SOURCE).toContain("Object.entries(FORMAT_FAMILIES).map(([family, keys])");
    for (const [family, keys] of Object.entries(FORMAT_FAMILIES)) {
      const drawn = family === "varied" ? [keys[0], keys[1], keys[0], ...keys.slice(2)] : [...keys];
      expect(new Set(drawn), family).toEqual(new Set(keys));
    }
  });

  /*
   * ⚠ ET LE POIDS DOUBLE DU CARROUSEL RESTE UN POIDS. Il est tiré deux fois
   * par tour parce qu'il se perd à la validation plus souvent que les autres —
   * il ne compte pas double dans la composition, que `FORMAT_FAMILIES` dit.
   */
  it("le carrousel pèse double au tirage, pas dans la composition", () => {
    expect(FORMAT_FAMILIES.varied.filter((k) => k === "carousel")).toHaveLength(1);
    expect(SOURCE).toContain('family === "varied" ? [keys[0], keys[1], keys[0], ...keys.slice(2)]');
  });

  it("le motif de rejet nomme l'archétype", () => {
    expect(SOURCE).toContain("archetype: string; because: string }> = [];");
    expect(SOURCE).not.toMatch(/rejected\.push\(\{ title: topic\.title, because:/);
  });
});
