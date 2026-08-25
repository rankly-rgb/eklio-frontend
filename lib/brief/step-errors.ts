import type { StepDef } from "@/lib/brief/steps";

/*
 * Retour d'erreur d'une étape du brief, au POINT D'ACTION.
 *
 * Correctif d'un blocage observé : quand la validation d'une étape échouait,
 * `StepForm` posait bien un message sous le champ fautif — mais rien à côté du
 * bouton. Sur l'étape 7, le champ requis `primary_action` est le 2ᵉ de cinq,
 * suivi de deux groupes de cases (8 + 5 options) : le bouton « Review your
 * brief » se trouve plusieurs centaines de pixels plus bas. Le praticien
 * cliquait, ne voyait rien bouger, et concluait que le champ n'existait pas —
 * alors qu'il était simplement hors de l'écran, au-dessus.
 *
 * D'où deux besoins, tous deux servis par ce module :
 * - NOMMER ce qui manque, à l'endroit où l'on vient de cliquer ;
 * - désigner le champ vers lequel ramener le focus.
 *
 * Module pur : ni React, ni DOM, ni I/O — le message se teste seul.
 */

/**
 * Les champs invalides d'une étape, dans l'ORDRE DU FORMULAIRE.
 *
 * Ni l'ordre des clés de l'objet d'erreurs ni celui des `issues` zod ne sont
 * garantis fidèles à ce que le praticien a sous les yeux : on réordonne selon
 * la définition de l'étape pour que « le premier champ fautif » soit bien le
 * premier en partant du haut.
 */
export function invalidFieldsInOrder(
  errors: Record<string, string>,
  stepDef: StepDef
): string[] {
  const names: string[] = [];

  for (const field of stepDef.fields) {
    if (field.kind === "sliders") {
      for (const slider of field.sliders) {
        if (slider.name in errors) names.push(slider.name);
      }
    } else if (field.name in errors) {
      names.push(field.name);
    }
  }

  // Filet : une erreur portant sur un champ absent de la définition (schéma
  // modifié sans l'écran) ne doit pas disparaître du message.
  for (const name of Object.keys(errors)) {
    if (!names.includes(name)) names.push(name);
  }

  return names;
}

/** Le champ vers lequel ramener le focus, ou `undefined` si rien n'est fautif. */
export function firstInvalidField(
  errors: Record<string, string>,
  stepDef: StepDef
): string | undefined {
  return invalidFieldsInOrder(errors, stepDef)[0];
}

/** Libellé affiché d'un champ, curseurs compris ; à défaut, son nom technique. */
export function fieldLabel(name: string, stepDef: StepDef): string {
  for (const field of stepDef.fields) {
    if (field.kind === "sliders") {
      if (field.sliders.some((slider) => slider.name === name)) {
        return field.label;
      }
    } else if (field.name === name) {
      return field.label;
    }
  }
  return name;
}

/**
 * Message affiché à côté du bouton quand l'étape ne passe pas.
 *
 * Il NOMME les champs concernés : « quelque chose ne va pas » obligerait à
 * repartir en chasse dans la page, ce qui est précisément le problème qu'on
 * corrige. Chaîne vide s'il n'y a rien à signaler — l'appelant n'affiche alors
 * aucun encart.
 */
export function missingAnswersMessage(
  errors: Record<string, string>,
  stepDef: StepDef
): string {
  const labels = invalidFieldsInOrder(errors, stepDef).map((name) =>
    fieldLabel(name, stepDef)
  );

  if (labels.length === 0) return "";
  if (labels.length === 1) {
    return `${labels[0]} still needs an answer — it's just above.`;
  }
  return `${labels.length} answers are still missing: ${labels.join(", ")}.`;
}
