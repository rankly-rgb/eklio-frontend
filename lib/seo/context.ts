import { z } from "zod";
import { licenceMention } from "@/lib/content/licence";
import { serverPreflightPort } from "@/lib/content/month/server-ports";
import { TARGET_COLUMNS, targetRowSchema, type SeoClient, type TargetRow } from "@/lib/seo/db";
import { normalizeState, type BriefGrid, type QueryTemplate, type SearchTerms } from "@/lib/seo/targets";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE LE PIPELINE SEO LIT D'UNE ABONNÉE — AVANT TOUTE RÉSERVATION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Tout ce qu'une pièce affirme sur la praticienne vient d'ici, et d'ici
 * seulement : la grille (modalités, personas, ville, État), son nom, sa licence,
 * sa marque, son constructeur de site. Rien n'est demandé au modèle qu'on ne
 * lui ait donné.
 *
 * ⚠ UN REFUS ICI NE COÛTE RIEN. Un brief sans ville, une licence sans numéro,
 * un État dont la règle publicitaire n'a pas été lue (F12) : l'abonnée est
 * écartée AVANT `claim_seo_slot`, aucun emplacement n'est pris, aucun appel n'est
 * fait. Même ordre que le préalable Instagram (`preflight.ts`).
 *
 * Les colonnes, et pourquoi celles-là (DIAGNOSTIC.md §6) :
 *   - `project_briefs.state` / `city` : l'autorité unique du lieu (F76) ;
 *   - `project_briefs.client_persona_ids` : les « populations » du brief ;
 *   - `project_briefs.builder_target_id` : le constructeur choisi (la checklist) ;
 *   - `site_specs.practice_details.practitioner_name` : le nom de l'autrice ;
 *   - la licence par `serverPreflightPort().licenceFacts` / `.stateVerified`,
 *     les mêmes lectures que le mois Instagram.
 */

export type Practitioner = {
  name: string;
  /** Le sigle tel que l'État l'imprime (« LMFT »), ou null quand la matrice n'en a pas. */
  credential: string | null;
  /** La mention de licence (« LMFT 123456 »), selon les règles de son État. */
  licenceMention: string;
};

export type Brand = {
  practiceName: string;
  positioning: string;
  usp: string;
  soundsLike: string[];
  neverWrite: string[];
};

export type Source = { label: string; url: string };

export type SeoContext = {
  userId: string;
  brandKitId: string;
  projectId: string;
  grid: BriefGrid;
  practitioner: Practitioner;
  brand: Brand;
  /** `builder_targets.id`, ou `generic` quand le brief n'en dit rien. */
  builder: string;
  siteUrl: string | null;
  sources: Source[];
};

export type SeoRefusal =
  | "no_brand_kit"
  | "no_brief"
  | "practitioner_name_missing"
  | "licence_missing"
  | "state_unverified"
  | "no_modality";

export type ContextOutcome = { ok: true; context: SeoContext } | { ok: false; reason: SeoRefusal; detail: string };

const briefSchema = z.object({
  project_id: z.string(),
  modality_ids: z.array(z.string()).nullable(),
  client_persona_ids: z.array(z.string()).nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  builder_target_id: z.string().nullable(),
  site_url: z.string().nullable(),
  practice_name: z.string().nullable(),
  positioning: z.string().nullable(),
  usp_statement: z.string().nullable(),
});

const voiceSchema = z
  .object({ sounds_like: z.array(z.string()).optional(), never_write: z.array(z.string()).optional() })
  .nullable()
  .catch(null);

/**
 * Le kit d'une abonnée : son kit NON SUPPRIMÉ LE PLUS RÉCENT — la règle de
 * `queueFirstContentMonth` et du mois Instagram (`serverDuePort`).
 */
export async function latestKitFor(
  db: SeoClient,
  userId: string
): Promise<{ brandKitId: string; projectId: string } | null> {
  const { data, error } = await db
    .from("brand_kits")
    .select("id, project_id, created_at, projects!inner(user_id)")
    .eq("projects.user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`brand_kits: ${error.message}`);
  const row = (data ?? [])[0] as { id: string; project_id: string } | undefined;
  return row ? { brandKitId: row.id, projectId: row.project_id } : null;
}

export async function readSeoContext(db: SeoClient, userId: string): Promise<ContextOutcome> {
  const kit = await latestKitFor(db, userId);
  if (!kit) return { ok: false, reason: "no_brand_kit", detail: "no live brand kit" };

  const briefRead = await db
    .from("project_briefs")
    .select(
      "project_id, modality_ids, client_persona_ids, state, city, builder_target_id, site_url, practice_name, positioning, usp_statement"
    )
    .eq("project_id", kit.projectId)
    .maybeSingle();
  if (briefRead.error) throw new Error(`project_briefs: ${briefRead.error.message}`);
  if (!briefRead.data) return { ok: false, reason: "no_brief", detail: kit.projectId };
  const brief = briefSchema.parse(briefRead.data);

  const modalityKeys = (brief.modality_ids ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (modalityKeys.length === 0) return { ok: false, reason: "no_modality", detail: "the brief names no modality" };

  /* ── la licence : les MÊMES lectures que le mois Instagram ──────────── */
  const preflight = serverPreflightPort(db as never);
  const facts = await preflight.licenceFacts(kit.projectId);
  const mention = licenceMention(facts);
  if (!mention || !facts.licenseTypeId) {
    return { ok: false, reason: "licence_missing", detail: "licence type or number missing from the brief" };
  }
  const state = normalizeState(facts.stateCode);
  if (!state || !(await preflight.stateVerified(facts.licenseTypeId, state))) {
    return {
      ok: false,
      reason: "state_unverified",
      detail: `state ${state ?? "(none)"} is not verified for ${facts.licenseTypeId} (F12)`,
    };
  }

  /* ── l'autrice ─────────────────────────────────────────────────────── */
  const specRead = await db
    .from("site_specs")
    .select("practice_details")
    .eq("brand_kit_id", kit.brandKitId)
    .maybeSingle();
  if (specRead.error) throw new Error(`site_specs: ${specRead.error.message}`);
  const details = (specRead.data?.practice_details ?? {}) as { practitioner_name?: unknown };
  const name = typeof details.practitioner_name === "string" ? details.practitioner_name.trim() : "";
  if (!name) {
    return { ok: false, reason: "practitioner_name_missing", detail: "site_specs.practice_details.practitioner_name" };
  }

  const kitRead = await db.from("brand_kits").select("voice_guide").eq("id", kit.brandKitId).maybeSingle();
  if (kitRead.error) throw new Error(`brand_kits: ${kitRead.error.message}`);
  const voice = voiceSchema.parse(kitRead.data?.voice_guide ?? null);

  const sourcesRead = await db
    .from("insight_sources")
    .select("label, url")
    .eq("active", true)
    .not("url", "is", null)
    .order("sort_order");
  if (sourcesRead.error) throw new Error(`insight_sources: ${sourcesRead.error.message}`);

  return {
    ok: true,
    context: {
      userId,
      brandKitId: kit.brandKitId,
      projectId: kit.projectId,
      grid: {
        modalityKeys,
        populationKeys: (brief.client_persona_ids ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean),
        state: brief.state,
        city: brief.city,
      },
      practitioner: { name, credential: facts.abbreviation ?? null, licenceMention: mention },
      brand: {
        practiceName: (brief.practice_name ?? "").trim() || name,
        positioning: (brief.positioning ?? "").trim(),
        usp: (brief.usp_statement ?? "").trim(),
        soundsLike: voice?.sounds_like ?? [],
        neverWrite: voice?.never_write ?? [],
      },
      builder: (brief.builder_target_id ?? "").trim() || "generic",
      siteUrl: (brief.site_url ?? "").trim() || null,
      sources: z.array(z.object({ label: z.string(), url: z.string() })).parse(sourcesRead.data ?? []),
    },
  };
}

/* ── La banque, les termes, les métriques, ses cibles ─────────────────── */

export async function readTemplates(db: SeoClient): Promise<QueryTemplate[]> {
  const { data, error } = await db
    .from("seo_query_templates")
    .select("id, kind, query_pattern, intent_pattern, priority, active");
  if (error) throw new Error(`seo_query_templates: ${error.message}`);
  return z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["local_page", "article"]),
        query_pattern: z.string(),
        intent_pattern: z.string(),
        priority: z.number(),
        active: z.boolean(),
      })
    )
    .parse(data ?? [])
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      queryPattern: r.query_pattern,
      intentPattern: r.intent_pattern,
      priority: r.priority,
      active: r.active,
    }));
}

export async function readSearchTerms(db: SeoClient): Promise<SearchTerms> {
  const [m, p] = await Promise.all([
    db.from("seo_modality_terms").select("modality_id, term"),
    db.from("seo_population_terms").select("persona_id, term"),
  ]);
  if (m.error) throw new Error(`seo_modality_terms: ${m.error.message}`);
  if (p.error) throw new Error(`seo_population_terms: ${p.error.message}`);
  return {
    modality: new Map(
      z.array(z.object({ modality_id: z.string(), term: z.string() })).parse(m.data ?? []).map((r) => [r.modality_id, r.term])
    ),
    population: new Map(
      z.array(z.object({ persona_id: z.string(), term: z.string() })).parse(p.data ?? []).map((r) => [r.persona_id, r.term])
    ),
  };
}

/** Les volumes de son État et nationaux. Vide en v1 : la table l'est. */
export async function readMetrics(db: SeoClient, state: string | null): Promise<Map<string, number>> {
  const states = state ? [state, "US"] : ["US"];
  const { data, error } = await db.from("seo_query_metrics").select("query_norm, state, monthly_volume").in("state", states);
  if (error) throw new Error(`seo_query_metrics: ${error.message}`);
  const rows = z
    .array(z.object({ query_norm: z.string(), state: z.string(), monthly_volume: z.number() }))
    .parse(data ?? []);
  return new Map(rows.map((r) => [`${r.query_norm}|${r.state}`, r.monthly_volume]));
}

export async function readTargets(db: SeoClient, userId: string): Promise<TargetRow[]> {
  const { data, error } = await db.from("seo_targets").select(TARGET_COLUMNS).eq("user_id", userId);
  if (error) throw new Error(`seo_targets: ${error.message}`);
  return z.array(targetRowSchema).parse(data ?? []);
}
