import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/*
 * Toute page qui porte une génération IA doit relever son `maxDuration`.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * Il n'y a PAS de « route de génération » à équiper. Les générations sont des
 * Server Actions, et `maxDuration` s'applique « à toutes les Server Actions
 * utilisées sur la page » (doc Next, section Server Actions) : le plafond est
 * donc porté par LA PAGE OÙ LE BOUTON EST RENDU, pas par le fichier
 * `actions.ts`, ni par le module `lib/ai/*` qui fait l'appel.
 *
 * Conséquence contre-intuitive, et c'est tout l'intérêt de ce test :
 * `generateKit` est atteignable depuis DEUX pages — `…/directions` (première
 * génération, le chemin que tout le monde traverse) et `…/kit` (régénération).
 * N'équiper que `…/kit` laisse le chemin nominal timeouter en production tout
 * en donnant l'impression que le correctif est posé.
 *
 * Le jour où quelqu'un rend un bouton de génération sur une nouvelle page — ou
 * déplace celui-ci — rien ne le préviendra : ça marchera en local, où aucun
 * plafond ne s'applique, et ça timeoutera en production. D'où ce balayage, qui
 * REMONTE la chaîne d'imports depuis chaque page plutôt que de faire confiance
 * à une liste tenue à la main.
 */

const ROOT = resolve(__dirname, "../..");
const APP_DIR = join(ROOT, "app");

/*
 * Les points d'entrée d'une génération longue. Un composant ou un module qui
 * porte l'un de ces noms met la page qui le rend sous plafond.
 */
const GENERATION_MARKERS = [
  "generateKit",
  "generateDirections",
  "generatePresence",
];

/** Toutes les `page.tsx` de l'application. */
function findPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findPages(full);
    return entry.name === "page.tsx" ? [full] : [];
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

    // La page elle-même ne compte pas comme appelante : ce sont ses imports
    // qui amènent l'action. On regarde donc les specs importés.
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1], file);
      if (!resolved) continue;

      if (
        GENERATION_MARKERS.some((marker) =>
          new RegExp(`\\b${marker}\\b`).test(source)
        ) &&
        /actions(\.ts)?$/.test(resolved)
      ) {
        return true;
      }
      queue.push(resolved);
    }

    if (
      file !== entry &&
      GENERATION_MARKERS.some((marker) => new RegExp(`\\b${marker}\\b`).test(source))
    ) {
      return true;
    }
  }
  return false;
}

/** Valeur de `export const maxDuration` d'une page, ou `null`. */
function maxDurationOf(file: string): number | null {
  const match = readFileSync(file, "utf8").match(
    /^export const maxDuration = (\d+);?$/m
  );
  return match ? Number(match[1]) : null;
}

/*
 * Plancher. La génération de kit a été observée à ~140 s pour une passe ; le
 * défaut des plateformes serverless est très en dessous. 300 est la valeur
 * retenue partout, alignée sur `…/presence`.
 */
const FLOOR_SECONDS = 300;

const pages = findPages(APP_DIR);
const generationPages = pages.filter(reachesGeneration);

describe("maxDuration sur les pages qui portent une génération", () => {
  it("trouve bien des pages de génération (le balayage n'est pas vide)", () => {
    // Sans cette garde, un balayage cassé rendrait tous les tests suivants
    // vacuously true — le pire des faux verts.
    expect(pages.length).toBeGreaterThan(0);
    expect(generationPages.length).toBeGreaterThanOrEqual(3);
  });

  it("couvre les trois pages attendues, `…/directions` comprise", () => {
    const relative = generationPages
      .map((file) => file.slice(APP_DIR.length).replace(/\\/g, "/"))
      .sort();

    /*
     * `…/directions` est la plus facile à oublier et la plus coûteuse à
     * manquer : c'est de là que part la PREMIÈRE génération de kit.
     */
    expect(relative).toContain("/app/projets/[id]/directions/page.tsx");
    expect(relative).toContain("/app/projets/[id]/kit/page.tsx");
    expect(relative).toContain("/app/projets/[id]/presence/page.tsx");
  });

  it.each(
    generationPages.map((file) => [
      file.slice(APP_DIR.length).replace(/\\/g, "/"),
      file,
    ])
  )("%s relève son plafond", (_label, file) => {
    const value = maxDurationOf(file as string);

    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(FLOOR_SECONDS);
  });
});
