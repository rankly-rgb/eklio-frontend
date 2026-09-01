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
  /*
   * Étape 1 — l'étape de vie du cabinet.
   *
   * ÉCART SIGNALÉ : le §5 demande des « stage cards », mais le schéma backend
   * ne porte aucune table de catalogue pour ce choix, contrairement à
   * `site_goals` ou `specialties`. Il vit donc ici, dans la part libre du
   * brief, et personne d'autre ne le lit. Une table `practice_stages` et une
   * colonne `project_briefs.practice_stage_id` sont demandées au dépôt de
   * schéma ; le jour où elles existent, cette clé disparaît.
   */
  stage: z.string().max(40).optional(),
  /** Étape 2 — « or say it your way », côté problème puis côté gain. */
  problem_text: z.string().max(400).optional(),
  gain_text: z.string().max(400).optional(),
  /** Étape 7 — constructeur visé et site existant. */
  builder_target: z
    .enum(["squarespace", "lovable", "framer", "webflow"])
    .optional(),
  existing_url: z.string().max(200).optional(),
  /*
   * Étape 1 — le nom de la PRATICIENNE, seul.
   *
   * ⚠ Distinct de `practitioner_line`, et les deux doivent le rester.
   * `practitioner_line` est une chaîne COMPOSÉE (« Nora Whitfield, LCSW »)
   * rendue sur la story `signature` ; le semeur du spec de site a besoin du
   * nom NU pour `practice_details.practitioner_name`, et le backend a
   * justement refusé de redécouper la ligne composée en morceaux — un nom qui
   * contient une virgule, un titre en deux mots, un suffixe : ça ne se
   * réanalyse pas.
   *
   * D'où une question à part, à l'étape 1, à côté du nom du cabinet. Le champ
   * est FACULTATIF : c'est un brief, pas un formulaire d'ordre. Mais sans lui,
   * la praticienne ne découvre le manque que dans l'éditeur de site, après
   * sept écrans passés à parler de sa practice.
   *
   * Rien dans CE dépôt ne lit la clé : c'est le semeur, côté base, qui la
   * reprend dans `practice_details.practitioner_name`. Le nom est donc calé
   * sur le sien, exactement.
   */
  practitioner_name: z.string().max(80).optional(),
  /** Nom et titre du praticien, rendus sur la story `signature`. */
  practitioner_line: z.string().max(80).optional(),
  /** Le rappel « We draft in plain, board-safe language » n'est montré qu'une fois. */
  suggestion_notice_seen: z.boolean().optional(),
  /*
   * Étape 5 — la carte de ton GÉNÉRÉE choisie, quand il y en a une.
   *
   * ÉCART SIGNALÉ : `project_briefs.tone_card_id` référence uniquement le
   * catalogue statique `tone_cards` (clé étrangère). Une carte générée par
   * `/api/briefs/:id/tone-cards` vit dans `project_briefs.tone_cards`
   * (jsonb, six éléments, §9.4 du contrat) et n'a pas de ligne de catalogue à
   * référencer — la colonne existante ne peut donc pas la pointer. Elle vit
   * ici, dans la part libre du brief, en suivant exactement le précédent de
   * `stage` ci-dessus. `tone_card_id` reste `null` tant qu'une carte générée
   * est sélectionnée ; les deux sont mutuellement exclusifs côté lecture.
   */
  selected_tone_card_id: z.string().optional(),
  /*
   * Écran de positionnement — combien de fois « Write me three more » a été
   * utilisé sur CE brief.
   *
   * ÉCART SIGNALÉ : §2.4 plafonne ce bouton à deux usages par brief, mais le
   * contrat ne porte aucune colonne dédiée pour ce compteur (contrairement à
   * `usp_fingerprints`, qui n'existe que pour la confirmation finale). Suit
   * le même précédent que `stage`/`selected_tone_card_id` : vit dans la part
   * libre, personne d'autre ne le lit. Le plafond réel de sécurité reste le
   * rate limit de la route (20/heure) ; ce compteur est la règle produit.
   */
  usp_regenerate_count: z.number().int().min(0).optional(),
  /*
   * Empreinte des réponses de l'étape 4 au moment où `usp_options` a été
   * écrit pour la dernière fois — `lib/generation/how-you-work-hash.ts`,
   * MÊME fonction que `tone_cards_inputs_hash` (correction demandée :
   * l'invalidation sur édition de l'étape 4 doit valoir pour les options USP
   * aussi, pas seulement pour les cartes de ton).
   *
   * ÉCART SIGNALÉ : `tone_cards_inputs_hash` a sa PROPRE colonne
   * (§9.2 du contrat) ; il n'existe pas d'équivalent pour `usp_options`. Vit
   * ici, dans la part libre, même précédent que le reste de ce bloc.
   */
  usp_options_inputs_hash: z.string().optional(),
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
    /*
     * Étape 4 — « How you work » (contrat §9.2). `usp_options`, `usp_statement`
     * (post-génération), `tone_cards` et `tone_cards_inputs_hash` NE SONT PAS
     * ici : ce sont les générateurs serveur qui les écrivent, avec la clé
     * service-role, jamais un correctif client direct.
     */
    session_style_ids: z.array(z.string()).max(4).nullable(),
    not_a_fit_ids: z.array(z.string()).max(3).nullable(),
    not_a_fit_text: z.string().max(400).nullable(),
    modality_ids: z.array(z.string()).max(5).nullable(),
    modality_prominence: z.string().nullable(),
    referral_quote: z.string().max(400).nullable(),
    prior_career: z.string().max(200).nullable(),
    prior_career_public: z.boolean(),
    /* Le texte choisi APRÈS édition — c'est lui que la génération consomme, pas `selected_usp_id`. */
    usp_statement: z.string().max(200).nullable(),
    selected_usp_id: z.string().nullable(),
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
  session_style_ids: (c: Catalog) => c.sessionStyleCards,
  not_a_fit_ids: (c: Catalog) => c.notAFitCards,
  modality_ids: (c: Catalog) => c.modalityCards,
  modality_prominence: (c: Catalog) => c.modalityProminenceOptions,
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

/**
 * Écrit les six cartes de ton GÉNÉRÉES et leur empreinte d'entrées (§2.2).
 * Distinct de `patchBrief` à dessein : ces deux colonnes ne sont JAMAIS dans
 * `briefPatchSchema` — seul le générateur serveur les écrit, jamais un
 * correctif client direct.
 */
export async function writeToneCards(
  supabase: Client,
  projectId: string,
  toneCards: BriefRow["tone_cards"],
  inputsHash: string
): Promise<{ ok: true } | { ok: false; detail: unknown }> {
  const { error } = await supabase
    .from("project_briefs")
    .update({
      tone_cards: toneCards,
      tone_cards_inputs_hash: inputsHash,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  if (error) return { ok: false, detail: error };
  return { ok: true };
}

/**
 * Écrit les options USP GÉNÉRÉES (§2.5). `selected_usp_id` et `usp_statement`
 * sont remis à `null` dans le MÊME appel : un choix précédent référence des
 * ids d'un lot désormais remplacé, et le trigger
 * `project_briefs_validate_selected_usp_id` exige que `selected_usp_id`
 * corresponde à un id présent dans `usp_options` quand il n'est pas `null`.
 */
/**
 * ⚠ NE remet PAS `selected_usp_id`/`usp_statement` à `null` (correction
 * demandée) : régénérer remplace des CANDIDATS, jamais sa décision déjà
 * confirmée. `usp_statement` est du texte libre — l'omettre du payload le
 * laisse tel quel, sans risque.
 *
 * `selected_usp_id`, lui, dépend du trigger `project_briefs_validate_selected_usp_id`
 * (§9.2 du contrat) : s'il revalide `NEW.selected_usp_id` contre
 * `NEW.usp_options` sur CHAQUE update de la ligne (et pas seulement quand
 * `selected_usp_id` change), cet appel échouera dès qu'un id confirmé
 * existant ne se retrouve pas dans le lot régénéré — puisque ce module ne
 * peut pas lire la définition du trigger depuis le frontend, c'est un risque
 * à vérifier côté migration, pas une garantie que ce module peut donner.
 */
export async function writeUspOptions(
  supabase: Client,
  projectId: string,
  uspOptions: BriefRow["usp_options"],
  data: BriefData
): Promise<{ ok: true } | { ok: false; detail: unknown }> {
  const { error } = await supabase
    .from("project_briefs")
    .update({
      usp_options: uspOptions,
      data,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  if (error) return { ok: false, detail: error };
  return { ok: true };
}

/**
 * Écrit UNIQUEMENT la part libre — utilisé quand un lot incomplet (§9.5, pas
 * d'écriture de `usp_options` possible) doit quand même faire avancer
 * `usp_regenerate_count` : l'utilisation d'une reprise se compte même quand
 * elle échoue à produire trois survivants.
 */
export async function writeBriefData(
  supabase: Client,
  projectId: string,
  data: BriefData
): Promise<{ ok: true } | { ok: false; detail: unknown }> {
  const { error } = await supabase
    .from("project_briefs")
    .update({ data, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  if (error) return { ok: false, detail: error };
  return { ok: true };
}
