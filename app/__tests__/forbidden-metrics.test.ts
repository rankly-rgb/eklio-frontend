import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * LES MÉTRIQUES QU'EKLIO NE PEUT PAS CALCULER N'EXISTENT PAS DANS L'INTERFACE.
 *
 * ── Pourquoi ce test existe, alors qu'il n'a jamais rien trouvé ──────────
 *
 * Aucune de ces chaînes n'est jamais entrée dans ce dépôt : elles vivaient
 * dans les maquettes, et le lot 1 de post-purchase-v2 a constaté qu'il n'y
 * avait rien à purger. Ce test n'est donc PAS un nettoyage — c'est une
 * GARDE. Il empêche qu'une session future les réintroduise en croyant bien
 * faire, parce qu'une maquette les montre encore.
 *
 * Chacune est un score, une note, un pourcentage de qualité, ou un compte
 * qu'aucune requête de ce produit ne sait produire. Les afficher serait
 * inventer un chiffre et le présenter comme mesuré.
 *
 * ── Ce qui reste permis, et pourquoi ────────────────────────────────────
 *
 * Le niveau de lecture (`lib/ethics/readability.ts`) est calculé de manière
 * déterministe à partir du texte lui-même — Flesch-Kincaid, affiché comme
 * « 8th grade », jamais comme un pourcentage, jamais coloré en bon/mauvais.
 * Ce n'est pas un score : c'est une mesure, et elle est reproductible.
 */

const ROOT = resolve(__dirname, "../..");
const SCANNED_DIRS = ["app", "components"];

/**
 * Les cinq interdites, telles que le brief les nomme. Insensible à la
 * casse : « brand clarity » réintroduit en minuscules est le même chiffre
 * inventé que « Brand clarity ».
 */
const FORBIDDEN = [
  "Brand clarity",
  "Average rating",
  "Voice match",
  "Clients this month",
  "Authentic approach",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") return [];
      return sourceFiles(full);
    }
    // Ce fichier-ci porte les chaînes par nécessité — c'est lui qui les
    // interdit. Il est le seul endroit du dépôt où elles ont le droit
    // d'apparaître.
    if (full === __filename) return [];
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const FILES = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

describe("l'énumération elle-même", () => {
  it("balaye bien des fichiers", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — exactement le faux vert que ce test doit rendre impossible.
    expect(FILES.length).toBeGreaterThan(50);
  });
});

describe("aucune métrique inventée n'est affichée", () => {
  it.each(FORBIDDEN)("« %s » n'apparaît nulle part dans app/ ni components/", (phrase) => {
    const needle = phrase.toLowerCase();
    const offenders = FILES.filter((file) =>
      readFileSync(file, "utf8").toLowerCase().includes(needle)
    ).map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"));

    expect(
      offenders,
      `« ${phrase} » est un chiffre qu'Eklio ne calcule à partir d'aucune de ses lignes.\n` +
        "Ce n'est pas une question de formulation : il n'y a pas de version plus\n" +
        "douce d'un score inventé. Si le besoin derrière est réel, il faut d'abord\n" +
        "la requête qui le produit — puis le libellé qui la nomme.\n" +
        `Trouvé dans : ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
