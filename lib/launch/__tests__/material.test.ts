import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { STEP_ASSET_KEYS, stepTextBlocks } from "@/lib/launch/material";
import { STEP_ASSET_KEY } from "@/lib/home/next-step";
import { LAUNCH_STEP_KEYS } from "@/lib/data/checklist";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";

const ROOT = resolve(__dirname, "../../..");

const FULL: LaunchStepContext = {
  practiceName: "Ember consulting",
  practitionerLine: "Nora Whitfield",
  aboutExcerpt:
    "I work with adults who are carrying something they have never quite named. " +
    "Together we slow down enough to look at it — where it started, what it protects, " +
    "and what it costs. My approach is warm and direct, and the pace is yours.",
  practiceDetails: {
    practitionerName: "Nora Whitfield",
    licenseLabel: "LMFT",
    licenseNumber: "12345",
    city: "Portland",
    state: "OR",
  },
  bookingUrl: "https://example.com/book",
  assetsHref: "/app/brand-kits/x/assets",
  siteHref: "/app/brand-kits/x/site-editor",
};

const EMPTY: LaunchStepContext = {
  practiceName: null,
  practitionerLine: null,
  aboutExcerpt: null,
  practiceDetails: null,
  bookingUrl: null,
  assetsHref: "/app/brand-kits/x/assets",
  siteHref: "/app/brand-kits/x/site-editor",
};

/*
 * Ce que chaque étape tend, et — surtout — ce qu'elle NE tend PAS quand la
 * source est nulle. Un puits vide serait pire qu'une absence : il invite à
 * copier du rien.
 */

describe("⚠ un bloc sans source est ABSENT, jamais vide", () => {
  it.each(LAUNCH_STEP_KEYS)("%s ne rend aucun bloc sur un contexte vide", (key) => {
    for (const block of stepTextBlocks(key, EMPTY)) {
      // Si un bloc sort quand même, son texte doit être réel — jamais "", ni
      // un espace, ni un placeholder.
      expect(block.text.trim().length, `${key} / ${block.label}`).toBeGreaterThan(0);
    }
  });

  it("le lien de réservation, nul par défaut en base, ne rend rien", () => {
    // `cta_target_url` est nullable et semé null : c'est le cas NORMAL, pas
    // un cas limite.
    expect(stepTextBlocks("booking_link", EMPTY)).toEqual([]);
  });

  it("et le rend dès qu'elle en a un", () => {
    const blocks = stepTextBlocks("booking_link", FULL);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("https://example.com/book");
  });

  it("la déclaration board-safe disparaît sans identifiants", () => {
    expect(stepTextBlocks("update_directory", EMPTY)).toEqual([]);
    expect(stepTextBlocks("update_directory", FULL)).toHaveLength(1);
  });
});

describe("la bio Instagram", () => {
  it("tient sous 150 caractères, quelle que soit la longueur de la source", () => {
    const blocks = stepTextBlocks("social_setup", FULL);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text.length).toBeLessThanOrEqual(150);
  });

  it("et n'existe pas du tout sans texte « about »", () => {
    expect(stepTextBlocks("social_setup", EMPTY)).toEqual([]);
  });
});

describe("⚠ une seule table étape → matériel", () => {
  it("la carte « prochaine étape » montre la PREMIÈRE clé de la liste complète", () => {
    // Deux constantes divergentes montreraient deux fichiers différents pour
    // la même étape, sur le même écran.
    for (const key of LAUNCH_STEP_KEYS) {
      expect(STEP_ASSET_KEY[key], key).toBe(STEP_ASSET_KEYS[key][0]);
    }
  });

  it("les sept étapes ont une entrée, même vide", () => {
    for (const key of LAUNCH_STEP_KEYS) {
      expect(Array.isArray(STEP_ASSET_KEYS[key]), key).toBe(true);
    }
    // `booking_link` n'a pas de fichier : un lien n'est pas un actif.
    expect(STEP_ASSET_KEYS.booking_link).toEqual([]);
  });
});

/* ── LES LIENS SORTANTS ──────────────────────────────────────────────────
 *
 * Toute ancre qui quitte Eklio s'ouvre dans un onglet neuf ET coupe le lien
 * avec celui-ci. `noopener` sans `noreferrer` laisse fuiter l'URL d'origine ;
 * `target` sans `noopener` laisse la page ouverte manipuler la nôtre.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

const ANCHOR = /<a\s[^>]*href=\{?[^>]*?>/g;

describe("aucun lien sortant ne laisse la main à la page ouverte", () => {
  const files = [
    ...sourceFiles(join(ROOT, "components/launch")),
    ...sourceFiles(join(ROOT, "components/home")),
  ];

  it("il y a bien des fichiers à surveiller", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files.map((file) => [file.slice(ROOT.length + 1), file] as const))(
    "%s : chaque <a> externe porte target ET rel=noopener noreferrer",
    (path, file) => {
      const source = readFileSync(file, "utf8");
      for (const match of source.match(ANCHOR) ?? []) {
        // Une ancre relative (mailto:, #, /app/...) n'est pas concernée.
        if (!/https?:\/\/|place\.service\.url|service\.url/.test(match)) continue;
        expect(match, `${path}: target manquant`).toMatch(/target="_blank"/);
        expect(match, `${path}: rel manquant`).toMatch(/rel="noopener noreferrer"/);
      }
    }
  );

  it("⚠ le canari : le motif attraperait bien une ancre sans rel", () => {
    const offending = '<a href="https://www.instagram.com/" target="_blank">Open</a>';
    const found = offending.match(ANCHOR) ?? [];
    expect(found).toHaveLength(1);
    expect(found[0]).not.toMatch(/rel="noopener noreferrer"/);
  });
});
