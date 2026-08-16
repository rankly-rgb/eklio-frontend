"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadBriefAnswers } from "@/lib/actions/brief";
import { generateBrandKit, type KitScope } from "@/lib/ai/kit";
import { EthicsComplianceError } from "@/lib/ethics/enforce";

import type { GenerationActionState } from "@/components/generation-form";

export type KitActionState = GenerationActionState;

/**
 * Builds the brand kit from the chosen direction.
 *
 * Scope is passed in rather than assumed: Lot 4 derives it from the purchased
 * tier. Until then every project gets the full deliverable.
 */
export async function generateProjectKit(
  projectId: string,
  _prevState: KitActionState,
  _formData: FormData
): Promise<KitActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, status")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { data: direction } = await supabase
    .from("directions")
    .select("id, name, description, palette, typography")
    .eq("project_id", projectId)
    .eq("is_selected", true)
    .maybeSingle();

  if (!direction) {
    return { error: "Choose a direction before building your brand kit." };
  }

  const answers = await loadBriefAnswers(projectId);
  const requestedPages = asStringArray(answers.website?.pages);

  if (requestedPages.length === 0) {
    return { error: "Pick at least one page in step 7 of your brief." };
  }

  const scope: KitScope = {
    // TODO(Lot 4): narrow `pages` and flip `includeSocialTemplates` from the
    // purchased tier. Starter gets fewer pages and no social templates.
    pages: requestedPages,
    includeSocialTemplates: true,
  };

  let content;
  try {
    content = await generateBrandKit({
      answers,
      direction: {
        name: direction.name,
        description: direction.description,
        palette: direction.palette,
        typography: direction.typography,
      },
      scope,
    });
  } catch (error) {
    if (error instanceof EthicsComplianceError) {
      return {
        error:
          "We could not produce a kit that clears the advertising-ethics rules for your license, so nothing was saved. This usually traces back to the brief — check that “What the client gains” describes the direction of the work rather than a promised result.",
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Generation failed. Nothing was saved — try again.",
    };
  }

  const { export_prompt, ...rest } = content;

  // One kit per project: rebuilding replaces it in place rather than stacking
  // versions the practitioner would have to choose between.
  const { error: upsertError } = await supabase.from("brand_kits").upsert(
    {
      project_id: projectId,
      direction_id: direction.id,
      direction_snapshot: {
        name: direction.name,
        description: direction.description,
      },
      palette: direction.palette,
      typography: direction.typography,
      content: rest,
      export_prompt,
    },
    { onConflict: "project_id" }
  );

  if (upsertError) {
    return { error: "Could not save your brand kit. Try building it again." };
  }

  if (project.status !== "kit") {
    await supabase.from("projects").update({ status: "kit" }).eq("id", projectId);
  }

  revalidatePath(`/app/projects/${projectId}/kit`);
  revalidatePath("/app");
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}
