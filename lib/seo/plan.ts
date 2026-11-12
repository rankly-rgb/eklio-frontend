import type { SeoKind } from "@/lib/seo/kinds";
import { seoQuotaFor, type SeoClient, type TargetRow } from "@/lib/seo/db";
import { readMetrics, readSearchTerms, readTargets, readTemplates, type SeoContext } from "@/lib/seo/context";
import {
  chooseMonthTargets,
  deriveTargets,
  normalizeState,
  rankTargets,
  targetMatchesBrief,
  type CandidateTarget,
} from "@/lib/seo/targets";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLAN DU MOIS D'UNE ABONNÉE — CE QU'ON ESSAIERA D'ÉCRIRE, DANS L'ORDRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1. le quota du mois, PAR LA BASE (`seo_quota_for`) — zéro partout : rien
 *      d'autre n'est lu ni écrit ;
 *   2. les cibles de sa grille sont dérivées (`deriveTargets`) et enregistrées
 *      `available` — une intention déjà connue n'est pas réécrite
 *      (UNIQUE (user_id, intent_key)) ;
 *   3. ses intentions déjà assignées ou retirées sont exclues ;
 *   4. les disponibles qui visent encore son brief sont classées et choisies.
 *
 * ⚠ CE PLAN NE RÉSERVE RIEN. `claim_seo_slot` est appelée par le pipeline, cible
 * par cible, juste avant d'écrire : le plan peut proposer, la base dispose.
 */

export type StoredCandidate = CandidateTarget & { id: string };

export type MonthPlan = {
  quota: Record<SeoKind, number>;
  chosen: Record<SeoKind, StoredCandidate[]>;
  /** Combien de ses intentions étaient déjà prises (anti-cannibalisation). */
  excluded: number;
};

export async function planSeoMonth(db: SeoClient, ctx: SeoContext, month: string): Promise<MonthPlan> {
  const quota = await seoQuotaFor(db, { userId: ctx.userId, month });
  const empty: MonthPlan = { quota, chosen: { local_page: [], article: [] }, excluded: 0 };
  if (quota.local_page + quota.article === 0) return empty;

  const [templates, terms, metrics] = await Promise.all([
    readTemplates(db),
    readSearchTerms(db),
    readMetrics(db, normalizeState(ctx.grid.state)),
  ]);

  /* ── 2. dériver et enregistrer ─────────────────────────────────────── */
  const derived = deriveTargets(ctx.grid, templates, terms);
  if (derived.length > 0) {
    const { error } = await db.from("seo_targets").upsert(
      derived.map((t) => ({
        user_id: ctx.userId,
        brand_kit_id: ctx.brandKitId,
        kind: t.kind,
        template_id: t.templateId,
        modality_key: t.modalityKey,
        population_key: t.populationKey,
        state: t.state,
        city: t.city,
        primary_query: t.primaryQuery,
        intent_key: t.intentKey,
      })),
      { onConflict: "user_id,intent_key", ignoreDuplicates: true }
    );
    if (error) throw new Error(`seo_targets upsert: ${error.message}`);
  }

  /* ── 3 et 4. exclure, classer, choisir ─────────────────────────────── */
  const stored = await readTargets(db, ctx.userId);
  const taken = new Set(stored.filter((t) => t.status !== "available").map((t) => t.intent_key));
  const priority = new Map(templates.map((t) => [t.id, t.priority]));
  const pool = stored
    .filter((t) => t.status === "available")
    .map((t) => toCandidate(t, ctx, priority))
    .filter((t) => targetMatchesBrief(t, ctx.grid));

  return {
    quota,
    chosen: chooseMonthTargets(rankTargets(pool, metrics), taken, quota),
    excluded: taken.size,
  };
}

function toCandidate(row: TargetRow, ctx: SeoContext, priority: Map<string, number>): StoredCandidate {
  const m = row.modality_key ? ctx.grid.modalityKeys.indexOf(row.modality_key) : 0;
  const p = row.population_key ? ctx.grid.populationKeys.indexOf(row.population_key) : 0;
  return {
    id: row.id,
    kind: row.kind,
    templateId: row.template_id,
    modalityKey: row.modality_key,
    populationKey: row.population_key,
    state: row.state,
    city: row.city,
    primaryQuery: row.primary_query,
    intentKey: row.intent_key,
    priority: priority.get(row.template_id) ?? 1000,
    modalityRank: m < 0 ? 99 : m,
    populationRank: p < 0 ? 99 : p,
  };
}
