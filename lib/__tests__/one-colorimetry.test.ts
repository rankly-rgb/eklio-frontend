import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UNE SEULE COLORIMÉTRIE DANS TOUT LE PRODUIT (F99, 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * lib/compose/palette.ts portait sa propre luminance, fausse (le bleu non
 * linéarisé) ; lib/kit/render/luminance.ts une autre, juste mais recopiée ;
 * lib/brand/shapes.ts une luma gamma qui décidait un contraste. Trois mesures
 * d'une même grandeur, branchées chacune d'un côté — la classe de défaut F27.
 *
 * Ce test LIT LE CODE SOURCE : il n'y a pas de liste de fichiers à tenir à jour.
 * Un fichier qui porte l'un des trois gestes d'une implémentation — les poids de
 * luminance, la fonction de transfert sRGB, le rapport WCAG — ailleurs que dans
 * lib/brand/color.ts le fait échouer.
 */
const ROOT = join(__dirname, "..", "..");
const SCAN = ["lib", "app", "components", "scripts"];
const HOME = "lib/brand/color.ts";

const GESTURES: Array<{ name: string; re: RegExp }> = [
  { name: "poids de luminance (0,2126 R)", re: /0\.2126/ },
  { name: "fonction de transfert sRGB (seuil 0,03928 / 0,04045)", re: /0\.0(?:3928|4045)/ },
  { name: "rapport de contraste WCAG ((L1 + 0,05) / (L2 + 0,05))", re: /\+\s*0\.05\s*\)\s*\/\s*\(/ },
];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

export function implementationsIn(text: string): string[] {
  return GESTURES.filter((g) => g.re.test(text)).map((g) => g.name);
}

describe("la colorimétrie n'a qu'une maison", () => {
  const files = SCAN.flatMap((d) => sources(join(ROOT, d)));

  it("le parcours lit bien le produit (des centaines de fichiers, dont la maison)", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.map((f) => relative(ROOT, f))).toContain(HOME);
    expect(implementationsIn(readFileSync(join(ROOT, HOME), "utf8")).length).toBe(GESTURES.length);
  });

  it("aucune seconde implémentation de la luminance ou du contraste", () => {
    const offenders = files
      .map((f) => ({ file: relative(ROOT, f), found: implementationsIn(readFileSync(f, "utf8")) }))
      .filter((x) => x.file !== HOME && x.found.length > 0);
    expect(offenders).toEqual([]);
  });

  it("provoqué : la luminance d'avant F99 serait vue", () => {
    const before = `export function luminance(hex: string): number {
  const n = parseInt(m[1], 16);
  const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * (n & 255);
}
export function contrast(a: string, b: string): number { return (hi + 0.05) / (lo + 0.05); }`;
    expect(implementationsIn(before)).toHaveLength(3);
  });
});
