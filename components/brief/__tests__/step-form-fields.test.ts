import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * Le formulaire rend-il vraiment ce que la définition d'étape déclare ?
 *
 * Ce test est né d'un soupçon : le praticien ne voyait pas le champ requis
 * `primary_action` de l'étape 7, et un champ requis invisible serait un brief
 * impossible à compléter, donc une génération jamais atteignable. Le rendu
 * réel prouve le contraire — le champ est bien là — et le test le fige pour
 * qu'un `visibleIf` mal posé ou un `kind` non géré par le moteur de rendu ne
 * puisse plus faire disparaître un champ requis en silence.
 *
 * Rendu SSR sans JSX (`createElement`) : le fichier reste un `.test.ts`, donc
 * couvert par le `include` de vitest, sans transform supplémentaire.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/app/app/projets/[id]/brief/actions", () => ({
  saveBriefStep: async () => ({ ok: true, savedAt: new Date().toISOString() }),
}));

const { StepForm } = await import("@/components/brief/step-form");
const { STEPS } = await import("@/lib/brief/steps");

function renderStep(step: number, draft: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(StepForm, {
      projectId: "00000000-0000-4000-8000-000000000000",
      projectName: "Hearth Counseling",
      step,
      initialDraft: draft,
    })
  );
}

/** Un champ est présent si son `id` (texte) ou son `name` (choix) est rendu. */
function hasControl(html: string, name: string): boolean {
  return html.includes(`id="${name}"`) || html.includes(`name="${name}"`);
}

describe("rendu des champs du brief", () => {
  it("rend le champ requis primary_action à l'étape 7", () => {
    const html = renderStep(7);

    expect(hasControl(html, "primary_action")).toBe(true);
    expect(html).toContain("Primary action");
  });

  it("rend TOUS les champs requis de chaque étape", () => {
    for (const stepDef of STEPS) {
      const html = renderStep(stepDef.step);

      for (const field of stepDef.fields) {
        if (field.kind === "sliders" || !field.required) continue;
        // `visibleIf` masque légitimement un champ conditionnel tant que sa
        // condition n'est pas remplie (license_type_other).
        if (field.kind === "text" && field.visibleIf) continue;

        expect(
          hasControl(html, field.name),
          `étape ${stepDef.step} : le champ requis ${field.name} ne se rend pas`
        ).toBe(true);
      }
    }
  });

  it("rend le champ conditionnel une fois sa condition remplie", () => {
    // license_type_other n'apparaît que si license_type vaut "other".
    expect(hasControl(renderStep(1), "license_type_other")).toBe(false);
    expect(
      hasControl(renderStep(1, { license_type: "other" }), "license_type_other")
    ).toBe(true);
  });
});
