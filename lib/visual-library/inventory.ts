import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeSvg } from "@/lib/uploads/svg";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA BIBLIOTHÈQUE DE VISUELS — CE QUI EXISTE VRAIMENT, ET SOUS QUEL NOM
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le pack du 2026-11-01 (142 fichiers, `assets/visual-library/`) entre dans le
 * moteur par cet inventaire, et par lui seul.
 *
 * ⚠ LE MOTEUR NE DÉDUIT JAMAIS L'EXISTENCE D'UN FICHIER DE SON NOM. Cinq
 * identifiants de la spécification n'existent pas (shape-pebble,
 * shape-ribbon-fold, bg-marble-vein, bg-concrete-soft, bg-candle-glow) ; une
 * illustration peut être retirée demain. Ce qui est tiré l'est dans
 * `inventory.generated.json`, construit en lisant le dossier.
 *
 * ⚠ LES SVG PASSENT PAR `sanitizeSvg`, CELUI DES DÉPÔTS CLIENTS, sans recodage.
 * Un SVG refusé arrête la construction : déposer un document qu'on ne sait pas
 * nettoyer n'est pas une option. Le hachage porte sur la version NETTOYÉE —
 * c'est elle qui est déposée et lue.
 *
 * ⚠ `xtra-*` N'EST JAMAIS TIRABLE tant que `themes.csv` ne lui donne pas de
 * thèmes ; une illustration SANS thème non plus. `drawable` le dit, et rien
 * d'autre ne le décide.
 */

export const LIBRARY_DIR = "assets/visual-library";

/** Les cinq familles, dans l'ordre du pack. Le nom est celui du préfixe de dépôt. */
export const FAMILIES = {
  "01-illustrations": "illustrations",
  "02-fonds": "fonds",
  "03-textures": "textures",
  "04-formes": "formes",
  "05-accents": "accents",
} as const;
export type Family = (typeof FAMILIES)[keyof typeof FAMILIES];

export type LibraryEntry = {
  id: string;
  family: Family;
  /** Le fichier dans le dépôt, relatif à la racine. */
  file: string;
  ext: "svg" | "jpg";
  contentType: "image/svg+xml" | "image/jpeg";
  /** sha-256 du contenu DÉPOSÉ (le SVG nettoyé, le JPEG tel quel). */
  sha256: string;
  bytes: number;
  /** La clé dans le seau `content-assets`. */
  storagePath: string;
  /** Les thèmes de `themes.csv`, ou `null` — une illustration sans thème n'est jamais tirée. */
  themes: string[] | null;
  /** Tirable par le moteur : une illustration avec thèmes, hors `xtra-`. */
  drawable: boolean;
};

export type Inventory = {
  /** Les entrées, triées par famille puis identifiant : l'inventaire est déterministe. */
  entries: LibraryEntry[];
};

/** `id,"a, b, c"` — le CSV du pack : une colonne citée, des virgules dedans. */
export function parseThemesCsv(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines.slice(1)) {
    const m = /^([^,]+),(?:"([^"]*)"|(.*))$/.exec(line);
    if (!m) throw new Error(`themes.csv : ligne illisible « ${line} »`);
    const id = m[1].trim();
    const themes = (m[2] ?? m[3] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (out.has(id)) throw new Error(`themes.csv : « ${id} » apparaît deux fois`);
    out.set(id, themes);
  }
  return out;
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Le contenu à déposer : le SVG nettoyé, ou le JPEG tel quel. Lève si un SVG est refusé. */
export function depositBytes(file: string, raw: Buffer): Buffer {
  if (!file.endsWith(".svg")) return raw;
  const cleaned = sanitizeSvg(raw.toString("utf8"));
  if (!cleaned.ok) throw new Error(`${file} : SVG refusé par sanitizeSvg (${cleaned.reason})`);
  return Buffer.from(cleaned.svg, "utf8");
}

/** Construit l'inventaire en lisant le dossier. `root` est la racine du dépôt. */
export function buildInventory(root: string): Inventory {
  const dir = join(root, LIBRARY_DIR);
  const themes = parseThemesCsv(readFileSync(join(dir, "themes.csv"), "utf8"));
  const entries: LibraryEntry[] = [];
  for (const [folder, family] of Object.entries(FAMILIES) as Array<[keyof typeof FAMILIES, Family]>) {
    const files = readdirSync(join(dir, folder))
      .filter((f) => f.endsWith(".svg") || f.endsWith(".jpg"))
      .sort();
    for (const name of files) {
      const ext = name.endsWith(".svg") ? "svg" : "jpg";
      const id = name.slice(0, -(ext.length + 1));
      const file = `${LIBRARY_DIR}/${folder}/${name}`;
      const bytes = depositBytes(file, readFileSync(join(root, file)));
      const own = family === "illustrations" ? themes.get(id) ?? null : null;
      entries.push({
        id,
        family,
        file,
        ext,
        contentType: ext === "svg" ? "image/svg+xml" : "image/jpeg",
        sha256: sha256(bytes),
        bytes: bytes.length,
        storagePath: `library/${family}/${id}.${ext}`,
        themes: own && own.length > 0 ? own : null,
        drawable: family === "illustrations" && !id.startsWith("xtra-") && !!own && own.length > 0,
      });
    }
  }
  return { entries };
}
