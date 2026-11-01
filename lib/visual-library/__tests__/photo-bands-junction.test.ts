import { describe, expect, it } from "vitest";
import bands from "@/lib/visual-library/photo-bands.generated.json";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { PHOTOS } from "@/lib/compose/decor";

/*
 * Les bornes de pixels lues par le voile local doivent être celles des JPEG du
 * dépôt : un fond remplacé sans relancer `build-photo-bands.ts` protégerait le
 * texte contre les pixels d'une autre image.
 */
describe("les bornes mesurées correspondent aux fonds", () => {
  const B = bands as Record<string, { sha256: string; band: number; min: number[][]; max: number[][] }>;
  const entries = (inventoryJson as Inventory).entries;

  it("un jeu de bornes par fond tirable, et rien d'autre", () => {
    expect(Object.keys(B).sort()).toEqual([...PHOTOS].sort());
  });

  it("chaque jeu porte l'empreinte du JPEG de l'inventaire, en 135 bandes de 10px", () => {
    for (const id of PHOTOS) {
      expect(B[id].sha256, id).toBe(entries.find((e) => e.id === id)!.sha256);
      expect(B[id].min).toHaveLength(135);
      expect(B[id].band).toBe(10);
    }
  });
});
