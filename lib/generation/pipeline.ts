import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * La pipeline de génération.
 *
 * STUB DU LOT 3 — la surface HTTP est câblée, la génération ne l'est pas
 * encore. Le lot 6 remplit ce module et rien d'autre : la route, le job, le
 * sondage et l'écran de révélation sont déjà écrits contre cette signature.
 */

export class GenerationNotImplementedError extends Error {
  constructor() {
    super("The generation pipeline lands in lot 6.");
    this.name = "GenerationNotImplementedError";
  }
}

export type PipelineInput = {
  supabase: SupabaseClient<Database>;
  /** Client service_role : le job écrit hors du contexte de la requête. */
  admin: SupabaseClient<Database>;
  projectId: string;
  brandKitId: string;
  userId: string;
};

export async function runGenerationPipeline(
  _input: PipelineInput
): Promise<void> {
  throw new GenerationNotImplementedError();
}

/**
 * « Write it for me » — une suggestion pour un champ libre du brief.
 *
 * STUB DU LOT 3, même contrat que ci-dessus.
 */
export async function suggestFieldText(_input: {
  supabase: SupabaseClient<Database>;
  projectId: string;
  field: string;
}): Promise<string> {
  throw new GenerationNotImplementedError();
}
