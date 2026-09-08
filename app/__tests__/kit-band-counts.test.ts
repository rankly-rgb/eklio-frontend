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
const LIBRARY = join(ROOT, "components/kit/asset-library-view.tsx");
const PANEL = join(ROOT, "components/kit/asset-detail-panel.tsx");

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

/**
 * Les cellules déclarées par la bande, une entrée de tableau par cellule.
 *
 * ⚠ ON LIT LE TABLEAU, PAS LE JSX, et c'est le fond du sujet. Les comptes
 * étaient trois cartes bordées côte à côte — trois faits sans rapport plutôt
 * qu'une ligne d'état. Les écrire en données et les rendre par UN `map` est
 * ce qui rend « trois frères » impossible à réintroduire par distraction, et
 * c'est donc contre les données que ce fichier assère.
 */
function cellEntries(source: string): string[] {
  const body = stripComments(source);
  const start = body.indexOf("const cells = [");
  if (start === -1) return [];
  const end = body.indexOf("] as const;", start);
  return body
    .slice(start + "const cells = [".length, end)
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
}

describe("la bande ne porte aucun nombre écrit à la main", () => {
  const source = readFileSync(BAND, "utf8");
  const cells = cellEntries(source);

  it("l'énumération trouve bien les cellules", () => {
    // Sans cette garde, un tableau renommé rendrait le bloc vacuously
    // true — et c'est un bloc sur l'honnêteté des chiffres affichés.
    expect(cells.length).toBe(3);
  });

  it.each(cells.map((cell, index) => [index, cell] as const))(
    "la cellule %i tire sa valeur d'une ligne stockée",
    (_index, cell) => {
      /*
       * Deux exigences, et il faut les deux : la valeur passe par `stats.`
       * (donc par `loadAssetStats`, donc par une requête), et aucun chiffre
       * n'apparaît dans la déclaration. Le tiret de l'état « pas encore de
       * spec » est du texte, pas un nombre, et reste permis.
       */
      expect(cell).toMatch(/value: .*\bstats\./);
      expect(cell).not.toMatch(/\d/);
    }
  );

  it("⚠ le canari : une cellule en dur ferait bien échouer ce test", () => {
    const canary = 'const cells = [\n  { id: "d", label: "Total downloads", value: 1284 },\n] as const;';
    const [cell] = cellEntries(canary);
    expect(cell).toContain("1284");
    expect(/value: .*\bstats\./.test(cell)).toBe(false);
    expect(/\d/.test(cell)).toBe(true);
  });

  it("⚠ c'est UNE bande, pas trois cartes : un seul conteneur, un seul `map`", () => {
    /*
     * La forme qu'on quitte : trois `<StateTile>` frères dans une grille.
     * Un seul `cells.map(` garantit un seul conteneur ; l'absence de
     * `<StateTile` garantit qu'aucune n'a été réécrite à la main à côté.
     */
    const body = stripComments(source);
    expect([...body.matchAll(/cells\.map\(/g)]).toHaveLength(1);
    expect(body).not.toContain("<StateTile");
    expect(body).toContain("flex overflow-hidden rounded-card border border-line");
  });

  it("les cellules sont séparées par un filet, pas par un écart", () => {
    // « cellules séparées par des filets » : la première n'en porte pas, les
    // suivantes portent une bordure gauche.
    expect(stripComments(source)).toContain('index > 0 ? "border-l border-line');
  });

  it("il n'y a PAS de quatrième cellule « Total downloads »", () => {
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

/*
 * ── DEUX NOMBRES VOISINS DISENT CE QU'ILS EXCLUENT ───────────────────────
 *
 * La bande compte les fichiers rendus et à jour sous l'empreinte courante.
 * La bibliothèque, une section plus bas, ouvre sur « All assets (N) », qui
 * compte TOUTES les clés du catalogue — y compris celles jamais rendues et
 * celles devenues périmées, parce que la grille les montre aussi, avec leur
 * pastille d'état. Les deux diffèrent dès qu'un kit a l'une ou l'autre.
 *
 * « Total » à côté de « All » ne laissait aucun moyen de savoir lequel
 * excluait quelque chose. C'est le lecteur qui devinait, et deviner sur un
 * compte de fichiers est exactement ce que ce chantier a passé son temps à
 * retirer.
 */
describe("la bande et la bibliothèque ne se disputent pas le mot « tous »", () => {
  const band = stripComments(readFileSync(BAND, "utf8"));
  const library = stripComments(readFileSync(LIBRARY, "utf8"));

  it("les deux nombres viennent bien de deux ensembles différents", () => {
    // Si ça cessait d'être vrai, un seul nom suffirait -- et il faudrait
    // alors le rendre commun plutôt que de garder deux étiquettes.
    expect(band).toContain("stats.currentCount");
    expect(library).toContain("count={manifest.length}");
  });

  it("la bande nomme ce qu'elle exclut", () => {
    expect(band).toContain('label: "Assets ready"');
    expect(band).not.toContain('label: "Total assets"');
  });

  it("la bibliothèque garde « All assets », qui est vrai de son côté", () => {
    expect(library).toContain('label="All assets"');
  });
});

/*
 * ── UN COMPTEUR DIT SUR QUOI IL COMPTE ───────────────────────────────────
 *
 * `brand_assets.download_count` est porté par la ligne d'asset, et la ligne
 * est cadrée par empreinte. Le nombre est donc « les téléchargements de CE
 * rendu », et il repart de zéro au prochain changement de palette. C'est une
 * donnée honnête sous son vrai nom et un mensonge sous le nom « Downloads ».
 */
describe("les deux surfaces du compteur portent leur portée", () => {
  const panel = stripComments(readFileSync(PANEL, "utf8"));
  const library = stripComments(readFileSync(LIBRARY, "utf8"));

  it("la fiche de l'asset", () => {
    expect(panel).toContain('label="Downloads of this version"');
    expect(panel).not.toMatch(/label="Downloads"/);
  });

  it("le tri de la bibliothèque", () => {
    expect(library).toContain('downloads: "Most downloaded (this version)"');
    expect(library).not.toMatch(/downloads: "Most downloaded"/);
  });

  it("⚠ et toujours aucun cumul « depuis toujours » nulle part", () => {
    // Il n'en existe pas : il faudrait une table d'événements, pas un
    // entier plus grand.
    for (const source of [panel, library, stripComments(readFileSync(BAND, "utf8"))]) {
      expect(source).not.toMatch(/Total downloads|Lifetime downloads/i);
    }
  });
});
