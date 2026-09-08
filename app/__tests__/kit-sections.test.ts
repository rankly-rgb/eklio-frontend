import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  KIT_SECTIONS,
  activeSection,
  isKitIndexActive,
  kitIndexHref,
  sectionHref,
  sentenceCase,
} from "@/lib/kit/sections";

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
 *
 * ⚠ SIX SECTIONS, PAS SEPT. `Overview` avait sa propre ligne, ce qui dépensait
 * une place du rail pour ce qui est la porte d'entrée du kit. Le bloc
 * d'identité en haut du rail — monogramme, nom, direction — EST ce lien, et
 * c'est lui qui porte `aria-current` sur la route d'index. « Exactement une
 * chose active » reste vrai ; ce n'est simplement pas toujours une des six.
 */

const ROOT = resolve(__dirname, "../..");
const SECTIONS_DIR = join(ROOT, "app/app/brand-kits/[id]/(sections)");
const RAIL = join(ROOT, "components/kit/kit-rail.tsx");

/** Le fichier de page qui rend une section. */
function pageFor(segment: string): string {
  return join(SECTIONS_DIR, segment, "page.tsx");
}

describe("chaque section de la liste est une vraie route", () => {
  it("l'énumération trouve bien les sections", () => {
    // Sans cette garde, une liste vidée rendrait tout le bloc vacuously true.
    expect(KIT_SECTIONS.length).toBe(6);
  });

  it("la route d'index existe, même si elle n'est pas dans la liste", () => {
    // Elle est atteinte par le bloc d'identité du rail, pas par une ligne.
    expect(existsSync(join(SECTIONS_DIR, "page.tsx"))).toBe(true);
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

    const known = new Set(KIT_SECTIONS.map((section) => section.segment));
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

  it("⚠ la racine ne marque AUCUNE section — elle marque le bloc du kit", () => {
    // `useSelectedLayoutSegment()` rend `null` sur la route d'index. Retomber
    // sur la première ligne y allumerait « Identity » alors qu'elle regarde
    // la vue d'ensemble.
    expect(activeSection(null)).toBeNull();
    expect(isKitIndexActive(null)).toBe(true);
  });

  it("et une section ne marque jamais le bloc du kit", () => {
    for (const section of KIT_SECTIONS) {
      expect(isKitIndexActive(section.segment)).toBe(false);
    }
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

describe("les adresses", () => {
  it("le bloc du kit mène à la racine, sans segment ajouté", () => {
    expect(kitIndexHref("k1")).toBe("/app/brand-kits/k1");
  });

  it("les sections pendent sous elle", () => {
    expect(sectionHref("k1", KIT_SECTIONS[1])).toBe("/app/brand-kits/k1/colors");
  });
});

/*
 * Le nom de la direction s'écrit DEUX fois, de deux façons, et c'est voulu :
 * `Warm ground` dans le rail (deuxième ligne d'un bloc de nom, qui ne doit
 * pas concurrencer le nom de la practice au-dessus), `WARM GROUND` en mono
 * capitales dans la bande (là, c'est une étiquette qui classe le kit).
 */
describe("sentenceCase", () => {
  it("rend une capitale initiale et rien d'autre", () => {
    expect(sentenceCase("Warm Ground")).toBe("Warm ground");
    expect(sentenceCase("QUIET ROOM")).toBe("Quiet room");
  });

  it("une chaîne vide reste vide, sans planter", () => {
    expect(sentenceCase("")).toBe("");
    expect(sentenceCase("   ")).toBe("");
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

  it("la section courante porte aria-current=\"page\"", () => {
    expect(source).toContain('aria-current={current ? "page" : undefined}');
  });

  it("⚠ le bloc du kit est un LIEN vers l'index, et il porte aria-current", () => {
    /*
     * C'est ce qui remplace la septième ligne. S'il cessait d'être un lien,
     * la vue d'ensemble n'aurait plus de porte dans le rail ; s'il cessait de
     * porter `aria-current`, la route d'index n'aurait rien d'actif.
     */
    expect(source).toContain("href={kitIndexHref(brandKitId)}");
    expect(source).toContain('aria-current={onIndex ? "page" : undefined}');
    expect(source).toContain("isKitIndexActive(segment)");
  });

  it("il vit DANS le `nav`, donc il reste atteignable en dessous de 900px", () => {
    const nav = source.slice(source.indexOf("<nav"), source.indexOf("</nav>"));
    expect(nav).toContain("kitIndexHref(brandKitId)");
    expect(nav).toContain("KIT_SECTIONS.map");
  });

  it("le rail rend exactement six liens de section, plus ce bloc", () => {
    // Une seule boucle, sur la seule liste : impossible d'en ajouter un
    // septième sans passer par `KIT_SECTIONS`, que le bloc du haut compte.
    expect([...source.matchAll(/KIT_SECTIONS\.map/g)]).toHaveLength(1);
    expect([...source.matchAll(/<Link\b/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("la direction est en casse de phrase dans le rail", () => {
    expect(source).toContain("sentenceCase(directionName)");
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
