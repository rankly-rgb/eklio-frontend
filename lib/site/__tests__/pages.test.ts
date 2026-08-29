import { describe, expect, it } from "vitest";
import {
  addSection,
  addableSectionTypes,
  moveSection,
  removeSection,
  reorderSection,
  sectionLabel,
  sortSections,
  toggleSection,
  togglePage,
} from "@/lib/site/pages";
import { clayAndSand } from "@/lib/site/__tests__/envelope.fixture";
import type { SectionType, SiteCatalog, SpecPage } from "@/lib/site/types";

/*
 * Pages et sections. Le fil rouge : `order` est une clé de tri, et on ne
 * renumérote pas une page pour se simplifier la vie.
 */

const PAGES = clayAndSand().spec.pages;
const services = () => PAGES.find((page) => page.key === "services")!;

function pageOf(pages: SpecPage[], key: string): SpecPage {
  return pages.find((page) => page.key === key)!;
}

/** Un extrait du catalogue de l'annexe — les types, leurs pages autorisées. */
const CATALOG: SiteCatalog = {
  direction_limits: {
    name: 20,
    name_words_max: 2,
    rationale_min: 60,
    rationale_max: 95,
    hero_headline: 46,
    hero_subhead: 60,
    tone_keywords_count: 3,
    tone_keywords_joined: 32,
    directions_count: 3,
  },
  site_spec_limits: {
    hero_overline: 48,
    hero_headline: 90,
    hero_subhead: 220,
    hero_cta_label: 28,
    about_excerpt: 600,
    section_text: 800,
    extra_instructions: 2000,
  },
  builder_targets: [],
  section_types: [
    type("hero", "Hero", "spec.hero", ["home"]),
    type("intro", "Introduction", "spec.about_excerpt", ["home", "about"]),
    type("specialties", "What I work with", "fields", ["home", "services"]),
    type("faq", "Common questions", "fields", ["home", "services", "contact"]),
    type("credentials", "Training and licensure", "fields", ["about"]),
    type("footer", "Footer", "fields", ["home", "about", "services", "contact"]),
    { ...type("fees", "Fees", "fields", ["services", "contact"]), active: false },
  ],
};

function type(
  key: string,
  label: string,
  source: SectionType["source"],
  pages: string[]
): SectionType {
  return {
    type: key,
    label,
    source,
    allowed_pages: pages,
    default_enabled: true,
    active: true,
    fields: [
      { key: "heading", label: "Heading", kind: "text", max_length: 800 },
      { key: "body", label: "Paragraph", kind: "longtext", max_length: 800 },
      { key: "items", label: "Items", kind: "list", max_length: 800 },
    ],
  };
}

describe("les interrupteurs", () => {
  it("éteindre une page ne supprime rien", () => {
    const next = pageOf(togglePage(PAGES, "about", false), "about");
    expect(next.enabled).toBe(false);
    expect(next.sections).toHaveLength(4);
  });

  it("éteindre une section garde sa copy et son `order`", () => {
    const before = services().sections.find((s) => s.key === "fees")!;
    const after = pageOf(
      toggleSection(PAGES, "services", "fees", false),
      "services"
    ).sections.find((s) => s.key === "fees")!;

    // C'est la seule façon de la rallumer sans la réécrire.
    expect(after.enabled).toBe(false);
    expect(after.fields).toEqual(before.fields);
    expect(after.order).toBe(before.order);
  });
});

describe("le déplacement", () => {
  it("échange deux `order` au lieu de renuméroter la page", () => {
    const next = pageOf(moveSection(PAGES, "services", "fees", -1), "services");
    const byKey = Object.fromEntries(next.sections.map((s) => [s.key, s.order]));

    expect(byKey.fees).toBe(1);
    expect(byKey.services).toBe(2);
    // `faq` et `footer` n'ont pas bougé : on n'a touché que les deux voisines.
    expect(byKey.faq).toBe(3);
    expect(byKey.footer).toBe(4);
  });

  it("compte la section désactivée comme une voisine", () => {
    // Elle occupe bien une place dans l'ordre : la sauter ferait mentir la
    // liste sur ce qui se passera si elle est rallumée.
    const next = pageOf(moveSection(PAGES, "services", "footer", -1), "services");
    const byKey = Object.fromEntries(next.sections.map((s) => [s.key, s.order]));
    expect(byKey.footer).toBe(3);
    expect(byKey.faq).toBe(4);
  });

  it("ne fait rien au bord de la liste", () => {
    expect(moveSection(PAGES, "services", "services", -1)).toEqual(PAGES);
    expect(moveSection(PAGES, "services", "footer", 1)).toEqual(PAGES);
  });

  it("le glisser réutilise les `order` existants, sans en inventer", () => {
    const next = pageOf(
      reorderSection(PAGES, "services", "footer", "services"),
      "services"
    );
    const orders = sortSections(next.sections).map((s) => s.order);

    expect(orders).toEqual([1, 2, 3, 4]);
    expect(sortSections(next.sections).map((s) => s.key)).toEqual([
      "footer",
      "services",
      "fees",
      "faq",
    ]);
  });
});

describe("l'ajout d'une section", () => {
  it("n'offre que ce que `allowed_pages` autorise", () => {
    // `credentials` n'est autorisé que sur About : le proposer sur Home
    // provoquerait un `invalid_field` sur `pages`, après coup.
    const home = addableSectionTypes(CATALOG, pageOf(PAGES, "home"));
    expect(home.map((entry) => entry.type)).not.toContain("credentials");

    const about = addableSectionTypes(CATALOG, pageOf(PAGES, "about"));
    expect(about.map((entry) => entry.type)).toContain("credentials");
  });

  it("n'offre pas un type inactif", () => {
    const contact = addableSectionTypes(CATALOG, pageOf(PAGES, "contact"));
    expect(contact.map((entry) => entry.type)).not.toContain("fees");
  });

  it("n'offre pas un second hero, une seconde intro, un second footer", () => {
    // Les trois lisent une valeur unique : deux sur la même page afficheraient
    // deux fois la même chose.
    const home = addableSectionTypes(CATALOG, pageOf(PAGES, "home")).map(
      (entry) => entry.type
    );
    expect(home).not.toContain("hero");
    expect(home).not.toContain("intro");
    expect(home).not.toContain("footer");
    expect(home).toContain("faq");
  });

  it("pose la section en bas, avec des champs VIDES dans la bonne forme", () => {
    const next = pageOf(
      addSection(PAGES, "contact", CATALOG.section_types[3]),
      "contact"
    );
    const added = next.sections[next.sections.length - 1];

    expect(added.key).toBe("faq");
    expect(added.order).toBe(3);
    expect(added.enabled).toBe(true);
    // Vides : pré-remplir inventerait de la copy.
    expect(added.fields).toEqual({ heading: "", body: "", items: [] });
  });

  it("trouve une clé libre quand le type est déjà là", () => {
    const once = addSection(PAGES, "home", CATALOG.section_types[3]);
    const twice = addSection(once, "home", CATALOG.section_types[3]);
    const keys = pageOf(twice, "home").sections.map((section) => section.key);

    expect(keys).toContain("faq");
    expect(keys).toContain("faq-2");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("la suppression", () => {
  it("retire la section et laisse le trou dans les `order`", () => {
    const next = pageOf(removeSection(PAGES, "services", "fees"), "services");
    expect(next.sections.map((section) => section.order)).toEqual([1, 3, 4]);
  });
});

describe("le libellé d'une section", () => {
  it("vient du catalogue", () => {
    const footer = services().sections.find((section) => section.key === "footer")!;
    expect(sectionLabel(CATALOG, footer)).toBe("Footer");
  });

  it("retombe sur le type brut plutôt que sur un mot inventé", () => {
    // Un type que la base a ajouté et que le catalogue en cache ne connaît pas
    // encore doit rester identifiable.
    expect(
      sectionLabel({ ...CATALOG, section_types: [] }, services().sections[0])
    ).toBe("services");
    expect(services().sections[0].type).toBe("services");
  });
});
