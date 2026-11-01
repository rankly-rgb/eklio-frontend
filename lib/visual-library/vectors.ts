import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Inventory } from "@/lib/visual-library/inventory";
import { depositBytes } from "@/lib/visual-library/inventory";

/*
 * Les tracés que le moteur pose, extraits du SVG NETTOYÉ de chaque entrée
 * vectorielle tirable ou décorative (illustrations, formes, accents).
 *
 * ⚠ LE PACK EST HOMOGÈNE, ET ON LE VÉRIFIE AU LIEU DE LE SUPPOSER : un seul
 * <path>, `fill-rule="evenodd"`, commandes absolues M, C, L, Z. Un fichier qui
 * s'en écarte arrête la construction — le moteur transforme les coordonnées
 * une à une et ne saurait pas poser autre chose.
 */
export type Vector = {
  w: number;
  h: number;
  d: string;
  /**
   * L'épaisseur moyenne du trait, en fraction du plus grand côté — mesurée une
   * fois, à la construction (`lib/kit/render/vector-weight.ts`). Le moteur s'en sert pour
   * harmoniser le trait des dessins posés (`lib/compose/library.ts`).
   */
  weight?: number;
};

export function vectorOf(svg: string, file: string): Vector {
  const paths = svg.match(/<path\b/g) ?? [];
  if (paths.length !== 1) throw new Error(`${file} : ${paths.length} tracés, un seul attendu`);
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) throw new Error(`${file} : viewBox absent ou décalé`);
  const d = /\sd="([^"]+)"/.exec(svg)?.[1] ?? "";
  if (!/^[MCLZ0-9.,\s-]+$/.test(d)) throw new Error(`${file} : commandes hors M/C/L/Z`);
  if (!/fill-rule="evenodd"/.test(svg)) throw new Error(`${file} : fill-rule evenodd attendu`);
  return { w: Number(vb[1]), h: Number(vb[2]), d };
}

/**
 * `weigh` mesure l'épaisseur du trait (`lib/kit/render/vector-weight.ts`) : il
 * rastérise, donc il vit avec les autres rendus serveur et le script le passe.
 */
export function buildVectors(root: string, inventory: Inventory, weigh: (v: Vector) => number): Record<string, Vector> {
  const out: Record<string, Vector> = {};
  for (const e of inventory.entries) {
    if (e.ext !== "svg") continue;
    if (e.family === "illustrations" && !e.drawable) continue;
    if (e.id.startsWith("xtra-")) continue;
    const v = vectorOf(depositBytes(e.file, readFileSync(join(root, e.file))).toString("utf8"), e.file);
    out[e.id] = { ...v, weight: weigh(v) };
  }
  return out;
}
