"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  briefDraftSchema,
  isStepNumber,
  stepSchemas,
  STEP_NUMBERS,
  type BriefDraft,
} from "@/lib/brief/schemas";
import { METIER_OPTIONS, optionLabel } from "@/lib/brief/steps";

export type SaveBriefStepResult =
  | { ok: true; savedAt: string }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string>;
    };

const GENERIC_ERROR =
  "L'enregistrement a échoué. Vérifiez votre connexion puis réessayez.";

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
    return { ok: false, error: "Votre session a expiré. Reconnectez-vous." };
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
    return { ok: false, error: "Ce projet est introuvable." };
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
    return { ok: false, error: "Ce projet est introuvable." };
  }

  const existing = briefDraftSchema.safeParse(briefRow.data);
  const merged: BriefDraft = { ...(existing.success ? existing.data : {}), ...sanitized };

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

  // Métadonnées du projet : métier lisible sur le tableau de bord, avancement.
  const metier =
    merged.metier === "autre"
      ? (merged.metier_autre ?? "autre")
      : optionLabel(METIER_OPTIONS, merged.metier);

  const allDone = STEP_NUMBERS.every((s) => completedSteps.includes(s));
  const currentStep =
    mode === "complete"
      ? Math.max(project.current_step, Math.min(step + 1, 8))
      : project.current_step;

  const { error: projectError } = await supabase
    .from("projects")
    .update({
      current_step: currentStep,
      metier: metier ?? null,
      status: project.status === "brief" && allDone ? "brief_complete" : project.status,
    })
    .eq("id", projectId);

  if (projectError) {
    console.error("[saveBriefStep] écriture projet", projectError);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/app");
  revalidatePath(`/app/projets/${projectId}/brief/recapitulatif`);

  return { ok: true, savedAt: new Date().toISOString() };
}
