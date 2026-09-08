import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * « Everything, zipped — every file in your brand kit, in one download, with
 * a README. »
 *
 * The band says that under the one button most therapists will ever press.
 * A sentence the archive contradicts is worse than no sentence: she opens
 * thirty-four files named `apple_touch_icon_180.png` and
 * `manifest_values_json.json` expecting something to tell her which is
 * which, and nothing does.
 *
 * So the claim is checked against the renderer that builds the archive, not
 * against anyone's memory of it — and the check is in three parts, because
 * any one of them alone would pass a broken zip: the README is written, it
 * is added to the entry list, and it is added to `brand_kit_zip`'s list
 * rather than to some other renderer's.
 */

const ROOT = resolve(__dirname, "../..");
const REGISTRY = join(ROOT, "lib/kit/render/registry.ts");
const BAND = join(ROOT, "components/kit/kit-header-band.tsx");

const source = readFileSync(REGISTRY, "utf8");

/** Le corps du rendu `brand_kit_zip`, et lui seul. */
function zipRenderer(text: string): string {
  const start = text.indexOf("brand_kit_zip: async (ctx) => {");
  expect(start, "le rendu `brand_kit_zip` a changé de forme").toBeGreaterThan(-1);
  const end = text.indexOf("\n  },", start);
  return text.slice(start, end);
}

describe("l'archive « Download everything » contient bien un README", () => {
  const body = zipRenderer(source);

  it("le texte du README existe et nomme des fichiers réels", () => {
    expect(source).toMatch(/function readmeText\s*\(/);
    // Un README qui ne nommerait rien serait un fichier vide avec un bon nom.
    expect(source).toContain("wordmark_svg_dark");
    expect(source).toContain("palette_ase");
  });

  it("il est ajouté aux entrées de l'archive", () => {
    expect(body).toMatch(/entries\.push\(\{\s*name:\s*"README\.txt"/);
    expect(body).toContain("readmeText(ctx)");
  });

  it("il part dans le zip construit, pas à côté", () => {
    // `buildZip(entries)` — le même tableau que celui où le README est poussé.
    const pushAt = body.indexOf('name: "README.txt"');
    const buildAt = body.indexOf("buildZip(entries)");
    expect(pushAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(pushAt);
  });

  it("la phrase de la bande et l'archive disent la même chose", () => {
    const band = readFileSync(BAND, "utf8");
    expect(band).toContain("with a README");
    expect(band).toContain('assetKey="brand_kit_zip"');
  });

  it("⚠ le canari : un rendu sans README ferait bien échouer ce test", () => {
    const canary = zipRenderer(
      source.replace(/entries\.push\(\{ name: "README\.txt"[^\n]*\n/, "")
    );
    expect(/entries\.push\(\{\s*name:\s*"README\.txt"/.test(canary)).toBe(false);
  });
});
