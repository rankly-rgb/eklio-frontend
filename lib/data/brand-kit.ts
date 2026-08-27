import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import {
  directionsSchema,
  socialTemplatesSchema,
  voiceGuideSchema,
  ethicsCheckSchema,
  type Direction,
  type EthicsCheck,
  type SocialTemplates,
  type VoiceGuide,
} from "@/lib/brand/shapes";

/*
 * Le kit de marque — lecture, et le seul écrit que l'interface déclenche :
 * le choix d'une direction.
 *
 * `brand_kits` porte les trois propositions dans `directions` (jsonb) et la
 * retenue dans `selected_direction_id`. La colonne `direction_id` est un
 * héritage de l'ancien flux (le commentaire de la colonne le dit) : on ne
 * l'écrit pas.
 *
 * Les jsonb sont RELUS par les schémas de `lib/brand/shapes.ts` plutôt que
 * castés. La base garantit leur forme à l'écriture ; un kit écrit avant une
 * évolution de contrainte, lui, ne la garantit pas — et une carte qui plante
 * au rendu est pire qu'une carte absente.
 */

type Client = SupabaseClient<Database>;

export type BrandKitRow = Tables<"brand_kits">;

export type BrandKit = {
  row: BrandKitRow;
  projectId: string;
  practiceName: string | null;
  directions: Direction[] | null;
  selectedDirection: Direction | null;
  socialTemplates: SocialTemplates | null;
  voiceGuide: VoiceGuide | null;
  ethicsCheck: EthicsCheck | null;
};

function hydrate(row: BrandKitRow, practiceName: string | null): BrandKit {
  const directions = parseDirections(row.directions);
  const selected =
    directions?.find((entry) => entry.id === row.selected_direction_id) ?? null;

  return {
    row,
    projectId: row.project_id,
    practiceName,
    directions,
    selectedDirection: selected,
    socialTemplates: parseSocialTemplates(row.social_templates),
    voiceGuide: parseVoiceGuide(row.voice_guide),
    ethicsCheck: parseEthicsCheck(row.ethics_check),
  };
}

export function parseDirections(value: unknown): Direction[] | null {
  if (value === null || value === undefined) return null;
  const parsed = directionsSchema.safeParse(value);
  if (!parsed.success) {
    console.error("[brand-kit] directions shape", parsed.error.issues);
    return null;
  }
  return parsed.data;
}

export function parseSocialTemplates(value: unknown): SocialTemplates | null {
  if (value === null || value === undefined) return null;
  const parsed = socialTemplatesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseVoiceGuide(value: unknown): VoiceGuide | null {
  if (value === null || value === undefined) return null;
  const parsed = voiceGuideSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseEthicsCheck(value: unknown): EthicsCheck | null {
  if (value === null || value === undefined) return null;
  const parsed = ethicsCheckSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Un kit par son identifiant, cadré à son propriétaire.
 *
 * La RLS de `brand_kits` passe déjà par `projects.user_id` ; la jointure
 * explicite ci-dessous sert à RÉCUPÉRER le nom de la practice, pas à
 * sécuriser. Renvoie `null` si le kit n'existe pas OU s'il est à quelqu'un
 * d'autre : l'appelant répond 404 dans les deux cas.
 */
export async function loadBrandKit(
  supabase: Client,
  brandKitId: string,
  userId: string
): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*, projects!inner(user_id, name)")
    .eq("id", brandKitId)
    .eq("projects.user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const { projects, ...row } = data as BrandKitRow & {
    projects: { user_id: string; name: string };
  };

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("practice_name")
    .eq("project_id", row.project_id)
    .maybeSingle();

  return hydrate(row, brief?.practice_name ?? projects.name ?? null);
}

/** Le kit d'un projet, s'il en a un. */
export async function loadBrandKitByProject(
  supabase: Client,
  projectId: string,
  userId: string
): Promise<BrandKit | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!project) return null;

  const { data: row } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!row) return null;

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("practice_name")
    .eq("project_id", projectId)
    .maybeSingle();

  return hydrate(row, brief?.practice_name ?? null);
}

export type SelectDirectionOutcome =
  | { ok: true; kit: BrandKit }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "unknown-direction" }
  | { ok: false; reason: "write-failed"; detail: unknown };

/**
 * Retient une direction.
 *
 * L'id est vérifié contre les directions DU KIT avant l'écriture : la base le
 * refuserait de toute façon (`brand_kit_selection_valid`), mais un CHECK
 * rejeté remonterait en 500 sur l'écran où le praticien vient de choisir.
 *
 * Coche ensuite l'item « Choose your creative direction » de la checklist via
 * `complete_choose_direction`, qui est idempotente : rechoisir une direction
 * ne rouvre pas l'item, et ne le recoche pas deux fois.
 */
export async function selectDirection(
  supabase: Client,
  brandKitId: string,
  userId: string,
  directionId: string
): Promise<SelectDirectionOutcome> {
  const kit = await loadBrandKit(supabase, brandKitId, userId);
  if (!kit) return { ok: false, reason: "not-found" };

  if (!kit.directions?.some((entry) => entry.id === directionId)) {
    return { ok: false, reason: "unknown-direction" };
  }

  const { data: row, error } = await supabase
    .from("brand_kits")
    .update({
      selected_direction_id: directionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brandKitId)
    .select("*")
    .single();

  if (error || !row) return { ok: false, reason: "write-failed", detail: error };

  const { error: checklistError } = await supabase.rpc(
    "complete_choose_direction",
    { p_brand_kit_id: brandKitId }
  );
  if (checklistError) {
    // La checklist est un accessoire : un item non coché ne doit pas annuler
    // un choix de direction déjà écrit.
    console.error("[brand-kit] complete_choose_direction", checklistError);
  }

  return { ok: true, kit: hydrate(row, kit.practiceName) };
}
