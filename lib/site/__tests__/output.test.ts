import { describe, expect, it } from "vitest";
import {
  builderOf,
  copyAllText,
  groupCopyBlocks,
  leadLine,
  primaryCopyText,
  promptCharCount,
} from "@/lib/site/output";
import { isPromptOutput, isSetupSheet } from "@/lib/site/types";
import { CLAY_AND_SAND } from "@/lib/site/__tests__/envelope.fixture";
import type { BuilderTarget, PromptOutput, SetupSheetOutput } from "@/lib/site/types";

/*
 * La sortie dérivée — deux formes, et `output.kind` seul décide.
 */

/** Les sept cibles de l'annexe, telles que `builder_targets` les donne. */
const TARGETS: BuilderTarget[] = [
  { id: "lovable", label: "Lovable", output_kind: "prompt", accepts_prompt: true },
  { id: "framer", label: "Framer", output_kind: "prompt", accepts_prompt: true },
  { id: "v0", label: "v0", output_kind: "prompt", accepts_prompt: true },
  { id: "generic", label: "Another builder", output_kind: "prompt", accepts_prompt: true },
  { id: "squarespace", label: "Squarespace", output_kind: "setup_sheet", accepts_prompt: false },
  { id: "wix", label: "Wix", output_kind: "setup_sheet", accepts_prompt: false },
  { id: "webflow", label: "Webflow", output_kind: "setup_sheet", accepts_prompt: false },
];

const SHEET = CLAY_AND_SAND.output as SetupSheetOutput;

describe("la feuille d'installation de Squarespace", () => {
  it("porte NEUF étapes, pas huit", () => {
    // Les variantes de texte ont gagné une étape (la 3), la checklist est
    // passée en 8 et « Your own notes » en 9.
    expect(SHEET.steps).toHaveLength(9);
  });

  it("numérote depuis `n`, jamais depuis l'index", () => {
    expect(SHEET.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(SHEET.steps[7].title).toBe("Before you publish");
    expect(SHEET.steps[8].title).toBe("Your own notes");
  });

  it("l'étape 3 porte les trois variantes de texte, à part des six couleurs", () => {
    // Elles ont leur propre étape plutôt que trois pastilles de plus sous
    // « Set your six colors » : celle qui saisit des hex dans un panneau doit
    // savoir lesquelles sont des alternates de lesquelles.
    const six = SHEET.steps.find((step) => step.n === 2)!;
    const three = SHEET.steps.find((step) => step.n === 3)!;

    expect(six.values).toHaveLength(6);
    expect(three.values).toHaveLength(3);
    expect(three.values.map((value) => value.label)).toEqual([
      "Primary as text — headings and links on the page",
      "Secondary as text — supporting headings on the page",
      "Accent as text — small highlighted words",
    ]);
  });

  it("n'est pas un prompt, et n'en porte pas un", () => {
    expect(isSetupSheet(SHEET)).toBe(true);
    expect(isPromptOutput(SHEET)).toBe(false);
    expect(promptCharCount(SHEET)).toBeNull();
    expect(SHEET).not.toHaveProperty("text");
  });
});

describe("aucun champ où coller un prompt", () => {
  it.each(["squarespace", "wix", "webflow"] as const)(
    "%s n'accepte pas de prompt",
    (id) => {
      const builder = TARGETS.find((entry) => entry.id === id)!;
      expect(builder.accepts_prompt).toBe(false);
      expect(builder.output_kind).toBe("setup_sheet");
    }
  );

  it("`accepts_prompt` ne peut pas contredire `output_kind`", () => {
    for (const target of TARGETS) {
      expect(target.accepts_prompt).toBe(target.output_kind === "prompt");
    }
  });

  it("la phrase d'introduction dit qu'il n'y a pas de boîte", () => {
    expect(leadLine(TARGETS[4])).toBe(
      "Squarespace has no prompt box. Here's exactly what to enter, in order."
    );
    expect(leadLine(TARGETS[0])).toBe(
      "Paste this into Lovable. It builds the site; you keep it."
    );
  });
});

describe("le constructeur courant", () => {
  it("vient de `builder_targets`", () => {
    expect(builderOf(TARGETS, "webflow").label).toBe("Webflow");
  });

  it("retombe sur l'identifiant plutôt que de disparaître", () => {
    // Une cible ajoutée en base et pas encore dans le catalogue en cache doit
    // rester nommée, pas devenir une pastille vide.
    expect(builderOf([], "v0").label).toBe("v0");
  });
});

describe("les blocs de copy", () => {
  it("sont groupés par page puis par section, dans l'ordre d'arrivée", () => {
    // C'est l'ordre des sections sur le site : c'est ce qui permet de
    // descendre la liste en la collant au fur et à mesure.
    const groups = groupCopyBlocks(SHEET.copy_blocks);

    expect(groups.map((group) => group.page)).toEqual(["Home", "About", "Contact"]);
    expect(groups[0].sections.map((section) => section.section)).toEqual([
      "Hero",
      "Introduction",
    ]);
    expect(groups[0].sections[0].blocks.map((block) => block.label)).toEqual([
      "Overline",
      "Headline",
    ]);
  });

  it("« Copy all text » porte les en-têtes, parce que le presse-papier n'a pas de structure", () => {
    const text = copyAllText(SHEET);

    expect(text).toContain("HOME");
    expect(text).toContain("Hero");
    expect(text).toContain("Headline: A calmer place to start.");
    // Le même paragraphe apparaît sous Home et sous About : une valeur, deux
    // rendus.
    expect(text.match(/professionals who look fine/g)).toHaveLength(2);
  });

  it("le bouton principal copie la bonne chose selon la forme", () => {
    const prompt: PromptOutput = {
      kind: "prompt",
      text: "Build a four-page site…",
      char_count: 23,
    };

    expect(primaryCopyText(prompt)).toBe("Build a four-page site…");
    expect(primaryCopyText(SHEET)).toBe(copyAllText(SHEET));
  });

  it("le compteur vient de `char_count`, pas de `text.length`", () => {
    // `text.length` compte des unités UTF-16, ce qu'un constructeur ne mesure
    // pas.
    const prompt: PromptOutput = { kind: "prompt", text: "𝐀𝐁", char_count: 2 };
    expect(promptCharCount(prompt)).toBe(2);
    expect(prompt.text.length).toBe(4);
  });
});
