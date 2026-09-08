import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KIT_SECTIONS, activeSection, sectionHref } from "@/lib/kit/sections";

/*
 * Le commutateur de sections — une seule chose active, et c'est la route
 * courante.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 *
 * Le rail que celui-ci remplace tenait l'état actif dans un `useState` semé à
 * « Your assets ». Sur desktop il ne bougeait qu'au clic, donc l'élément
 * surligné n'avait aucun rapport avec le titre à l'écran. Ce n'était pas une
 * étourderie : c'est ce qui arrive dès que « quelle section regarde-t-elle »
 * a DEUX réponses possibles dans le code.
 *
 * Il n'y en a plus qu'une, `useSelectedLayoutSegment()`, et les assertions
 * ci-dessous tiennent les trois propriétés qui en découlent : chaque section
 * a une route, chaque route est dans la liste, et exactement une correspond.
 */

const ROOT = resolve(__dirname, "../..");
const SECTIONS_DIR = join(ROOT, "app/app/brand-kits/[id]/(sections)");
const RAIL = join(ROOT, "components/kit/kit-rail.tsx");

/** Le fichier de page qui rend une section. */
function pageFor(segment: string | null): string {
  return segment === null
    ? join(SECTIONS_DIR, "page.tsx")
    : join(SECTIONS_DIR, segment, "page.tsx");
}

describe("chaque section de la liste est une vraie route", () => {
  it("l'énumération trouve bien les sections", () => {
    // Sans cette garde, une liste vidée rendrait tout le bloc vacuously true.
    expect(KIT_SECTIONS.length).toBe(7);
  });

  it.each(KIT_SECTIONS.map((section) => [section.id, section] as const))(
    "%s",
    (_id, section) => {
      expect(existsSync(pageFor(section.segment))).toBe(true);
    }
  );

  it("et réciproquement : aucune route de section n'est absente de la liste", () => {
    /*
     * L'inverse compte autant. Une page ajoutée sous `(sections)/` sans ligne
     * dans `KIT_SECTIONS` existerait à une adresse que le rail n'offre pas —
     * atteignable seulement par un lien perdu ailleurs, et jamais surlignée.
     */
    const segments = readdirSync(SECTIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(join(SECTIONS_DIR, name, "page.tsx")));

    const known = new Set(
      KIT_SECTIONS.map((section) => section.segment).filter((s): s is string => s !== null)
    );
    for (const segment of segments) {
      expect(
        known.has(segment),
        `(sections)/${segment} existe mais n'est pas dans KIT_SECTIONS.\n` +
          "Une section sans entrée dans le rail est une page sans porte."
      ).toBe(true);
    }
  });
});

describe("activeSection — exactement une, et c'est la route courante", () => {
  it.each(KIT_SECTIONS.map((section) => [section.id, section] as const))(
    "le segment de %s ne marque que %s",
    (id, section) => {
      const matches = KIT_SECTIONS.filter((candidate) => candidate.segment === section.segment);
      expect(matches).toHaveLength(1);
      expect(activeSection(section.segment)?.id).toBe(id);
    }
  );

  it("la racine marque Overview, pas la première de la liste par défaut", () => {
    // `useSelectedLayoutSegment()` rend `null` sur la route d'index.
    expect(activeSection(null)?.id).toBe("overview");
  });

  it("⚠ un segment inconnu ne marque RIEN", () => {
    /*
     * Pas de repli sur Overview : une route imbriquée sous une section
     * allumerait alors une entrée qui ne correspond pas à ce qui est à
     * l'écran — exactement le mensonge de l'ancien scroll-spy, pris par
     * l'autre bout.
     */
    expect(activeSection("site-editor")).toBeNull();
    expect(activeSection("reveal")).toBeNull();
  });

  it("aucun segment n'est déclaré deux fois", () => {
    const segments = KIT_SECTIONS.map((section) => section.segment);
    expect(new Set(segments).size).toBe(segments.length);
  });
});

describe("sectionHref", () => {
  it("Overview est la racine du kit, sans segment ajouté", () => {
    expect(sectionHref("k1", KIT_SECTIONS[0])).toBe("/app/brand-kits/k1");
  });

  it("les autres pendent sous elle", () => {
    expect(sectionHref("k1", KIT_SECTIONS[2])).toBe("/app/brand-kits/k1/colors");
  });
});

/** On lit du CODE, pas de la prose : ce fichier documente sa propre panne. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("le rail lit le routeur, et rien d'autre", () => {
  const source = stripComments(readFileSync(RAIL, "utf8"));

  it("l'actif vient de useSelectedLayoutSegment", () => {
    expect(source).toContain("useSelectedLayoutSegment()");
  });

  it("⚠ il ne garde AUCUN état de section", () => {
    // C'était la panne. Un `useState` ici et la question a de nouveau deux
    // réponses.
    expect(source).not.toMatch(/\buseState\b/);
  });

  it("c'est un point de repère `nav`, et un seul", () => {
    expect(source).toContain('aria-label="Brand kit sections"');
    expect([...source.matchAll(/<nav\b/g)]).toHaveLength(1);
  });

  it("l'élément courant porte aria-current=\"page\"", () => {
    expect(source).toContain('aria-current={current ? "page" : undefined}');
  });

  it("en dessous de 900px c'est un commutateur horizontal, pas un hamburger", () => {
    expect(source).toContain("max-[900px]:flex-row");
    expect(source).toContain("max-[900px]:overflow-x-auto");
    expect(source).not.toMatch(/hamburger|<summary|aria-label="Menu"/i);
  });

  it("la carte d'Eklio ne porte qu'un seul lien, et ce n'est pas une vente", () => {
    /*
     * Elle a déjà payé. Un panneau « grow with Eklio » dans un espace payé
     * est un impôt sur ce qu'elle a acheté — d'où le seul lien admis, qui
     * mène hors d'Eklio.
     */
    expect(source).toContain("Hand off to a designer →");
    expect(source).not.toMatch(/upgrade|pricing|\/app\/checkout|Monthly Presence/i);
  });
});
