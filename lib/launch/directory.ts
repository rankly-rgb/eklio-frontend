import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { PracticeDetails } from "@/lib/kit/launch-copy";

/*
 * ── HER DIRECTORY FIELDS, RESOLVED ───────────────────────────────────────
 *
 * Psychology Today's profile is a form, not an essay: licensed state, issues,
 * types of therapy, client focus. Eklio already holds every one of those —
 * she chose them in the brief — but it holds them as catalogue IDS, which are
 * meaningless to paste. This is the join that was missing, and nothing more.
 *
 * ⚠ LABELS ONLY. NOTHING IS WRITTEN HERE. No sentence is built around these,
 * no prose, no model call. A field is the catalogue's own display label for an
 * id she picked, and an id whose catalogue row is gone — retired, deactivated,
 * renamed — yields NO field rather than a raw id on screen. An id is not a
 * word, and showing one would be worse than showing nothing.
 *
 * The order is the order the form asks for them, so she can work down her
 * screen and down this list together.
 */

type Client = SupabaseClient<Database>;

export type DirectoryField = {
  /** The form's own name for the field. */
  label: string;
  /** Her answers, comma-joined in the catalogue's `sort_order`. */
  value: string;
};

export async function loadDirectoryFields(
  supabase: Client,
  projectId: string,
  practiceDetails: PracticeDetails | null
): Promise<DirectoryField[]> {
  const { data: brief } = await supabase
    .from("project_briefs")
    .select("specialty_ids, modality_ids, client_persona_ids")
    .eq("project_id", projectId)
    .maybeSingle();

  const specialtyIds = brief?.specialty_ids ?? [];
  const modalityIds = brief?.modality_ids ?? [];
  const personaIds = brief?.client_persona_ids ?? [];

  const [specialties, modalities, personas] = await Promise.all([
    specialtyIds.length
      ? supabase.from("specialties").select("label").in("id", specialtyIds).order("sort_order")
      : Promise.resolve({ data: [] as { label: string }[] }),
    modalityIds.length
      ? supabase
          .from("modality_cards")
          .select("label, full_name")
          .in("id", modalityIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as { label: string; full_name: string }[] }),
    personaIds.length
      ? supabase
          .from("client_persona_cards")
          .select("label")
          .in("id", personaIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as { label: string }[] }),
  ]);

  return buildDirectoryFields({
    state: practiceDetails?.state ?? null,
    specialties: (specialties.data ?? []).map((row) => row.label),
    /*
     * The full name, not the short label. The catalogue carries both because
     * the brief's cards are compact ("CBT") and a directory listing is not —
     * and it is the directory being filled in here.
     */
    modalities: (modalities.data ?? []).map((row) => row.full_name || row.label),
    personas: (personas.data ?? []).map((row) => row.label),
  });
}

/**
 * The assembly, pure — the part with the rules in it.
 *
 * A field with nothing behind it does not render: an empty array, a row whose
 * catalogue label came back blank, a state she never entered. The alternative
 * is a form field labelled `Issues` with nothing after the colon, which tells
 * her Eklio lost something.
 */
export function buildDirectoryFields(answers: {
  state: string | null;
  specialties: string[];
  modalities: string[];
  personas: string[];
}): DirectoryField[] {
  const fields: DirectoryField[] = [];
  const push = (label: string, parts: string[]) => {
    // A blank or missing catalogue label drops out here rather than joining as
    // an empty segment — `a, , c` would be worse than `a, c`.
    const value = parts.map((part) => part?.trim()).filter(Boolean).join(", ");
    if (value) fields.push({ label, value });
  };

  // The form's order: credentials, then issues, then therapy types, then focus.
  push("Licensed state", answers.state ? [answers.state] : []);
  push("Issues", answers.specialties);
  push("Types of therapy", answers.modalities);
  push("Client focus", answers.personas);

  return fields;
}
