/*
 * Reconstruit `lib/visual-library/inventory.generated.json` depuis
 * `assets/visual-library/`. À relancer après chaque dépôt de fichier (une
 * illustration remplacée, un thème ajouté) ; le test de jonction échoue tant
 * que l'inventaire committé ne correspond pas au dossier.
 *
 *   bun scripts/visual-library/build-inventory.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildInventory } from "@/lib/visual-library/inventory";
import { buildVectors } from "@/lib/visual-library/vectors";

const root = join(import.meta.dirname, "..", "..");
const inventory = buildInventory(root);
writeFileSync(join(root, "lib/visual-library/inventory.generated.json"), JSON.stringify(inventory, null, 1) + "\n");
const vectors = buildVectors(root, inventory);
writeFileSync(join(root, "lib/visual-library/vectors.generated.json"), JSON.stringify(vectors) + "\n");
console.log(`${Object.keys(vectors).length} tracés`);
const by = new Map<string, number>();
for (const e of inventory.entries) by.set(e.family, (by.get(e.family) ?? 0) + 1);
console.log(`${inventory.entries.length} entrées :`, Object.fromEntries(by), `— tirables : ${inventory.entries.filter((e) => e.drawable).length}`);
