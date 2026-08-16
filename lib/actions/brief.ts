"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  BRIEF_STEPS,
  getBriefStep,
  isBriefComplete,
  type BriefAnswer,
  type BriefAnswers,
  type BriefStepId,
} from "@/lib/brief/steps";

/**
 * All brief persistence. Autosave is a server round-trip on every field blur —
 * there is deliberately no localStorage anywhere in this app, so a half-filled
 * brief survives a closed laptop and is readable from any device.
 */

export type SaveResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Confirms the caller owns the project. RLS already blocks cross-user access;
 * this turns a silent empty result into an explicit failure.
 */
async function requireProject(projectId: string) {
  const { supabase, user } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, status")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    redirect("/app");
  }

  return { supabase, user, project };
}

export async function createProject(): Promise<never> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not start a new brief: ${error?.message ?? "unknown error"}`);
  }

  revalidatePath("/app");
  redirect(`/app/projects/${data.id}/brief/${BRIEF_STEPS[0].id}`);
}

/**
 * Upserts one field into a step's answer. Called on blur and on every choice,
 * so it must be cheap and must never clobber sibling fields — hence read,
 * merge, write rather than a blind overwrite.
 */
export async function saveBriefField(
  projectId: string,
  stepId: BriefStepId,
  fieldName: string,
  value: unknown
): Promise<SaveResult> {
  const step = getBriefStep(stepId);
  if (!step) return { ok: false, error: "Unknown step." };
  if (!step.fields.some((f) => f.name === fieldName)) {
    return { ok: false, error: "Unknown field." };
  }

  const { supabase } = await requireProject(projectId);

  const { data: existing } = await supabase
    .from("brief_answers")
    .select("answer")
    .eq("project_id", projectId)
    .eq("step", stepId)
    .maybeSingle();

  const merged: BriefAnswer = {
    ...((existing?.answer as BriefAnswer) ?? {}),
    [fieldName]: value as BriefAnswer[string],
  };

  const { error } = await supabase
    .from("brief_answers")
    .upsert(
      { project_id: projectId, step: stepId, answer: merged },
      { onConflict: "project_id,step" }
    );

  if (error) {
    return { ok: false, error: "Could not save. Your last change is not stored." };
  }

  // The practice name doubles as the project name on the dashboard.
  if (stepId === "practice" && fieldName === "practiceName") {
    const name = typeof value === "string" ? value.trim() : "";
    if (name) {
      await supabase.from("projects").update({ name }).eq("id", projectId);
    }
  }

  return { ok: true };
}

export async function loadBriefAnswers(
  projectId: string
): Promise<BriefAnswers> {
  const { supabase } = await requireProject(projectId);

  const { data } = await supabase
    .from("brief_answers")
    .select("step, answer")
    .eq("project_id", projectId);

  const answers: BriefAnswers = {};
  for (const row of data ?? []) {
    answers[row.step as BriefStepId] = (row.answer as BriefAnswer) ?? {};
  }
  return answers;
}

/**
 * Called from the recap screen. Only flips the status forward — a project that
 * already has directions or a kit keeps its further-along status.
 */
export async function completeBrief(projectId: string): Promise<never> {
  const { supabase, project } = await requireProject(projectId);

  const answers = await loadBriefAnswers(projectId);
  if (!isBriefComplete(answers)) {
    redirect(`/app/projects/${projectId}/brief/review`);
  }

  if (project.status === "brief") {
    await supabase
      .from("projects")
      .update({ status: "brief_complete" })
      .eq("id", projectId);
  }

  revalidatePath("/app");
  redirect(`/app/projects/${projectId}/directions`);
}
