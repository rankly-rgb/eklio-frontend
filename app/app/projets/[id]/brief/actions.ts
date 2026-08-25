"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  briefDraftSchema,
  isStepNumber,
  parseStoredBriefDraft,
  stepSchemas,
  type BriefDraft,
} from "@/lib/brief/schemas";
import { isBriefComplete } from "@/lib/brief/completeness";
import { LICENSE_TYPE_OPTIONS, optionLabel } from "@/lib/brief/steps";

export type SaveBriefStepResult =
  | { ok: true; savedAt: string }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string>;
    };

const GENERIC_ERROR =
  "Saving failed. Check your connection, then try again.";

/*
 * Sauvegarde d'une étape du brief.
 * - mode "draft" (blur, navigation arrière) : validation assouplie, aucune
 *   étape marquée comme terminée.
 * - mode "complete" (bouton Continuer) : validation stricte du schéma de
 *   l'étape ; l'étape rejoint completed_steps et current_step avance au
 *   maximum atteint.
 * Aucune donnée du brief ne transite par le localStorage : tout passe ici.
 */
export async function saveBriefStep(
  projectId: string,
  step: number,
  values: BriefDraft,
  mode: "draft" | "complete"
): Promise<SaveBriefStepResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  if (!z.uuid().safeParse(projectId).success || !isStepNumber(step)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // La RLS filtre par propriétaire : projet absent = introuvable.
  const { data: project, error: projectSelectError } = await supabase
    .from("projects")
    .select("id, current_step, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectSelectError) {
    console.error("[saveBriefStep] lecture projet", projectSelectError);
  }

  if (!project) {
    return { ok: false, error: "This project could not be found." };
  }

  // Les valeurs reçues repassent toujours par zod avant d'entrer en base.
  const draftParsed = briefDraftSchema.safeParse(values);
  if (!draftParsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  let sanitized: BriefDraft = draftParsed.data;

  if (mode === "complete") {
    const strict = stepSchemas[step].safeParse(values);
    if (!strict.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of strict.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key !== "" && !(key in fieldErrors)) {
          fieldErrors[key] = issue.message;
        }
      }
      return { ok: false, fieldErrors };
    }
    sanitized = { ...sanitized, ...strict.data };
  }

  const { data: briefRow, error: briefSelectError } = await supabase
    .from("project_briefs")
    .select("data, completed_steps")
    .eq("project_id", projectId)
    .maybeSingle();

  if (briefSelectError) {
    console.error("[saveBriefStep] lecture brief", briefSelectError);
  }

  if (!briefRow) {
    return { ok: false, error: "This project could not be found." };
  }

  // Lecture tolérante du stocké : une valeur d'option périmée ne doit pas
  // faire disparaître les autres réponses au moment de la fusion.
  const existing = parseStoredBriefDraft(briefRow.data);
  const merged: BriefDraft = { ...existing, ...sanitized };

  const completedSteps =
    mode === "complete"
      ? [...new Set([...briefRow.completed_steps, step])].sort((a, b) => a - b)
      : briefRow.completed_steps;

  const { error: briefError } = await supabase
    .from("project_briefs")
    .update({
      data: merged,
      completed_steps: completedSteps,
    })
    .eq("project_id", projectId);

  if (briefError) {
    console.error("[saveBriefStep] écriture brief", briefError);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Métadonnées du projet : type de licence lisible sur le tableau de bord,
  // avancement. `projects.metier` reste le nom de la COLONNE en base (`text`
  // libre, pas de CHECK) : elle sert de cache d'affichage et accepte le libellé
  // anglais sans migration. Seule la clé du brief a été renommée.
  const licenseLabel =
    merged.license_type === "other"
      ? (merged.license_type_other ?? "other")
      : optionLabel(LICENSE_TYPE_OPTIONS, merged.license_type);

  /*
   * Complétude lue dans les réponses fusionnées, plus dans `completedSteps` :
   * ce compteur n'enregistre que les clics sur « Continue », et l'autosave
   * écrit sans y toucher. Un brief rempli hors de l'ordre nominal restait
   * bloqué en `brief`, donc renvoyé sur une étape au lieu du récapitulatif.
   */
  const allDone = isBriefComplete(merged);
  const currentStep =
    mode === "complete"
      ? Math.max(project.current_step, Math.min(step + 1, 8))
      : project.current_step;

  const { error: projectError } = await supabase
    .from("projects")
    .update({
      current_step: currentStep,
      metier: licenseLabel ?? null,
      status: project.status === "brief" && allDone ? "brief_complete" : project.status,
    })
    .eq("id", projectId);

  if (projectError) {
    console.error("[saveBriefStep] écriture projet", projectError);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/app");
  revalidatePath(`/app/projets/${projectId}/brief/recapitulatif`);
  // Le rail d'étapes rend les ✓ et le lien de récapitulatif : sans cette
  // revalidation, il reste sur l'état d'avant la sauvegarde.
  revalidatePath(`/app/projets/${projectId}/brief/${step}`);

  return { ok: true, savedAt: new Date().toISOString() };
}
