import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/*
 * ⚠ RIEN SUR `/app` NE VIENT D'UNE FIXTURE.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 *
 * L'accueil affiche des chiffres : des compteurs d'actifs, des pages prêtes,
 * une date de reconstruction, sept étapes, des dates de publication. Chacun
 * n'a de valeur que parce qu'il sort du CHEMIN DE LECTURE DE PRODUCTION. Le
 * jour où l'un d'eux vient d'un module d'exemple, l'écran continue de
 * s'afficher — mieux, même, puisqu'une fixture est toujours complète — et
 * plus rien ne le signale.
 *
 * C'est le mode de défaillance que ni une capture d'écran ni une revue ne
 * rattrapent : une maquette remplie de fausses données est plus jolie que la
 * vérité, et se lit exactement pareil.
 *
 * La garde suit donc le GRAPHE D'IMPORTS RÉEL depuis `app/app/page.tsx` —
 * transitivement, à travers les alias `@/` — et refuse tout module dont le
 * chemin se présente comme un échantillon. Un composant nouveau est couvert
 * dès qu'il est branché, sans que personne pense à l'ajouter ici.
 */

const ROOT = resolve(__dirname, "../..");
const ENTRY = join(ROOT, "app/app/page.tsx");

/*
 * Ce à quoi ressemble un module qui n'est pas le chemin de production.
 *
 * ⚠ LES BORNES COMPTENT DANS LES DEUX SENS. Ancrer sur « / » seul laissait
 * passer `__fixtures__/` et `demo-card.tsx`, qui sont exactement les deux
 * formes que ce dépôt emploierait. Les séparateurs admis sont donc `/`, `_`
 * et `-` — ce qui garde `resample.ts` hors du filet, où il doit rester : le
 * mot doit être un SEGMENT, pas une sous-chaîne.
 */
const NOT_PRODUCTION =
  /(^|[/_-])(fixtures?|mocks?|seeds?|demos?|samples?|stubs?|dummy|faker)([./_-]|$)/i;

/*
 * LA SEULE EXCEPTION, ET ELLE EST NOMMÉE.
 *
 * `lib/brand/sample.ts` est la maquette d'illustration de l'état vide : elle
 * se dessine quand il n'y a AUCUNE marque, donc aucune donnée qu'elle
 * pourrait déguiser. Elle est listée dans FINDINGS.md — qu'une illustration
 * de démonstration ait sa place sur cette route est une question produit, pas
 * une question de chantier.
 *
 * La longueur est assertée : une deuxième exception ne peut pas se glisser
 * ici en passant pour la première.
 */
const ALLOWED = ["lib/brand/sample.ts"];

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

/** `@/lib/x` et `./x` → un fichier réel, ou `null` pour un paquet npm. */
function resolveImport(specifier: string, importer: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(importer), specifier);
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        if (readFileSync(candidate).length >= 0) return candidate;
      } catch {
        // Un répertoire : on continue vers ses candidats `index`.
      }
    }
  }
  return null;
}

const IMPORT = /(?:from|import)\s*["']([^"']+)["']/g;

/** Tout ce que l'accueil finit par charger, transitivement. */
function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT)) {
      const resolved = resolveImport(match[1], file);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }

  return [...seen];
}

const GRAPH = importGraph(ENTRY);

describe("l'accueil ne lit que le chemin de production", () => {
  it("le graphe est bien celui d'un écran entier", () => {
    /*
     * Sans ça, un alias cassé ou un point d'entrée renommé réduirait le
     * graphe à un fichier et la garde passerait au vert en n'ayant rien
     * regardé — le faux vert exact que ce test doit rendre impossible.
     */
    expect(GRAPH.length).toBeGreaterThan(40);
    expect(GRAPH.map(relative)).toContain("components/home/home-view.tsx");
    expect(GRAPH.map(relative)).toContain("lib/data/home.ts");
  });

  it("aucun module d'échantillon, de mock ou de seed n'y entre", () => {
    const offenders = GRAPH.map(relative)
      .filter((path) => NOT_PRODUCTION.test(path))
      .filter((path) => !ALLOWED.includes(path));

    expect(
      offenders,
      "Un module d'échantillon est chargé par `/app`.\n" +
        "Tout ce que cet écran affiche doit venir du chemin de lecture de\n" +
        "production : une fixture rend l'écran plus beau et plus faux, et\n" +
        "aucune relecture ne rattrape ça.\n" +
        `Trouvé : ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("⚠ l'exception reste unique et nommée", () => {
    expect(ALLOWED).toHaveLength(1);
    expect(GRAPH.map(relative)).toContain(ALLOWED[0]);
  });

  it("⚠ le canari : le motif attrape bien ce qu'il vise", () => {
    for (const path of [
      "lib/brand/sample.ts",
      "lib/data/__fixtures__/home.ts",
      "components/home/demo-card.tsx",
      "lib/test/mocks/supabase.ts",
      "supabase/seed.ts",
      "lib/x/stubs.ts",
    ]) {
      expect(NOT_PRODUCTION.test(path), path).toBe(true);
    }
  });

  it("⚠ mais il n'attrape pas un module de production au nom voisin", () => {
    for (const path of [
      "lib/data/home.ts",
      "components/home/rail.tsx",
      "lib/kit/asset-rpc.ts",
      // « example » n'est pas dans la liste, et « resample » ne doit pas
      // être lu comme « sample » : le motif est ancré sur les séparateurs.
      "lib/images/resample.ts",
      "lib/site/sampler-free.ts",
    ]) {
      expect(NOT_PRODUCTION.test(path), path).toBe(false);
    }
  });
});
