import { describe, expect, it } from "vitest";
import {
  counterTone,
  limitForTarget,
  patchForTarget,
  targetField,
  valueForTarget,
} from "@/lib/site/edit";
import { clampNoteFor, clampedFields, originalFor } from "@/lib/site/seed-clamped";
import { clayAndSand } from "@/lib/site/__tests__/envelope.fixture";
import { SAMPLE_DIRECTIONS } from "@/lib/brand/sample";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * L'édition en place : d'un texte de la maquette au patch qui l'écrit.
 */

const SPEC = clayAndSand().spec;

const CATALOG = {
  site_spec_limits: {
    hero_overline: 48,
    hero_headline: 90,
    hero_subhead: 220,
    hero_cta_label: 28,
    about_excerpt: 600,
    section_text: 800,
    extra_instructions: 2000,
  },
  section_types: [
    {
      type: "specialties",
      label: "What I work with",
      source: "fields" as const,
      allowed_pages: ["home"],
      default_enabled: true,
      active: true,
      fields: [
        { key: "heading", label: "Heading", kind: "text" as const, max_length: 60 },
        { key: "items", label: "Areas", kind: "list" as const, max_length: 800 },
      ],
    },
  ],
} as unknown as SiteCatalog;

describe("une clé de section n'identifie pas une section", () => {
  it("le descripteur porte la page", () => {
    // `footer` existe sur les quatre pages : un chemin `footer.body` écrirait
    // la première trouvée.
    const target = {
      kind: "section" as const,
      page: "about",
      section: "footer",
      field: "body",
    };
    expect(targetField(target)).toBe("pages.about.footer.body");

    const pages = (patchForTarget(SPEC, target, "About footer only").pages ?? []);
    const bodyOf = (key: string) =>
      pages
        .find((page) => page.key === key)!
        .sections.find((section) => section.key === "footer")!.fields.body;

    expect(bodyOf("about")).toBe("About footer only");
    expect(bodyOf("home")).toBe("Elm & Ember Therapy, PLLC. Licensed in Oregon.");
  });
});

describe("les deux exceptions du contrat", () => {
  it("le hero se patche sur `spec.hero`, pas dans les fields de la section", () => {
    const patch = patchForTarget(SPEC, { kind: "hero", field: "headline" }, "Begin here.");

    expect(patch.hero?.headline).toBe("Begin here.");
    // Les autres champs du hero survivent : `hero` est un objet, et un patch
    // qui n'en porterait qu'une clé l'écraserait.
    expect(patch.hero?.cta_label).toBe("Book a consult");
    expect(patch.pages).toBeUndefined();
  });

  it("l'intro se patche sur `spec.about_excerpt` — donc sur les deux pages", () => {
    const patch = patchForTarget(SPEC, { kind: "about" }, "New intro.");
    expect(patch).toEqual({ about_excerpt: "New intro." });
    // Il n'y a qu'une valeur. Home et About la rendent toutes les deux.
    expect(patch.pages).toBeUndefined();
  });
});

describe("les listes", () => {
  const target = {
    kind: "section" as const,
    page: "home",
    section: "specialties",
    field: "items",
    index: 1,
  };

  it("écrivent l'item par son index", () => {
    const items = patchForTarget(SPEC, target, "Grief")
      .pages!.find((page) => page.key === "home")!
      .sections.find((section) => section.key === "specialties")!.fields.items;

    expect(items).toEqual(["Anxiety", "Grief", "Life transitions"]);
  });

  it("retirent l'item quand il est vidé", () => {
    // Le garder en chaîne vide ferait imprimer « Areas 2 » suivi de rien dans
    // les blocs de copy, et poserait une puce vide sur le site.
    const items = patchForTarget(SPEC, target, "   ")
      .pages!.find((page) => page.key === "home")!
      .sections.find((section) => section.key === "specialties")!.fields.items;

    expect(items).toEqual(["Anxiety", "Life transitions"]);
  });
});

describe("les limites viennent du catalogue", () => {
  it.each([
    ["overline", 48],
    ["headline", 90],
    ["subhead", 220],
    ["cta_label", 28],
  ] as const)("hero.%s vaut %i", (field, limit) => {
    expect(limitForTarget(CATALOG, SPEC, { kind: "hero", field })).toBe(limit);
  });

  it("about_excerpt vaut 600, pas les 46 d'une direction", () => {
    // `direction_limits` et `site_spec_limits` sont lus par deux
    // consommateurs différents. Les confondre borne l'éditeur à des longueurs
    // pensées pour une maquette de 250px.
    expect(limitForTarget(CATALOG, SPEC, { kind: "about" })).toBe(600);
  });

  it("un champ de section prend le plus petit des deux plafonds", () => {
    expect(
      limitForTarget(CATALOG, SPEC, {
        kind: "section",
        page: "home",
        section: "specialties",
        field: "heading",
      })
    ).toBe(60);
  });

  it("retombe sur `section_text` quand le catalogue ne connaît pas le champ", () => {
    expect(
      limitForTarget(CATALOG, SPEC, {
        kind: "section",
        page: "home",
        section: "contact",
        field: "body",
      })
    ).toBe(800);
  });
});

describe("le compteur", () => {
  it("reste silencieux loin de la limite", () => {
    expect(counterTone(10, 90)).toBe("quiet");
  });

  it("passe en ambre à 90 %", () => {
    expect(counterTone(80, 90)).toBe("quiet");
    expect(counterTone(81, 90)).toBe("warning");
    expect(counterTone(90, 90)).toBe("warning");
  });

  it("bascule quand on dépasse", () => {
    expect(counterTone(91, 90)).toBe("over");
  });
});

describe("la lecture d'une cible", () => {
  it("rend la valeur courante, liste comprise", () => {
    expect(valueForTarget(SPEC, { kind: "hero", field: "subhead" })).toBe(
      "Therapy for adults who hold it together."
    );
    expect(
      valueForTarget(SPEC, {
        kind: "section",
        page: "home",
        section: "specialties",
        field: "items",
        index: 2,
      })
    ).toBe("Life transitions");
  });

  it("rend une chaîne vide plutôt que de planter sur un champ absent", () => {
    expect(
      valueForTarget(SPEC, {
        kind: "section",
        page: "nowhere",
        section: "nothing",
        field: "body",
      })
    ).toBe("");
  });
});

describe("`seed_clamped`", () => {
  const direction = SAMPLE_DIRECTIONS[1];

  it("est `null` dans le cas normal", () => {
    expect(clampedFields(null, direction)).toEqual([]);
  });

  it("lit les CLÉS PRÉSENTES, pas une liste de trois", () => {
    // `hero.headline` ne peut pas arriver aujourd'hui — il est borné à 46 en
    // amont — mais un kit écrit avant que ce CHECK soit resserré le pourrait.
    const fields = clampedFields(
      {
        "hero.overline": { original_length: 80, clamped_length: 39 },
        "hero.headline": { original_length: 99, clamped_length: 90 },
      },
      direction
    );

    expect(fields.map((entry) => entry.key)).toEqual([
      "hero.headline",
      "hero.overline",
    ]);
  });

  it("va chercher l'original dans la direction retenue", () => {
    expect(originalFor(direction, "about_excerpt")).toBe(direction.about_excerpt);
    expect(originalFor(direction, "hero.cta_label")).toBe(direction.hero.cta_label);
  });

  it("ne se casse pas sur une clé qu'aucune direction ne porte", () => {
    expect(originalFor(direction, "practice_details.city")).toBeNull();
  });

  it("se pose sur le champ concerné, et sur lui seul", () => {
    const seed = { "hero.cta_label": { original_length: 39, clamped_length: 25 } };

    expect(clampNoteFor(seed, direction, "hero.cta_label")).not.toBeNull();
    expect(clampNoteFor(seed, direction, "about_excerpt")).toBeNull();
  });
});
