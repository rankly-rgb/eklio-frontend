import { describe, expect, it } from "vitest";
import { planSections } from "@/lib/site/section-copy";
import type { SpecPage } from "@/lib/site/types";

/*
 * La section vide est le défaut qui a produit un site vide : un titre, et rien
 * dessous. Trois de ces sections ont une réponse dans le brief ; la quatrième
 * n'en a pas, et la bonne réponse est alors de NE PAS la construire.
 *
 * Les données ci-dessous sont celles du kit réel 45de0dac — quatre pages, et
 * les quatre sections qui sont arrivées sans corps.
 */

const section = (
  type: string,
  fields: Record<string, string | string[]> = {},
  order = 1
) => ({ key: `${type}-${order}`, type, order, fields, enabled: true });

const HER_PAGES: SpecPage[] = [
  {
    key: "home",
    label: "Home",
    enabled: true,
    sections: [
      section("hero"),
      section("intro"),
      section("specialties", { heading: "What I work with", items: ["Self-esteem"] }),
      section("contact", { heading: "Get in touch", body: "" }),
      section("footer", { body: "" }),
    ],
  },
  {
    key: "about",
    label: "About",
    enabled: true,
    sections: [
      section("intro"),
      section("approach", { heading: "How I work", body: "" }),
      section("credentials", { heading: "Training and licensure", items: [] }),
      section("footer", { body: "" }),
    ],
  },
  {
    key: "services",
    label: "Services",
    enabled: true,
    sections: [
      section("services", { heading: "Services", body: "", items: [] }),
      section("fees", { heading: "Fees", body: "", items: [] }),
      section("faq", { heading: "Common questions", items: [] }),
      section("footer", { body: "" }),
    ],
  },
];

const HER_BRIEF = {
  sessionStyles: ["I ask a lot of questions", "We work from a plan you can see"],
  modalities: [
    "CBT — Cognitive Behavioral Therapy",
    "EFT — Emotionally Focused Therapy",
    "EMDR — Eye Movement Desensitization and Reprocessing",
  ],
  licenseLabel: "LMFT",
  licenseNumber: "12345",
};

const plan = () => planSections({ pages: HER_PAGES, ...HER_BRIEF });

describe("ce que le brief remplit", () => {
  it("« How I work » reçoit ses styles de séance, mot pour mot", () => {
    const found = plan().supplements.find((s) => s.heading === "How I work");
    expect(found?.lines).toEqual(HER_BRIEF.sessionStyles);
  });

  it("« Services » reçoit les noms complets de ses approches", () => {
    const found = plan().supplements.find((s) => s.heading === "Services");
    expect(found?.lines).toEqual(HER_BRIEF.modalities);
  });

  it("« Training and licensure » ne porte que le fait : type et numéro", () => {
    const found = plan().supplements.find((s) => s.heading === "Training and licensure");
    expect(found?.lines).toEqual(["LMFT 12345"]);
  });

  it("⚠ aucune ligne n'est rédigée : chacune est une étiquette du catalogue", () => {
    const catalogue = new Set([...HER_BRIEF.sessionStyles, ...HER_BRIEF.modalities, "LMFT 12345"]);
    for (const supplement of plan().supplements) {
      for (const line of supplement.lines) expect(catalogue).toContain(line);
    }
  });

  it("sans licence, la section n'est pas remplie — elle est omise", () => {
    const result = planSections({
      pages: HER_PAGES,
      ...HER_BRIEF,
      licenseLabel: null,
      licenseNumber: null,
    });
    expect(result.supplements.map((s) => s.heading)).not.toContain("Training and licensure");
    expect(result.omit.map((o) => o.section)).toContain("Training and licensure");
  });

  /*
   * ⚠ « LMFT » SEUL N'EST PAS UNE SECTION. Il est déjà dans la surtitre du
   * héros (« LMFT · PORTLAND, OR ») et dans le pied de page, que la spec
   * compose depuis le même champ. Un titre au-dessus d'un mot affiché deux
   * fois ailleurs ajoute une section et aucune information.
   */
  it("⚠ sans numéro de licence, la section n'a qu'un mot déjà affiché : omise", () => {
    const result = planSections({ ...HER_BRIEF, pages: HER_PAGES, licenseNumber: null });
    expect(result.supplements.map((s) => s.heading)).not.toContain("Training and licensure");
    expect(result.omit.map((o) => o.section)).toContain("Training and licensure");
  });

  it("ce qui manque est nommé — et rien n'est inventé à la place", () => {
    const result = planSections({ ...HER_BRIEF, pages: HER_PAGES, licenseNumber: null });
    expect(result.missing).toEqual([
      { describes: "your degrees and completed training", token: null },
      { describes: "your license number", token: "LICENSE_NUMBER" },
    ]);
  });

  it("les honoraires ne demandent rien : ils attendent une relecture juridique", () => {
    const pages: SpecPage[] = [
      {
        key: "services",
        label: "Services",
        enabled: true,
        sections: [section("fees", { heading: "Fees", items: [] })],
      },
    ];
    const result = planSections({ ...HER_BRIEF, pages });
    expect(result.omit.map((o) => o.section)).toEqual(["Fees"]);
    expect(result.missing).toEqual([]);
  });
});

describe("ce qui est omis plutôt que laissé vide", () => {
  it("la FAQ vide, que rien ne remplit, est omise", () => {
    expect(plan().omit.map((o) => o.section)).toContain("Common questions");
  });

  it("⚠ les honoraires sont omis même s'ils portent du texte", () => {
    const withFees: SpecPage[] = [
      {
        key: "services",
        label: "Services",
        enabled: true,
        sections: [section("fees", { heading: "Fees", body: "Sliding scale available." })],
      },
    ];
    const result = planSections({ ...HER_BRIEF, pages: withFees });
    expect(result.omit.map((o) => o.section)).toEqual(["Fees"]);
    expect(result.supplements).toEqual([]);
  });

  it("aucune section omise n'apparaît aussi comme remplie", () => {
    const { supplements, omit } = plan();
    const filled = new Set(supplements.map((s) => `${s.page}/${s.heading}`));
    for (const ref of omit) expect(filled).not.toContain(`${ref.page}/${ref.section}`);
  });
});

describe("ce qui n'est jamais touché", () => {
  it("hero, intro, contact et footer ne sont ni remplis ni omis", () => {
    const { supplements, omit } = plan();
    const named = [...supplements.map((s) => s.heading), ...omit.map((o) => o.section)];
    // Leur contenu vient d'ailleurs dans la spec : les déclarer vides serait faux.
    expect(named).not.toContain("Get in touch");
    expect(named.filter((n) => n === "footer")).toEqual([]);
  });

  it("une section désactivée disparaît sans être nommée", () => {
    const pages: SpecPage[] = [
      {
        key: "about",
        label: "About",
        enabled: true,
        sections: [{ ...section("approach", { heading: "How I work", body: "" }), enabled: false }],
      },
    ];
    const result = planSections({ ...HER_BRIEF, pages });
    expect(result.supplements).toEqual([]);
    expect(result.omit).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("une section qui a déjà du texte n'est pas écrasée", () => {
    const pages: SpecPage[] = [
      {
        key: "about",
        label: "About",
        enabled: true,
        sections: [section("approach", { heading: "How I work", body: "Her own paragraph." })],
      },
    ];
    expect(planSections({ ...HER_BRIEF, pages })).toEqual({
      supplements: [],
      omit: [],
      missing: [],
    });
  });
});
