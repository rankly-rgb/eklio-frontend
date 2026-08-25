import {
  STEP_NUMBERS,
  stepSchemas,
  type BriefDraft,
  type StepNumber,
} from "@/lib/brief/schemas";

/*
 * « Le brief est-il complet ? » — source unique de vérité.
 *
 * La réponse se lit dans les DONNÉES du brief, jamais dans la navigation.
 *
 * C'est le correctif d'un vrai blocage : la complétude était déduite de
 * `project_briefs.completed_steps` (et de `projects.current_step`), qui
 * enregistrent les clics sur « Continue », pas la validité de ce qui est
 * saisi. L'autosave, elle, écrit les réponses sans jamais toucher à ce
 * compteur : les deux dérivent, et un brief entièrement rempli pouvait être
 * déclaré incomplet — sans que rien à l'écran ne dise ce qui manquait.
 *
 * On réutilise `stepSchemas`, exactement les mêmes schémas que le bouton
 * « Continue » applique étape par étape : ce qui est jugé complet ici est
 * jugé complet là-bas, par construction.
 *
 * L'appelant passe un brouillon déjà normalisé (`parseStoredBriefDraft`, qui
 * traduit les anciennes clés françaises) : la complétude se calcule donc
 * toujours sur les clés anglaises du Lot 2.
 *
 * Module pur : ni I/O, ni React, ni accès base.
 */

/**
 * Les étapes dont les réponses ne satisfont pas encore leur schéma, en ordre
 * croissant. Tableau vide = le brief est complet.
 */
export function missingBriefSteps(draft: BriefDraft): StepNumber[] {
  return STEP_NUMBERS.filter(
    (step) => !stepSchemas[step].safeParse(draft).success
  );
}

/** Vrai quand les sept étapes sont satisfaites — donc quand on peut générer. */
export function isBriefComplete(draft: BriefDraft): boolean {
  return missingBriefSteps(draft).length === 0;
}
