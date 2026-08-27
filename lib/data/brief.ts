import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { previewModelSchema, type PreviewModel } from "@/lib/brand/shapes";
import { readCatalog } from "@/lib/catalog/read";
import type { Catalog } from "@/lib/catalog/types";

/*
 * Le brief — lecture, écriture, prévisualisation.
 *
 * TROIS RÈGLES qui gouvernent ce module.
 *
 * 1. LA TABLE EST `project_briefs`. Il n'y a pas de table `briefs`, et il ne
 *    faut pas en créer une. Sa clé primaire EST `project_id` : un
 *    « identifiant de brief » et un identifiant de projet sont la même valeur,
 *    ce que confirme la signature de `brief_preview(p_brief_id)`.
 *
 * 2. `project_briefs.progress_step` EST CANONIQUE. `projects.current_step`
 *    existe encore et dérive ; on ne le lit pas, on ne l'écrit pas. Les tenir
 *    « synchronisés » serait la dérive, pas le correctif.
 *
 * 3. LES IDS DE CATALOGUE SONT DES CLÉS ÉTRANGÈRES. `brief_preview()` les
 *    résout contre les tables de catalogue : un id inventé ne remonte pas une
 *    erreur, il remonte un repli, et le rail affiche éternellement la palette
 *    par défaut. On les valide donc contre le catalogue AVANT d'écrire.
 */

type Client = SupabaseClient<Database>;

export type BriefRow = Tables<"project_briefs">;
export type ProjectRow = Tables<"projects">;

/* ── La part libre du brief ─────────────────────────────────────────────── */

/*
 * `project_briefs.data` porte les réponses qui n'ont pas de colonne dédiée.
 * Rien de structurant n'a le droit d'y vivre : tout ce que `brief_preview()`
 * lit a sa propre colonne.
 */
export const briefDataSchema = z.object({
  /** Étape 2 — « or say it your way », côté problème puis côté gain. */
  problem_text: z.string().max(400).optional(),
  gain_text: z.string().max(400).optional(),
  /** Étape 7 — constructeur visé et site existant. */
  builder_target: z
    .enum(["squarespace", "lovable", "framer", "webflow"])
    .optional(),
  existing_url: z.string().max(200).optional(),
  /** Nom et titre du praticien, rendus sur la story `signature`. */
  practitioner_line: z.string().max(80).optional(),
  /** Le rappel « We draft in plain, board-safe language » n'est montré qu'une fois. */
  suggestion_notice_seen: z.boolean().optional(),
});
export type BriefData = z.infer<typeof briefDataSchema>;

export function parseBriefData(value: unknown): BriefData {
  const parsed = briefDataSchema.safeParse(value ?? {});
  // Une donnée libre corrompue ne doit pas empêcher de rouvrir son brief.
  return parsed.success ? parsed.data : {};
}

/* ── Correctif appliqué par l'autosave ──────────────────────────────────── */

const stateCode = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "Use the two-letter state code, like OR.");

export const briefPatchSchema = z
  .object({
    practice_name: z.string().max(120).nullable(),
    license_type_id: z.string().nullable(),
    specialty_ids: z.array(z.string()),
    city: z.string().max(80).nullable(),
    state: stateCode.nullable(),
    positioning: z.string().max(600).nullable(),
    problem_card_ids: z.array(z.string()),
    gain_card_ids: z.array(z.string()),
    client_persona_ids: z.array(z.string()).max(3),
    tone_card_id: z.string().nullable(),
    /* La base plafonne à 3, et L'ORDRE COMPTE : l'élément 1 est la palette
       « LEADING », celle qui pilote la prévisualisation. */
    palette_family_ids: z.array(z.string()).max(3),
    type_pairing_id: z.string().nullable(),
    primary_action_id: z.string().nullable(),
    site_goal_ids: z.array(z.string()),
    progress_step: z.number().int().min(1).max(7),
    completed_steps: z.array(z.number().int().min(1).max(7)),
    data: briefDataSchema,
  })
  .partial();

export type BriefPatch = z.infer<typeof briefPatchSchema>;

/** Les ids que chaque champ doit référencer, et où les trouver dans le catalogue. */
const ID_SOURCES = {
  license_type_id: (c: Catalog) => c.licenseTypes,
  specialty_ids: (c: Catalog) => c.specialties,
  problem_card_ids: (c: Catalog) => c.problemCards,
  gain_card_ids: (c: Catalog) => c.gainCards,
  client_persona_ids: (c: Catalog) => c.personaCards,
  tone_card_id: (c: Catalog) => c.toneCards,
  palette_family_ids: (c: Catalog) => c.paletteFamilies,
  type_pairing_id: (c: Catalog) => c.typePairings,
  primary_action_id: (c: Catalog) => c.primaryActions,
  site_goal_ids: (c: Catalog) => c.siteGoals,
} as const;

/**
 * Vérifie que chaque id du correctif vient bien du catalogue.
 *
 * Renvoie le premier champ fautif, ou `null`. Un id inventé n'est pas une
 * faute de frappe de l'utilisateur : c'est du code qui a construit une valeur
 * au lieu de la choisir, et ça se voit ici plutôt que trois écrans plus loin.
 */
export function findUnknownCatalogId(
  patch: BriefPatch,
  catalog: Catalog
): { field: string; id: string } | null {
  for (const [field, pick] of Object.entries(ID_SOURCES)) {
    const value = patch[field as keyof BriefPatch];
    if (value === undefined || value === null) continue;

    const known = new Set(pick(catalog).map((entry) => entry.id));
    const ids = Array.isArray(value) ? value : [value];

    for (const id of ids) {
      if (typeof id === "string" && !known.has(id)) return { field, id };
    }
  }
  return null;
}

/* ── Lectures ───────────────────────────────────────────────────────────── */

export type BriefBundle = {
  project: ProjectRow;
  brief: BriefRow;
  data: BriefData;
};

/**
 * Le brief d'un projet, à condition qu'il appartienne à cet utilisateur.
 *
 * Renvoie `null` aussi bien quand le projet n'existe pas que quand il est à
 * quelqu'un d'autre : l'appelant répond 404 dans les deux cas.
 */
export async function loadBrief(
  supabase: Client,
  projectId: string,
  userId: string
): Promise<BriefBundle | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !project) return null;

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!brief) return null;

  return { project, brief, data: parseBriefData(brief.data) };
}

/**
 * Le modèle de prévisualisation, tel que la base le compose.
 *
 * `brief_preview()` résout elle-même les ids de catalogue et pose ses propres
 * replis : le rail a donc toujours quelque chose à rendre, dès l'étape 1. Une
 * prévisualisation qui affiche éternellement les replis est le symptôme d'un
 * brief dont les colonnes ne sont pas écrites, pas d'un bug de rendu.
 */
export async function readPreview(
  supabase: Client,
  projectId: string
): Promise<PreviewModel | null> {
  const { data, error } = await supabase.rpc("brief_preview", {
    p_brief_id: projectId,
  });

  if (error) {
    console.error("[brief] brief_preview", error);
    return null;
  }

  const parsed = previewModelSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[brief] brief_preview shape", parsed.error.issues);
    return null;
  }
  return parsed.data;
}

/* ── Écriture ───────────────────────────────────────────────────────────── */

export type PatchOutcome =
  | { ok: true; brief: BriefRow; data: BriefData; preview: PreviewModel | null }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "unknown-id"; field: string; id: string }
  | { ok: false; reason: "write-failed"; detail: unknown };

/**
 * Applique un correctif d'autosave et renvoie le brief ET sa prévisualisation
 * dans le MÊME aller-retour (§5) : le rail n'a pas de seconde requête à faire,
 * donc pas de fenêtre où il montre l'état d'avant.
 */
export async function patchBrief(
  supabase: Client,
  projectId: string,
  userId: string,
  patch: BriefPatch
): Promise<PatchOutcome> {
  const existing = await loadBrief(supabase, projectId, userId);
  if (!existing) return { ok: false, reason: "not-found" };

  const catalog = await readCatalog(supabase);
  const unknown = findUnknownCatalogId(patch, catalog);
  if (unknown) return { ok: false, reason: "unknown-id", ...unknown };

  const { data: dataPatch, ...columns } = patch;

  /*
   * `data` est FUSIONNÉ, pas remplacé : l'autosave n'envoie que le champ qui
   * vient de changer, et écraser le reste effacerait les réponses libres des
   * autres étapes.
   */
  const nextData =
    dataPatch === undefined ? existing.data : { ...existing.data, ...dataPatch };

  const { data: brief, error } = await supabase
    .from("project_briefs")
    .update({
      ...columns,
      ...(dataPatch === undefined ? {} : { data: nextData }),
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error || !brief) {
    return { ok: false, reason: "write-failed", detail: error };
  }

  const preview = await readPreview(supabase, projectId);

  return { ok: true, brief, data: parseBriefData(brief.data), preview };
}
