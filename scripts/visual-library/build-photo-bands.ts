/*
 * Reconstruit `lib/visual-library/photo-bands.generated.json` : les bornes de
 * pixels de chaque fond, bande de 10px par bande, dans la géométrie de la carte
 * (`lib/kit/render/photo-bands.ts`). À relancer après tout dépôt de fond ; le
 * test de jonction échoue tant que le fichier ne correspond pas aux JPEG.
 *
 *   bun scripts/visual-library/build-photo-bands.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { measurePhotoBands } from "@/lib/kit/render/photo-bands";
import type { Inventory } from "@/lib/visual-library/inventory";

const root = join(import.meta.dirname, "..", "..");
const inventory = JSON.parse(readFileSync(join(root, "lib/visual-library/inventory.generated.json"), "utf8")) as Inventory;
const out: Record<string, { sha256: string; band: number; min: number[][]; max: number[][] }> = {};
for (const e of inventory.entries.filter((e) => e.family === "fonds" && !e.id.startsWith("xtra-")).sort((a, b) => a.id.localeCompare(b.id))) {
  const bands = await measurePhotoBands(readFileSync(join(root, e.file)));
  out[e.id] = { sha256: e.sha256, ...bands };
}
writeFileSync(join(root, "lib/visual-library/photo-bands.generated.json"), JSON.stringify(out) + "\n");
console.log(`${Object.keys(out).length} fonds mesurés`);
