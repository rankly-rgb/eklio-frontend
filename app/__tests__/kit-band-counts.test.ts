import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { summarizeManifest } from "@/lib/data/asset-stats";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";

/*
 * ⚠ NEVER DISPLAY A NUMBER EKLIO CANNOT MEASURE.
 *
 * The band above every kit section carries three counts. Each one has to be
 * a `select` away from a stored row — not a constant, not a length of a
 * hard-coded list, not an estimate. The failure this file exists to catch is
 * cheap and quiet: someone needs a number for a tile, the query is awkward,
 * and a plausible literal goes in instead. It reads correctly forever, and
 * it is a lie the moment a kit is not the shape the literal assumed.
 *
 * That is not hypothetical here. `Asset categories` had exactly this bug in
 * the asset library it replaced — `GROUP_ORDER.length`, a constant six, on a
 * kit whose palette might only ever have produced four groups.
 */

const ROOT = resolve(__dirname, "../..");
const BAND = join(ROOT, "components/kit/kit-header-band.tsx");

function entry(overrides: Partial<AssetManifestEntry> = {}): AssetManifestEntry {
  return {
    key: "wordmark_svg_dark",
    label: "Wordmark",
    group: "identity",
    kind: "svg",
    width: null,
    height: null,
    available_sizes: [],
    available_formats: [],
    current: true,
    asset: {
      storage_path: "kits/k1/wordmark.svg",
      byte_size: 1200,
      created_at: "2026-09-01T00:00:00Z",
      download_count: 0,
    },
    ...overrides,
  } as AssetManifestEntry;
}

describe("summarizeManifest — les trois comptes de la bande", () => {
  it("ne compte que les lignes courantes", () => {
    const stats = summarizeManifest([
      entry({ key: "a", current: true }),
      entry({ key: "b", current: true }),
      entry({ key: "c", current: false }),
    ]);
    expect(stats.currentCount).toBe(2);
  });

  it("⚠ les catégories sortent des MÊMES lignes, jamais d'une liste en dur", () => {
    /*
     * Le motif exact que ce test remplace : `GROUP_ORDER.length`, six, sur
     * un kit qui n'a produit que deux groupes. Le nombre était juste par
     * hasard sur un kit complet et faux sur tous les autres.
     */
    const stats = summarizeManifest([
      entry({ key: "a", group: "identity" }),
      entry({ key: "b", group: "identity" }),
      entry({ key: "c", group: "print" }),
    ]);
    expect(stats.categoryCount).toBe(2);
  });

  it("un groupe qui n'existe qu'en version périmée n'est pas une catégorie", () => {
    const stats = summarizeManifest([
      entry({ key: "a", group: "identity", current: true }),
      entry({ key: "b", group: "social", current: false }),
    ]);
    expect(stats.categoryCount).toBe(1);
  });

  it("« dernière mise à jour » est le plus récent horodatage stocké", () => {
    const stats = summarizeManifest([
      entry({ key: "a", asset: { ...entry().asset!, created_at: "2026-09-01T00:00:00Z" } }),
      entry({ key: "b", asset: { ...entry().asset!, created_at: "2026-09-07T00:00:00Z" } }),
      entry({ key: "c", asset: { ...entry().asset!, created_at: "2026-08-30T00:00:00Z" } }),
    ]);
    expect(stats.lastUpdated).toBe("2026-09-07T00:00:00Z");
  });

  it("un kit sans aucun rendu répond null, pas zéro", () => {
    // `null` rend « — » ; un `0` se lirait comme une date à l'époque Unix.
    const stats = summarizeManifest([entry({ current: false })]);
    expect(stats.lastUpdated).toBeNull();
    expect(stats.currentCount).toBe(0);
    expect(stats.categoryCount).toBe(0);
  });
});

/*
 * Et le pendant statique : aucune valeur de tuile n'est écrite à la main dans
 * le composant. On lit le CODE des `<StateTile>` de la bande — un commentaire
 * qui contient un chiffre ne compte pas.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Le contenu de chaque `<StateTile …>…</StateTile>` de la bande. */
function tileBodies(source: string): string[] {
  return [...stripComments(source).matchAll(/<StateTile[^>]*>([\s\S]*?)<\/StateTile>/g)].map(
    (match) => match[1]
  );
}

describe("la bande ne porte aucun nombre écrit à la main", () => {
  const source = readFileSync(BAND, "utf8");
  const bodies = tileBodies(source);

  it("l'énumération trouve bien les tuiles", () => {
    // Sans cette garde, un composant renommé rendrait le bloc vacuously
    // true — et c'est un bloc sur l'honnêteté des chiffres affichés.
    expect(bodies.length).toBe(3);
  });

  it.each(bodies.map((body, index) => [index, body] as const))(
    "la tuile %i tire sa valeur d'une ligne stockée",
    (_index, body) => {
      /*
       * Deux exigences, et il faut les deux : la valeur passe par `stats.`
       * (donc par `loadAssetStats`, donc par une requête), et aucun chiffre
       * n'apparaît dans le corps de la tuile. Le tiret de l'état « pas
       * encore de spec » est du texte, pas un nombre, et reste permis.
       */
      expect(body).toMatch(/\bstats\./);
      expect(body).not.toMatch(/\d/);
    }
  );

  it("⚠ le canari : une tuile en dur ferait bien échouer ce test", () => {
    const canary = `<StateTile label="Total downloads">1284</StateTile>`;
    const [body] = tileBodies(canary);
    expect(body).toBe("1284");
    expect(/\bstats\./.test(body)).toBe(false);
    expect(/\d/.test(body)).toBe(true);
  });

  it("il n'y a PAS de quatrième tuile « Total downloads »", () => {
    /*
     * `brand_assets.download_count` est un compteur porté par la ligne
     * d'asset, et la ligne est cadrée par empreinte : au premier changement
     * de couleur, les anciennes lignes cessent d'être courantes et le total
     * retombe à zéro. Un cumul « depuis toujours » qui se remet à zéro quand
     * elle édite sa palette n'est pas un chiffre affichable.
     */
    expect(stripComments(source)).not.toContain("Total downloads");
  });

  it("aucun aphorisme dans la bande", () => {
    // La maquette en posait un au milieu de ses propres chiffres. Placé là,
    // il se lit comme une promesse de résultat faite par son cabinet.
    expect(source).not.toMatch(/freer futures/i);
  });
});
