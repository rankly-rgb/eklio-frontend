"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadBriefAnswers } from "@/lib/actions/brief";
import { generateMonthlyPresence } from "@/lib/ai/monthly-presence";
import { getEntitlement } from "@/lib/billing/entitlements";
import { EthicsComplianceError } from "@/lib/ethics/enforce";

import type { GenerationActionState } from "@/components/generation-form";

export type MonthlyPresenceActionState = GenerationActionState;

/**
 * Generates one month of Monthly Presence content on demand.
 *
 * Manual by design in this pass. The scheduler that would run this a few days
 * before each month starts is the retention loop, and it is deliberately not
 * built here — see the TODO(retention) block in lib/ai/monthly-presence.ts.
 * The (project_id, period_start) unique constraint means a future job can call
 * straight into this path and stay idempotent.
 */
export async function generateMonthForProject(
  projectId: string,
  _prevState: MonthlyPresenceActionState,
  _formData: FormData
): Promise<MonthlyPresenceActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { hasMonthlyPresence } = await getEntitlement(projectId);
  if (!hasMonthlyPresence) {
    return {
      error:
        "Monthly Presence is not active on this account. You can add it from the checkout page.",
    };
  }

  const { data: direction } = await supabase
    .from("directions")
    .select("name, palette, typography")
    .eq("project_id", projectId)
    .eq("is_selected", true)
    .maybeSingle();

  if (!direction) {
    return { error: "Choose a direction first — the content is written in it." };
  }

  const answers = await loadBriefAnswers(projectId);
  const { periodStart, monthLabel } = currentPeriod();

  let content;
  try {
    content = await generateMonthlyPresence({
      answers,
      direction: {
        name: direction.name,
        palette: direction.palette,
        typography: direction.typography,
      },
      monthLabel,
    });
  } catch (error) {
    if (error instanceof EthicsComplianceError) {
      return {
        error:
          "We could not produce a month of content that clears the advertising-ethics rules for your license, so nothing was saved. Try again — if it keeps failing, check that your brief describes the direction of the work rather than a promised result.",
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Generation failed. Nothing was saved — try again.",
    };
  }

  const { error: upsertError } = await supabase
    .from("monthly_presence_deliveries")
    .upsert(
      { project_id: projectId, period_start: periodStart, content },
      { onConflict: "project_id,period_start" }
    );

  if (upsertError) {
    return { error: "Could not save this month's content. Try again." };
  }

  revalidatePath(`/app/projects/${projectId}/presence`);
  return null;
}

/** The month being delivered: the first of the current month, in UTC. */
function currentPeriod(): { periodStart: string; monthLabel: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return {
    periodStart: start.toISOString().slice(0, 10),
    monthLabel: start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}
