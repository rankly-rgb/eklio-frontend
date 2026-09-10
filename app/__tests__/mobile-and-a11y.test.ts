import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── LOT 11 : CE QUI CASSE SUR UN TÉLÉPHONE, ET CE QUI CASSE AU CLAVIER ──
 *
 * Deux familles de pannes qui ne se voient jamais en développement, parce que
 * la fenêtre est large et la souris est là :
 *
 *   1. UNE GRILLE SANS REPLI. `grid-cols-7` sur un écran de 375 px donne des
 *      cellules de 40 px : illisibles et intappables. Chaque grille de ce
 *      chantier doit dire ce qu'elle devient en petit.
 *   2. UNE BOÎTE DE DIALOGUE SANS ÉCHAPPEMENT. Une surface `role="dialog"`
 *      sans touche Échap enferme un utilisateur au clavier derrière elle : la
 *      seule sortie est une souris.
 *
 * On vérifie aussi qu'un message d'erreur est ANNONCÉ (`role="alert"`) partout
 * où une requête peut échouer : une erreur qui n'apparaît que visuellement
 * n'existe pas pour un lecteur d'écran.
 */

const ROOT = resolve(__dirname, "../..");

/** Les surfaces de ce chantier. */
const SURFACES = [
  "components/content",
  "components/check",
  "components/launch",
  "components/kit/uploads-view.tsx",
  "components/kit/handoff-view.tsx",
  "components/kit/kit-rail.tsx",
  "components/kit/kit-header-band.tsx",
  "components/kit/asset-library-view.tsx",
  "components/kit/asset-detail-panel.tsx",
  "components/home/content-grid.tsx",
];

const PAGES = [
  "app/app/content/page.tsx",
  "app/app/content/[id]/page.tsx",
  "app/app/content/log/page.tsx",
  "app/app/launch/page.tsx",
  "app/app/launch/[stepKey]/page.tsx",
  "app/app/check/page.tsx",
  "app/app/brand-kits/[id]/handoff/page.tsx",
  "app/app/brand-kits/[id]/uploads/page.tsx",
  /*
   * Le shell des sections du kit, et pas ses sept pages : c'est LUI qui porte
   * la gouttière, une fois, pour toutes les sections qu'il enveloppe.
   */
  "app/app/brand-kits/[id]/(sections)/layout.tsx",
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(child);
    return /\.tsx$/.test(entry.name) ? [child] : [];
  });
}

const FILES = SURFACES.flatMap((path) => (/\.tsx$/.test(path) ? [path] : walk(path)));

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/*
 * On lit du CODE, pas de la prose — la même règle que
 * `brand-kit-entitlement.test.ts`. Un fichier qui EXPLIQUE en commentaire
 * pourquoi il ne pose pas `role="dialog"` se faisait compter comme en posant
 * un, et devait alors prouver un `aria-modal` qu'il a raison de ne pas avoir.
 */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("l'énumération elle-même", () => {
  it("trouve les surfaces et les pages", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(6);
    expect(PAGES.length).toBe(9);
    for (const page of PAGES) expect(source(page).length).toBeGreaterThan(200);
  });
});

describe("une grille dit ce qu'elle devient en petit", () => {
  it.each(FILES)("%s", (path) => {
    const body = source(path);
    // Chaque `grid-cols-N` fixe doit être accompagné d'un repli responsive
    // dans le même fichier : `max-md:`, `md:` ou `max-lg:`.
    const fixedGrids = body.match(/\bgrid-cols-\d+/g) ?? [];
    if (fixedGrids.length === 0) return;

    expect(
      /\b(max-md:|max-lg:|md:|sm:)/.test(body),
      `${path} pose une grille fixe (${fixedGrids.join(", ")}) sans dire ce\n` +
        "qu'elle devient sur un téléphone. Des cellules de 40 px ne se lisent\n" +
        "ni ne se tapent."
    ).toBe(true);
  });
});

describe("une page respire sur un téléphone", () => {
  it.each(PAGES)("%s", (path) => {
    const body = source(path);
    // La gouttière du produit, avec sa variante petite. C'est la seule chose
    // qui empêche le texte de coller au bord de l'écran.
    expect(body).toContain("px-[var(--gutter)]");
    expect(body).toContain("max-md:px-[var(--gutter-sm)]");
  });
});

describe("une boîte de dialogue se ferme au clavier", () => {
  const dialogs = FILES.filter((path) => code(path).includes('role="dialog"'));

  it("il y en a au moins une à vérifier", () => {
    // Sinon ce bloc ne dit rien, et c'est le genre de test qui reste vert
    // après avoir cessé de couvrir quoi que ce soit.
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
  });

  it.each(dialogs)("%s", (path) => {
    const body = code(path);
    expect(body).toContain('aria-modal="true"');
    expect(
      body.includes('"Escape"'),
      `${path} ouvre une boîte de dialogue sans touche Échap : un utilisateur\n` +
        "au clavier n'en sort qu'à la souris."
    ).toBe(true);
  });
});

describe("une erreur est annoncée, pas seulement affichée", () => {
  const fetching = FILES.filter((path) => code(path).includes("await fetch("));

  it("il y a bien des surfaces qui appellent le réseau", () => {
    expect(fetching.length).toBeGreaterThanOrEqual(3);
  });

  /*
   * ⚠ DEUX FAÇONS D'ANNONCER, ET LA SECONDE EST LA MEILLEURE.
   *
   * Écrire `role="alert"` à la main compte. Passer par `<InlineError>` compte
   * aussi : ce composant PORTE `role="alert"` (components/ui/text-field.tsx),
   * et c'est la façon dont un nouveau code devrait le faire — une seule
   * définition de ce qu'est une erreur annoncée, plutôt qu'un attribut recopié
   * dans quinze fichiers.
   *
   * Sans cette seconde branche, la garde pousse à DUPLIQUER l'attribut dans un
   * fichier qui délègue déjà l'annonce, ce qui produirait deux `role="alert"`
   * imbriqués — du code écrit pour le test plutôt que pour la lectrice d'écran.
   */
  const ANNOUNCES = [/role="alert"/, /<InlineError\b/];

  it("⚠ et `InlineError` annonce vraiment — l'exemption ne survit pas au composant", () => {
    // Le jour où `InlineError` perd son `role="alert"`, cette branche cesse
    // d'être une exemption valable et ce test le dit AVANT les autres.
    const component = readFileSync(
      resolve(ROOT, "components/ui/text-field.tsx"),
      "utf8"
    );
    const body = component.slice(component.indexOf("export function InlineError"));
    expect(body.slice(0, body.indexOf("\n}"))).toContain('role="alert"');
  });

  it.each(fetching)("%s", (path) => {
    expect(
      ANNOUNCES.some((pattern) => pattern.test(code(path))),
      `${path} peut échouer sans rien annoncer. Une erreur qui n'existe que\n` +
        "visuellement n'existe pas pour un lecteur d'écran.\n" +
        'Deux issues : `role="alert"`, ou `<InlineError>` qui le porte déjà.'
    ).toBe(true);
  });
});

describe("un bouton sans texte porte un nom", () => {
  it.each(FILES)("%s", (path) => {
    const body = source(path);
    /*
     * Les boutons dont le contenu est un seul caractère ou une entité — un
     * « + », une flèche — n'ont pas de nom accessible. On exige un aria-label
     * dans le même élément.
     */
    const glyphButtons = [...body.matchAll(/<button\b[\s\S]{0,600}?>\s*([^<\s]{1,2})\s*<\/button>/g)];
    for (const match of glyphButtons) {
      expect(
        match[0].includes("aria-label"),
        `${path} porte un bouton dont le contenu est « ${match[1]} » et qui n'a\n` +
          "pas d'aria-label. Il s'annonce « bouton » et rien d'autre."
      ).toBe(true);
    }
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    const canary = '<button type="button" onClick={x}>+</button>';
    const found = [...canary.matchAll(/<button\b[\s\S]{0,600}?>\s*([^<\s]{1,2})\s*<\/button>/g)];
    expect(found.length).toBe(1);
    expect(found[0][0].includes("aria-label")).toBe(false);
  });
});
