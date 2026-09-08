import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ⚠ THE KIT DOES NOT RENDER THE `hero` IMAGE SLOT. ANYWHERE.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 *
 * Roughly 800px of full-bleed `hero` photograph used to sit above the
 * package card, at the very top of the kit. It pushed every actionable
 * element below the fold — the counts, the checklist, the assets, all of it
 * — and the better the photograph got, the worse that was. It was never in
 * any version of the design; it accumulated.
 *
 * That kind of thing comes back. Someone wires `heroImageUrl` into the
 * aggregate again "since we already generate it", and the band reappears
 * quietly a lot faster than it went away. So the absence is asserted rather
 * than remembered.
 *
 * ⚠ THE SLOT ITSELF IS ALIVE AND MUST STAY THAT WAY. `hero` is generated,
 * stored, and rendered by the HOME screen inside a browser frame at a sane
 * size — which is where an image of her brand belongs. This file asserts
 * that too, so that "remove the band" can never be read as "stop making the
 * photograph".
 */

const ROOT = resolve(__dirname, "../..");

/** Everything the kit's route family and its components are made of. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : filesUnder(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const KIT_FILES = [
  ...filesUnder(join(ROOT, "app/app/brand-kits/[id]/(sections)")),
  ...filesUnder(join(ROOT, "components/kit")),
  join(ROOT, "lib/data/kit-page.ts"),
];

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/*
 * What we are looking for is the IMAGE SLOT named `hero`, not the word.
 * `selectedDirection.hero` is the site's hero COPY — an overline and a
 * headline — and it is read all over this route family for perfectly good
 * reasons. Matching on the word would either fail forever or force everyone
 * to rename an unrelated field.
 */
const HERO_SLOT = [
  /\bheroImageUrl\b/,
  /slot\s*===\s*["']hero["']/,
  /slot\s*:\s*["']hero["']/,
  /slot\s*=\s*["']hero["']/,
];

describe("le bandeau `hero` a quitté le kit", () => {
  it("l'énumération trouve bien les fichiers du kit", () => {
    // Sans cette garde, un répertoire renommé rendrait tout le bloc
    // vacuously true, et le bandeau pourrait revenir en silence.
    expect(KIT_FILES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(KIT_FILES.map((file) => [relative(file), file] as const))(
    "%s ne demande pas le slot `hero`",
    (path, file) => {
      const source = code(file);
      const offender = HERO_SLOT.find((pattern) => pattern.test(source));
      expect(
        offender,
        `${path} demande de nouveau le slot \`hero\`.\n` +
          "Le bandeau pleine largeur poussait tout ce qui est actionnable\n" +
          "sous la ligne de flottaison. La photo, elle, vit sur l'accueil."
      ).toBeUndefined();
    }
  );

  it("⚠ le canari : le motif attraperait bien un retour du bandeau", () => {
    const canary = 'const hero = rows.find((row) => row.slot === "hero");';
    expect(HERO_SLOT.some((pattern) => pattern.test(canary))).toBe(true);
    expect(HERO_SLOT.some((pattern) => pattern.test("heroImageUrl={model.heroImageUrl}"))).toBe(true);
  });

  it("⚠ mais le motif NE confond PAS le slot avec la copie du hero du site", () => {
    // `direction.hero` porte l'overline et le titre du site. Il est lu
    // partout ici, légitimement.
    const legitimate = "hero: kit.selectedDirection.hero, headline: hero.headline";
    expect(HERO_SLOT.some((pattern) => pattern.test(legitimate))).toBe(false);
  });
});

describe("mais le slot lui-même est toujours vivant", () => {
  it("l'accueil le rend, dans un cadre de navigateur", () => {
    /*
     * C'est la moitié qui empêche « retirer le bandeau » d'être lu comme
     * « arrêter de faire la photo ». Le pipeline la génère toujours ; c'est
     * l'accueil qui la montre, à une taille raisonnable.
     */
    const home = code(join(ROOT, "lib/data/home.ts"));
    expect(home).toContain('photoUrls.get("hero")');
    expect(home).toContain("heroPhotoUrl");

    const canvas = code(join(ROOT, "components/home/brand-canvas.tsx"));
    expect(canvas).toContain("PhotoSlot");
    expect(canvas).toContain("BrowserFrame");
  });

  it("et le catalogue des slots le déclare toujours", () => {
    expect(code(join(ROOT, "lib/images/config.ts"))).toMatch(/\bhero:\s*\{/);
  });
});
