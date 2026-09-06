import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── UN FICHIER À ELLE N'EST JAMAIS INVALIDÉ PAR UNE COULEUR ─────────────
 *
 * `brand_assets` sont DÉRIVÉS de ses jetons : quand la palette bouge, ils
 * deviennent périmés et se refabriquent. Son portrait n'est dérivé de rien.
 * Changer un accent ne doit pas le marquer périmé, ne doit pas le mettre en
 * file de reconstruction, et ne doit surtout pas l'effacer.
 *
 * La base le tient par l'ABSENCE de colonne (et un garde-fou de migration).
 * Ici on tient l'autre moitié : aucune surface d'upload n'appelle la machinerie
 * d'empreinte, ne lit `brand_assets`, ni ne parle de « stale ».
 */

const ROOT = resolve(__dirname, "../../..");

const UPLOAD_PATHS = [
  "lib/uploads",
  "lib/data/uploads.ts",
  "app/api/brand-kits/[id]/uploads",
  "app/app/brand-kits/[id]/uploads",
  "components/kit/uploads-view.tsx",
];

const DERIVED_MACHINERY = [
  "computeAssetFingerprint",
  "asset-fingerprint",
  "ensureAssetRendered",
  "brand_assets",
  "staleKeys",
  "superseded_at",
  "consume_generation_credit",
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(child);
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const FILES = UPLOAD_PATHS.flatMap((path) => (/\.tsx?$/.test(path) ? [path] : walk(path)));

function code(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("l'énumération elle-même", () => {
  it("trouve les fichiers du lot", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(6);
  });
});

describe("aucune surface d'upload ne touche la machinerie des fichiers dérivés", () => {
  it.each(FILES)("%s", (path) => {
    const body = code(path);
    const found = DERIVED_MACHINERY.filter((needle) => body.includes(needle));
    expect(
      found,
      `${path} touche la machinerie des fichiers dérivés : ${found.join(", ")}.\n` +
        "Ses fichiers ne sont dérivés de rien. Un changement de palette ne doit ni\n" +
        "les périmer, ni les reconstruire, ni les effacer."
    ).toEqual([]);
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    const canary = "const fp = computeAssetFingerprint(input);";
    expect(DERIVED_MACHINERY.filter((needle) => canary.includes(needle))).toEqual([
      "computeAssetFingerprint",
    ]);
  });
});

describe("les octets décident, et le SVG est nettoyé", () => {
  it("la route appelle le renifleur avant tout le reste", () => {
    const route = code("app/api/brand-kits/[id]/uploads/route.ts");
    const sniffAt = route.indexOf("sniff(");
    const requestAt = route.indexOf("requestUserUpload(");
    const uploadAt = route.indexOf(".upload(");

    expect(sniffAt).toBeGreaterThan(-1);
    // Renifler AVANT de demander un chemin, et avant d'écrire quoi que ce soit.
    expect(sniffAt).toBeLessThan(requestAt);
    expect(sniffAt).toBeLessThan(uploadAt);
  });

  it("un SVG est assaini avant l'upload, jamais après", () => {
    const route = code("app/api/brand-kits/[id]/uploads/route.ts");
    expect(route.indexOf("sanitizeSvg(")).toBeLessThan(route.indexOf(".upload("));
  });

  it("le type stocké est celui des OCTETS, pas celui annoncé", () => {
    const route = code("app/api/brand-kits/[id]/uploads/route.ts");
    // Le type annoncé ne sert qu'au signalement du désaccord.
    expect(route).toContain("sniffed.mimeType");
    expect(route).not.toContain("contentType: file.type");
    expect(route).not.toContain("p_mime_type: claimed");
  });
});
