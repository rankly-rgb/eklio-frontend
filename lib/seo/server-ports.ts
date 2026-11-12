import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/supabase";
import { ethicsRulesFor } from "@/lib/content/generate/ethics-rules";
import { claimSeoSlot, releaseSeoSlot, seoDb, seoPatch, type SeoClient } from "@/lib/seo/db";
import { readSearchTerms, readSeoContext, type ContextOutcome } from "@/lib/seo/context";
import { planSeoMonth, type MonthPlan } from "@/lib/seo/plan";
import { questionsOf, runSeoMonth, type MonthOutcome, type OwnPiece, type PipelinePorts } from "@/lib/seo/pipeline";
import type { SeoWriterPort } from "@/lib/seo/writer";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES PORTS DU PIPELINE SEO, SUR LA VRAIE BASE (service_role)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chaque écriture passe par une porte de la base : `claim_seo_slot`,
 * `release_seo_slot`, `reserve_credit` / `settle_credit` (le livre unique de tout
 * appel payant, en `overhead` : une page SEO ne consomme aucun crédit de post),
 * et l'INSERT dans `seo_pieces`, que trois triggers gardent (emplacement,
 * éthique, phrases bannies).
 */

type Admin = SupabaseClient<Database>;

const PEER_LIMIT = 200;

export function serverPipelinePorts(admin: Admin, input: { userId: string; month: string }): PipelinePorts {
  const db: SeoClient = seoDb(admin);
  const { userId, month } = input;

  async function setTargetStatus(targetId: string, status: "assigned" | "available" | "retired", from: string[]) {
    const patch = seoPatch("seo_targets", { status, assigned_month: status === "available" ? null : month });
    const { error } = await db
      .from("seo_targets")
      .update(patch)
      .eq("id", targetId)
      .eq("user_id", userId)
      .in("status", from);
    if (error) throw new Error(`seo_targets ${status}: ${error.message}`);
  }

  async function piecesText(rows: Array<{ id: string; body_md: string | null; faq: unknown }>): Promise<Array<{ id: string; text: string }>> {
    return rows.map((r) => ({
      id: r.id,
      text: `${r.body_md ?? ""}\n${(Array.isArray(r.faq) ? (r.faq as Array<{ question?: string; answer?: string }>) : [])
        .map((f) => `${f.question ?? ""} ${f.answer ?? ""}`)
        .join("\n")}`,
    }));
  }

  return {
    claim: (kind) => claimSeoSlot(db, { userId, month, kind }),
    async release(claimId, reason) {
      await releaseSeoSlot(db, claimId, reason);
    },
    assignTarget: (id) => setTargetStatus(id, "assigned", ["available"]),
    unassignTarget: (id) => setTargetStatus(id, "available", ["assigned"]),
    retireTarget: (id) => setTargetStatus(id, "retired", ["available", "assigned"]),

    async bannedPhrases(text) {
      const { data, error } = await admin.rpc("usp_banned_phrases_check", { p_text: text });
      if (error) throw new Error(`usp_banned_phrases_check: ${error.message}`);
      return (data ?? []) as string[];
    },

    async ethicsBlocks(text) {
      const { data, error } = await admin.rpc("ethics_scan", { p_text: text });
      if (error) throw new Error(`ethics_scan: ${error.message}`);
      return z
        .array(z.object({ rule_id: z.string(), severity: z.string(), excerpt: z.string() }))
        .parse(data ?? [])
        .filter((v) => v.severity === "block")
        .map((v) => ({ rule: v.rule_id, excerpt: v.excerpt }));
    },

    async ownPieces() {
      const { data, error } = await db
        .from("seo_pieces")
        .select("id, title, slug, status, published_url, body_md, faq")
        .eq("user_id", userId)
        .neq("status", "quarantined")
        .order("created_at");
      if (error) throw new Error(`seo_pieces (own): ${error.message}`);
      const rows = (data ?? []) as Array<{ id: string; title: string | null; slug: string | null; status: string; published_url: string | null; body_md: string | null; faq: unknown }>;
      const texts = await piecesText(rows);
      return rows.map((r, i): OwnPiece => ({
        ...r,
        text: texts[i].text,
        questions: questionsOf(r.body_md, Array.isArray(r.faq) ? (r.faq as Array<{ question?: string }>) : null),
      }));
    },

    async peerPieces(target) {
      let query = db
        .from("seo_targets")
        .select("id")
        .neq("user_id", userId)
        .eq("kind", target.kind)
        .limit(PEER_LIMIT);
      query = target.modalityKey ? query.eq("modality_key", target.modalityKey) : query.eq("population_key", target.populationKey);
      if (target.kind === "local_page") query = query.eq("city", target.city).eq("state", target.state);
      const targets = await query;
      if (targets.error) throw new Error(`seo_targets (peers): ${targets.error.message}`);
      const ids = ((targets.data ?? []) as Array<{ id: string }>).map((t) => t.id);
      if (ids.length === 0) return [];
      const { data, error } = await db
        .from("seo_pieces")
        .select("id, body_md, faq")
        .in("target_id", ids)
        .neq("status", "quarantined")
        .limit(PEER_LIMIT);
      if (error) throw new Error(`seo_pieces (peers): ${error.message}`);
      return piecesText((data ?? []) as Array<{ id: string; body_md: string | null; faq: unknown }>);
    },

    async reserveCost(claimId, estimateUsd, model) {
      const { data, error } = await admin.rpc("reserve_credit", {
        p_user: userId,
        p_kind: "overhead",
        p_reason: "seo_piece_write",
        p_ref_type: "seo_slot",
        p_ref_id: claimId,
        p_estimated_cost_usd: Math.round(estimateUsd * 1e6) / 1e6,
        p_provider: "openai",
        p_model: model,
        p_month: month,
      });
      if (error) throw new Error(`reserve_credit: ${error.message}`);
      const r = z.object({ ok: z.boolean(), reservation_id: z.string().optional() }).parse(data);
      return r.ok && r.reservation_id ? r.reservation_id : null;
    },

    async settleCost(reservationId, actualUsd, succeeded) {
      const { error } = await admin.rpc("settle_credit", {
        p_reservation_id: reservationId,
        p_actual_cost_usd: Math.round(actualUsd * 1e6) / 1e6,
        p_succeeded: succeeded,
      });
      if (error) throw new Error(`settle_credit: ${error.message}`);
    },

    async insertPiece(row) {
      const values = seoPatch("seo_pieces", row);
      const { data, error } = await db.from("seo_pieces").insert(values).select("id").single();
      if (error) throw new Error(`seo_pieces insert: ${error.message}`);
      return (data as { id: string }).id;
    },
  };
}

/* ── Un mois pour une abonnée ─────────────────────────────────────────── */

export type UserMonthOutcome =
  | { userId: string; ok: false; stage: "context"; refusal: Extract<ContextOutcome, { ok: false }> }
  | { userId: string; ok: false; stage: "quota"; plan: MonthPlan }
  | { userId: string; ok: true; plan: MonthPlan; month: MonthOutcome };

export async function runSeoMonthForUser(
  admin: Admin,
  input: { userId: string; month: string; runId: string; writer: SeoWriterPort }
): Promise<UserMonthOutcome> {
  const db = seoDb(admin);
  /* ⚠ Le préalable d'abord : un refus ici n'a rien réservé ni dépensé. */
  const context = await readSeoContext(db, input.userId);
  if (!context.ok) return { userId: input.userId, ok: false, stage: "context", refusal: context };

  const plan = await planSeoMonth(db, context.context, input.month);
  if (plan.chosen.local_page.length + plan.chosen.article.length === 0) {
    return { userId: input.userId, ok: false, stage: "quota", plan };
  }

  const [rules, banned, terms] = await Promise.all([
    ethicsRulesFor(admin),
    admin.from("banned_phrases").select("phrase").eq("active", true),
    readSearchTerms(db),
  ]);
  if (banned.error) throw new Error(`banned_phrases: ${banned.error.message}`);

  const month = await runSeoMonth(serverPipelinePorts(admin, { userId: input.userId, month: input.month }), {
    ctx: context.context,
    month: input.month,
    runId: input.runId,
    plan,
    writer: input.writer,
    ethicsRules: rules.map((r) => `${r.short_label}: ${r.description}`),
    bannedList: (banned.data ?? []).map((r) => r.phrase),
    terms,
  });
  return { userId: input.userId, ok: true, plan, month };
}

/**
 * Les comptes à considérer : quiconque a un abonnement vivant ou un octroi comp.
 *
 * ⚠ CE N'EST PAS LA RÈGLE D'ÉLIGIBILITÉ. Elle est en base (`seo_quota_for`), et
 * un compte qui n'y a pas droit ressort d'ici, puis s'arrête à 0 sans rien
 * réserver. Ce filtre ne sert qu'à ne pas parcourir toute la table des profils.
 * Contrairement au mois Instagram (`serverDuePort`), les octrois comp SANS
 * abonnement en font partie.
 */
export async function seoCandidateUsers(admin: Admin): Promise<string[]> {
  const nowIso = new Date().toISOString();
  const [subs, comps] = await Promise.all([
    admin.from("subscriptions").select("user_id").in("status", ["active", "trialing", "past_due"]),
    admin.from("comp_grants").select("user_id").is("revoked_at", null).gt("expires_at", nowIso),
  ]);
  if (subs.error) throw new Error(`subscriptions: ${subs.error.message}`);
  if (comps.error) throw new Error(`comp_grants: ${comps.error.message}`);
  return [...new Set([...(subs.data ?? []), ...(comps.data ?? [])].map((r) => r.user_id))].sort();
}
