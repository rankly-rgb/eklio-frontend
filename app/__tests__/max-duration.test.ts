import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/*
 * Tout ce qui porte une génération IA doit relever son `maxDuration`.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * Rien ne prévient quand un plafond manque : ça marche en local, où aucun
 * plafond ne s'applique, et ça timeoute en production. D'où ce balayage, qui
 * REMONTE la chaîne d'imports depuis chaque point d'entrée plutôt que de faire
 * confiance à une liste tenue à la main.
 *
 * ── Ce qui a changé au lot 6 ─────────────────────────────────────────────
 *
 * La génération était portée par des SERVER ACTIONS, donc par les PAGES qui
 * rendaient leur bouton (`maxDuration` s'applique « à toutes les Server
 * Actions utilisées sur la page »). Elle vit désormais dans des ROUTE
 * HANDLERS, où le plafond se pose sur la route elle-même. Le balayage couvre
 * donc `page.tsx` ET `route.ts`.
 */

const ROOT = resolve(__dirname, "../..");
const APP_DIR = join(ROOT, "app");

/*
 * Les points d'entrée d'une génération longue. Un module qui porte l'un de ces
 * noms met le fichier de route qui l'atteint sous plafond.
 */
const GENERATION_MARKERS = [
  "runGenerationPipeline",
  "suggestFieldText",
  "callGeneration",
];

/** Chaque `page.tsx` et chaque `route.ts` de l'application. */
function findEntryPoints(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findEntryPoints(full);
    return entry.name === "page.tsx" || entry.name === "route.ts" ? [full] : [];
  });
}

/** Résout un import local (`@/…` ou `./…`) vers un fichier réel. */
function resolveImport(spec: string, fromFile: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? join(dirname(fromFile), spec)
      : null;
  if (base === null) return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Remonte la chaîne d'imports locaux et dit si une génération y est atteignable. */
function reachesGeneration(entry: string): boolean {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");

    if (
      GENERATION_MARKERS.some((marker) =>
        new RegExp(`\\b${marker}\\b`).test(source)
      )
    ) {
      return true;
    }

    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1], file);
      if (resolved) queue.push(resolved);
    }
  }
  return false;
}

/** Valeur de `export const maxDuration` d'un fichier, ou `null`. */
function maxDurationOf(file: string): number | null {
  const match = readFileSync(file, "utf8").match(
    /^export const maxDuration = (\d+);?$/m
  );
  return match ? Number(match[1]) : null;
}

/*
 * Plancher. Une passe de génération a été observée à ~140 s ; le défaut des
 * plateformes serverless est très en dessous. Une simple suggestion de champ
 * est bien plus courte, d'où un plancher plus bas mais non nul.
 */
const FLOOR_SECONDS = 60;
const PIPELINE_FLOOR_SECONDS = 300;

const entryPoints = findEntryPoints(APP_DIR);
const generationEntryPoints = entryPoints.filter(reachesGeneration);

function relative(file: string): string {
  return file.slice(APP_DIR.length).replace(/\\/g, "/");
}

describe("maxDuration sur ce qui porte une génération", () => {
  it("le balayage lit bien l'arborescence", () => {
    // Sans cette garde, un balayage cassé rendrait les tests suivants
    // vacuously true — le pire des faux verts.
    expect(entryPoints.length).toBeGreaterThan(0);
    expect(generationEntryPoints.length).toBeGreaterThan(0);
  });

  it("la route qui lance la pipeline est couverte", () => {
    const routes = generationEntryPoints.map(relative);
    expect(routes).toContain("/api/briefs/[id]/generate/route.ts");
    expect(
      maxDurationOf(join(APP_DIR, "api/briefs/[id]/generate/route.ts"))
    ).toBeGreaterThanOrEqual(PIPELINE_FLOOR_SECONDS);
  });

  it.each(
    generationEntryPoints.map((file) => [relative(file), file] as const)
  )("%s relève son plafond", (_label, file) => {
    const value = maxDurationOf(file);

    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(FLOOR_SECONDS);
  });
});
