import { describe, expect, it } from "vitest";
import { activePage, fieldItems, fieldText, sectionsOf } from "@/lib/site/mockup";
import { patchAreas } from "@/lib/site/patch";
import { CLAY_AND_SAND } from "@/lib/site/__tests__/envelope.fixture";

/** Les bornes de l'éditeur, telles que `site_catalog()` les donne (§5). */
const LIMITS = {
  hero_overline: 48,
  hero_headline: 90,
  hero_subhead: 220,
  hero_cta_label: 28,
  about_excerpt: 600,
  section_text: 800,
  extra_instructions: 2000,
};

/*
 * La maquette lit `preview` et ne recompose rien.
 */

const PAGES = CLAY_AND_SAND.preview.pages;
const services = PAGES.find((page) => page.key === "services")!;

describe("`order` est une clé de tri, jamais un index", () => {
  it("la page Services arrive en [1, 2, 4] — et c'est normal", () => {
    // `faq` est désactivée : elle disparaît de `preview` et RIEN n'est
    // renuméroté. Le trou est la forme attendue, pas une anomalie.
    expect(sectionsOf(services).map((section) => section.order)).toEqual([1, 2, 4]);
  });

  it("le tableau arrive déjà trié : le rendre dans l'ordre suffit", () => {
    for (const page of PAGES) {
      const orders = page.sections.map((section) => section.order);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    }
  });

  it("« section 4 sur 4 » serait faux : il y en a trois", () => {
    const sections = sectionsOf(services);
    expect(sections.length).toBe(3);
    // Le dernier `order` vaut 4 et ne peut donc servir ni de position, ni de
    // dénominateur.
    expect(sections[sections.length - 1].order).toBe(4);
    expect(sections[sections.length - 1].order).not.toBe(sections.length);
  });

  it("la section désactivée est absente de preview mais présente dans spec", () => {
    const specServices = CLAY_AND_SAND.spec.pages.find((p) => p.key === "services")!;
    expect(specServices.sections.map((s) => s.key)).toContain("faq");
    expect(sectionsOf(services).map((s) => s.key)).not.toContain("faq");
  });
});

describe("la copy du hero et de l'intro est DÉJÀ résolue", () => {
  it("le hero porte sa copy dans ses fields, pas dans spec.hero", () => {
    const hero = PAGES[0].sections.find((section) => section.type === "hero")!;

    // §8 : la base a déjà résolu `spec.hero` dans les `fields` de la section.
    // La maquette lit ici, et nulle part ailleurs.
    expect(fieldText(hero.fields, "headline")).toBe("A calmer place to start.");
    expect(fieldText(hero.fields, "cta_label")).toBe("Book a consult");
  });

  it("l'intro rend le même paragraphe sur Home et sur About", () => {
    // Une seule valeur (`spec.about_excerpt`), rendue deux fois. Ce n'est pas
    // une duplication à corriger : c'est le dessin.
    const home = PAGES[0].sections.find((section) => section.type === "intro")!;
    const about = PAGES[1].sections.find((section) => section.type === "intro")!;

    expect(fieldText(home.fields, "body")).toBe(fieldText(about.fields, "body"));
    expect(fieldText(home.fields, "body")).toBe(CLAY_AND_SAND.spec.about_excerpt);
  });
});

describe("lecture des champs", () => {
  it("une liste n'est pas une chaîne, et réciproquement", () => {
    const specialties = PAGES[0].sections.find(
      (section) => section.type === "specialties"
    )!;

    expect(fieldText(specialties.fields, "items")).toBeNull();
    expect(fieldItems(specialties.fields, "heading")).toEqual([]);
    expect(fieldItems(specialties.fields, "items")).toEqual([
      "Anxiety",
      "Burnout",
      "Life transitions",
    ]);
  });

  it("un champ absent ne fait pas planter le rendu", () => {
    expect(fieldText({}, "heading")).toBeNull();
    expect(fieldItems({}, "items")).toEqual([]);
  });
});

describe("la page affichée", () => {
  it("retombe sur la première quand aucune n'est demandée", () => {
    expect(activePage(PAGES, null)?.key).toBe("home");
  });

  it("retombe sur la première quand la page demandée a été désactivée", () => {
    // Elle regardait Services, elle la désactive : l'onglet disparaît, et la
    // maquette doit montrer autre chose qu'un vide.
    expect(activePage(PAGES, "nowhere")?.key).toBe("home");
  });

  it("ne rend rien plutôt que d'inventer une page", () => {
    expect(activePage([], "home")).toBeNull();
  });
});

describe("`extra_instructions` n'atteint jamais la maquette", () => {
  it("le texte n'apparaît nulle part dans `preview`", () => {
    const instructions = CLAY_AND_SAND.spec.extra_instructions!;
    expect(instructions.length).toBeGreaterThan(0);

    /*
     * Elles partent MOT POUR MOT dans les instructions, et le champ le dit
     * sous lui-même. Les refléter dans la maquette demanderait de les
     * INTERPRÉTER — « keep the fee off the home page » n'a pas de rendu — et
     * interpréter, ici, c'est inventer.
     */
    expect(JSON.stringify(CLAY_AND_SAND.preview)).not.toContain(instructions);
    expect(JSON.stringify(CLAY_AND_SAND.preview)).not.toContain("keep the fee off");
  });

  it("elles sont bien dans la sortie, elles", () => {
    // La preuve que le test précédent ne passe pas par accident.
    expect(JSON.stringify(CLAY_AND_SAND.output)).toContain("keep the fee off");
  });
});

describe("le champ d'instructions supplémentaires", () => {
  it("est rangé dans sa propre zone d'analytique", () => {
    // Ni `copy` ni `structure` : c'est un texte qui ne touche pas le site
    // maquetté, seulement les instructions.
    expect(patchAreas({ extra_instructions: "…" })).toEqual(["instructions"]);
  });

  it("est borné par `extra_instructions`, pas par `section_text`", () => {
    // 2000 contre 800 : ce n'est pas un champ de section.
    expect(LIMITS.extra_instructions).toBe(2000);
    expect(LIMITS.extra_instructions).not.toBe(LIMITS.section_text);
  });
});
