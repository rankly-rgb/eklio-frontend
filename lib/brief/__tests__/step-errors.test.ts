import { describe, expect, it } from "vitest";
import {
  fieldLabel,
  firstInvalidField,
  invalidFieldsInOrder,
  missingAnswersMessage,
} from "@/lib/brief/step-errors";
import { getStep } from "@/lib/brief/steps";
import { parseStoredBriefDraft, stepSchemas } from "@/lib/brief/schemas";
import { missingBriefSteps } from "@/lib/brief/completeness";

/*
 * Contrat du retour d'erreur d'étape, au point d'action.
 *
 * Régression corrigée : quand la validation d'une étape échouait, le seul
 * signal était un message SOUS le champ fautif. Sur l'étape 7, le champ requis
 * `primary_action` est le 2ᵉ de cinq et le bouton est tout en bas, après deux
 * groupes de cases (8 + 5 options) : le praticien cliquait, ne voyait rien, et
 * concluait que le champ n'existait pas. Rien n'était affiché près du bouton,
 * et le focus ne bougeait pas.
 */

const step7 = getStep(7)!;

/*
 * L'état RÉEL du brief bloqué (projet « eklio », relevé en base) : toutes les
 * réponses de l'étape 7 sauf `primary_action`, qui est requis.
 */
const REAL_BLOCKED_BRIEF = {
  practice_name: "eklio",
  license_type: "therapist",
  offer: "In a sentence or two — individual therapy, couples intensives, groups.",
  stage: "launching",
  specialties: ["trauma_emdr", "couples"],
  problem_addressed: "ok",
  client_gains: "ok",
  alternatives: "ok",
  differentiation: "ok",
  ideal_client: "ok",
  decision_context: "in_crisis",
  objections: ["cost"],
  emotions: ["steadiness", "groundedness", "clarity"],
  tone_reserved_expressive: 3,
  tone_warm_clinical: 3,
  tone_classic_contemporary: 3,
  tone_minimal_rich: 3,
  color_families: ["warm_neutrals", "muted_plum_slate", "earth_ochre"],
  contrast_level: "balanced",
  type_style: "serif_sans_pairing",
  character_level: "confident",
  site_goal: "book_consultations",
  pages_wanted: ["home", "about", "approach", "specialties", "faq", "contact"],
  available_proof: ["training_certifications", "publications"],
  // primary_action : ABSENT — c'est tout le blocage.
};

/** Les erreurs que produit réellement l'étape 7 sur ce brief. */
function realStep7Errors(): Record<string, string> {
  const draft = parseStoredBriefDraft(REAL_BLOCKED_BRIEF);
  const parsed = stepSchemas[7].safeParse(draft);
  expect(parsed.success).toBe(false);

  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key !== "" && !(key in errors)) errors[key] = issue.message;
    }
  }
  return errors;
}

describe("cas réel observé — le brief bloqué en base", () => {
  it("n'est incomplet qu'à l'étape 7, et à cause du seul primary_action", () => {
    const draft = parseStoredBriefDraft(REAL_BLOCKED_BRIEF);

    expect(missingBriefSteps(draft)).toEqual([7]);
    expect(Object.keys(realStep7Errors())).toEqual(["primary_action"]);
  });

  it("produit un message qui NOMME le champ manquant, à côté du bouton", () => {
    const message = missingAnswersMessage(realStep7Errors(), step7);

    // Le message existait-il avant ? Non : rien n'était posé près du bouton.
    expect(message).not.toBe("");
    expect(message).toContain("Primary action");
  });

  it("désigne le champ vers lequel ramener le focus", () => {
    expect(firstInvalidField(realStep7Errors(), step7)).toBe("primary_action");
  });
});

describe("ordre et libellés", () => {
  it("classe les champs fautifs dans l'ordre du formulaire, pas des clés", () => {
    // Objet volontairement à l'envers de l'ordre d'affichage.
    const errors = { constraints: "x", primary_action: "y", site_goal: "z" };

    expect(invalidFieldsInOrder(errors, step7)).toEqual([
      "site_goal",
      "primary_action",
      "constraints",
    ]);
    expect(firstInvalidField(errors, step7)).toBe("site_goal");
  });

  it("rend le libellé affiché d'un champ, et celui du groupe pour un curseur", () => {
    expect(fieldLabel("primary_action", step7)).toBe("Primary action");
    expect(fieldLabel("tone_warm_clinical", getStep(4)!)).toBe("Tone sliders");
    // Champ inconnu de l'étape : on retombe sur son nom technique.
    expect(fieldLabel("inconnu", step7)).toBe("inconnu");
  });

  it("compte les champs quand il y en a plusieurs", () => {
    const message = missingAnswersMessage(
      { site_goal: "x", primary_action: "y" },
      step7
    );

    expect(message).toContain("2 answers are still missing");
    expect(message).toContain("Site goal");
    expect(message).toContain("Primary action");
  });

  it("ne signale rien quand rien n'est fautif", () => {
    expect(missingAnswersMessage({}, step7)).toBe("");
    expect(firstInvalidField({}, step7)).toBeUndefined();
    expect(invalidFieldsInOrder({}, step7)).toEqual([]);
  });

  it("n'oublie pas une erreur portant sur un champ absent de l'étape", () => {
    // Filet : schéma modifié sans l'écran — l'erreur doit rester visible.
    expect(invalidFieldsInOrder({ orphelin: "x" }, step7)).toEqual(["orphelin"]);
    expect(missingAnswersMessage({ orphelin: "x" }, step7)).toContain("orphelin");
  });
});
