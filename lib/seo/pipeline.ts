import { ProviderRejected, ProviderUnavailable, SpendCapReached } from "@/lib/content/generate/openai";
import type { SeoKind } from "@/lib/seo/kinds";
import type { ClaimResult, ChecklistStep, InternalLink, SeoColumn } from "@/lib/seo/db";
import type { SeoContext } from "@/lib/seo/context";
import type { MonthPlan, StoredCandidate } from "@/lib/seo/plan";
import type { FailureReport, SeoWriterBrief } from "@/lib/seo/brief";
import type { SeoWriterPort, SeoWriteResult } from "@/lib/seo/writer";
import type { Finding } from "@/lib/seo/finding";
import { assembleBody, writerOutputSchema, type WriterOutput } from "@/lib/seo/output";
import { allText, deterministicFindings, slugFor } from "@/lib/seo/checks";
import { collisionFindings, distanceFindings, specificityFindings, type ComparedPiece } from "@/lib/seo/gates";
import { checklistFor, internalLinksFor, primaryJsonLd, type LinkablePiece } from "@/lib/seo/derive";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PIPELINE D'UN MOIS SEO — claim_seo_slot → WRITER → CONTRÔLES → seo_pieces
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Pour chaque cible du plan, dans l'ordre :
 *
 *   1. RÉSERVER    `claim_seo_slot`. Sans emplacement, rien ne part — et la base
 *                  refuserait de toute façon une pièce sans emplacement.
 *   2. RÉDIGER     un appel au rédacteur, dont le coût est RÉSERVÉ au livre
 *                  (`credit_ledger`, `overhead`) avant l'envoi et RÉGLÉ après.
 *   3. CONTRÔLER   dans cet ordre : schéma → phrases bannies → Ethics Guard →
 *                  gates (spécificité, distance, collision) → contrôles SEO et
 *                  règles du brief.
 *   4. UNE RÉÉCRITURE CIBLÉE si un contrôle échoue, avec le rapport d'échec.
 *   5. QUARANTAINE au second échec : la pièce est écrite `quarantined` (la base
 *                  rend l'emplacement, raison comprise), la cible est retirée.
 *                  JAMAIS de troisième appel : pas de boucle.
 *
 * ⚠ UNE PANNE DU FOURNISSEUR N'EST PAS UN ÉCHEC DE LA PIÈCE. Plafond atteint,
 * crédit épuisé, service indisponible : l'emplacement est RENDU, la cible
 * redevient disponible, et le mois de cette abonnée s'arrête là. Le
 * déclenchement suivant reprend ; aucune quarantaine n'est prononcée pour une
 * pièce que personne n'a pu écrire.
 *
 * Toutes les lectures et écritures passent par `PipelinePorts` : le module se
 * prouve entier avec des doublures, sans base ni modèle.
 */

export const MAX_ATTEMPTS = 2;

export type PieceInsert = {
  user_id: string;
  target_id: string;
  slot_id: string;
  month: string;
  kind: SeoKind;
  status: "needs_review" | "quarantined";
  title: string | null;
  meta_description: string | null;
  slug: string | null;
  h1: string | null;
  body_md: string | null;
  faq: Array<{ question: string; answer: string }> | null;
  schema_jsonld: Record<string, unknown> | null;
  internal_links: InternalLink[];
  checklist: ChecklistStep[];
  ethics_report: Record<string, unknown>;
  gates_report: Record<string, unknown>;
  writer_model: string;
  cost_usd: number;
  run_id: string;
};

/*
 * ⚠ UNE LIGNE NE NOMME QUE DES COLONNES DÉCLARÉES. `row` est une variable : le
 * contrôle d'excès de TypeScript ne s'y applique pas. Cette assertion échoue à la
 * compilation si `PieceInsert` gagne une clé que `SEO_COLUMNS.seo_pieces` (donc
 * la migration, par `rpc-contract.test.ts`) ne connaît pas.
 */
type UndeclaredPieceColumns = Exclude<keyof PieceInsert, SeoColumn<"seo_pieces">>;
export const PIECE_INSERT_COLUMNS_DECLARED: [UndeclaredPieceColumns] extends [never] ? true : never = true;

export type OwnPiece = ComparedPiece & LinkablePiece;

export type PipelinePorts = {
  claim(kind: SeoKind): Promise<ClaimResult>;
  release(claimId: string, reason: string): Promise<void>;
  assignTarget(targetId: string): Promise<void>;
  /** La cible redevient disponible (la pièce n'a pas pu être écrite). */
  unassignTarget(targetId: string): Promise<void>;
  /** La cible est retirée (quarantaine) : elle ne sera plus proposée. */
  retireTarget(targetId: string): Promise<void>;
  bannedPhrases(text: string): Promise<string[]>;
  /** Les règles BLOQUANTES de `ethics_scan`, avec leur extrait. */
  ethicsBlocks(text: string): Promise<Array<{ rule: string; excerpt: string }>>;
  /** Ses pièces non mises en quarantaine (distance, liens internes). */
  ownPieces(): Promise<OwnPiece[]>;
  /** Les pièces d'AUTRES abonnées sur la même modalité (et ville, pour une page locale). */
  peerPieces(target: StoredCandidate): Promise<ComparedPiece[]>;
  /** Réserve le coût au livre. `null` : le livre a refusé, l'appel ne part pas. */
  reserveCost(claimId: string, estimateUsd: number, model: string): Promise<string | null>;
  settleCost(reservationId: string, actualUsd: number, succeeded: boolean): Promise<void>;
  insertPiece(row: PieceInsert): Promise<string>;
};

export type PieceOutcome = {
  targetId: string;
  intentKey: string;
  kind: SeoKind;
  status: "needs_review" | "quarantined" | "not_claimed" | "stopped";
  pieceId?: string;
  attempts: number;
  /** Tous les contrôles passés dès le premier appel. */
  firstPass: boolean;
  costUsd: number;
  findings: Finding[];
  detail?: string;
};

export type MonthOutcome = { pieces: PieceOutcome[]; costUsd: number; stopped: string | null };

export type PipelineInput = {
  ctx: SeoContext;
  month: string;
  runId: string;
  plan: MonthPlan;
  writer: SeoWriterPort;
  ethicsRules: string[];
  bannedList: string[];
  /** Les termes de recherche, pour les faits de la grille. */
  terms: { modality: ReadonlyMap<string, string>; population: ReadonlyMap<string, string> };
};

class WriterStopped extends Error {}

export async function runSeoMonth(ports: PipelinePorts, input: PipelineInput): Promise<MonthOutcome> {
  const { ctx } = input;
  const pieces: PieceOutcome[] = [];
  let total = 0;
  const own = await ports.ownPieces();
  const allowedUrls = ctx.sources.map((s) => s.url);

  for (const kind of ["local_page", "article"] as const) {
    for (const target of input.plan.chosen[kind]) {
      /* ── 1. réserver ─────────────────────────────────────────────── */
      const claim = await ports.claim(kind);
      if (!claim.ok || !claim.claim_id) {
        pieces.push({ targetId: target.id, intentKey: target.intentKey, kind, status: "not_claimed", attempts: 0, firstPass: false, costUsd: 0, findings: [], detail: claim.reason });
        break; // ⚠ un refus de la base vaut pour tout ce genre ce mois-ci
      }
      const claimId = claim.claim_id;
      await ports.assignTarget(target.id);

      const brief = briefFor(target, input);
      let cost = 0;
      let failure: FailureReport | undefined;
      let firstFindings: Finding[] = [];
      let last: Evaluated | null = null;
      let model = input.writer.model;
      let attempts = 0;

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          attempts = attempt;
          /* ── 2. rédiger, au livre ──────────────────────────────────── */
          const request = { brief, failure };
          const reservation = await ports.reserveCost(claimId, input.writer.worstCaseUsd(request), input.writer.model);
          if (!reservation) throw new WriterStopped("the cost book refused the reservation");
          let result: SeoWriteResult;
          try {
            result = await input.writer.write(request);
          } catch (error) {
            await ports.settleCost(reservation, 0, false);
            if (error instanceof SpendCapReached || error instanceof ProviderUnavailable || error instanceof ProviderRejected) {
              throw new WriterStopped(error.message);
            }
            throw error;
          }
          await ports.settleCost(reservation, result.costUsd, true);
          cost += result.costUsd;
          model = result.model;

          /* ── 3. contrôler ──────────────────────────────────────────── */
          last = await evaluate(ports, input, target, result, own, allowedUrls);
          if (attempt === 1) firstFindings = last.findings;
          if (last.findings.length === 0) break;
          failure = { findings: last.findings, previous: result.output };
        }
      } catch (error) {
        if (!(error instanceof WriterStopped)) {
          await ports.release(claimId, `error: ${(error as Error).message}`.slice(0, 400));
          await ports.unassignTarget(target.id);
          throw error;
        }
        /* ⚠ une panne du fournisseur : on rend, on s'arrête, sans quarantaine */
        await ports.release(claimId, `writer stopped: ${error.message}`.slice(0, 400));
        await ports.unassignTarget(target.id);
        total += cost;
        pieces.push({ targetId: target.id, intentKey: target.intentKey, kind, status: "stopped", attempts, firstPass: false, costUsd: cost, findings: [], detail: error.message });
        return { pieces, costUsd: total, stopped: error.message };
      }

      total += cost;
      const passed = last !== null && last.findings.length === 0;
      const row = toInsert(input, target, claimId, last, {
        passed,
        cost,
        model,
        attempts,
        firstFindings,
        linkable: own,
      });

      /* ── 4 et 5. écrire, ou mettre en quarantaine ─────────────────────── */
      let pieceId: string | undefined;
      let status: PieceOutcome["status"] = passed ? "needs_review" : "quarantined";
      let detail: string | undefined;
      try {
        pieceId = await ports.insertPiece(row);
      } catch (error) {
        // ⚠ La base a refusé ce que les contrôles TS avaient laissé passer : la
        // base a raison (ce sont ses gardes qui comptent). Quarantaine, raison écrite.
        status = "quarantined";
        detail = `db refused: ${(error as Error).message}`.slice(0, 400);
        if (passed) {
          try {
            pieceId = await ports.insertPiece({
              ...row,
              status: "quarantined",
              gates_report: { ...row.gates_report, passed: false, reason: "db.refused", db_error: detail },
            });
          } catch {
            pieceId = undefined;
          }
        }
        // Même la quarantaine n'a pas pu s'écrire : on rend l'emplacement à la main.
        if (!pieceId) await ports.release(claimId, detail);
      }
      if (status === "quarantined") await ports.retireTarget(target.id);
      else if (last?.text && pieceId) own.push({ id: pieceId, text: last.text, title: row.title, slug: row.slug, status: "needs_review", published_url: null });

      pieces.push({
        targetId: target.id,
        intentKey: target.intentKey,
        kind,
        status,
        pieceId,
        attempts,
        firstPass: firstFindings.length === 0,
        costUsd: cost,
        findings: last?.findings ?? [],
        ...(detail ? { detail } : {}),
      });
    }
  }
  return { pieces, costUsd: total, stopped: null };
}

/* ── Le brief d'une cible ─────────────────────────────────────────────── */

function briefFor(target: StoredCandidate, input: PipelineInput): SeoWriterBrief {
  const { ctx } = input;
  return {
    kind: target.kind,
    primaryQuery: target.primaryQuery,
    modalityTerm: target.modalityKey ? (input.terms.modality.get(target.modalityKey) ?? null) : null,
    populationTerm: target.populationKey ? (input.terms.population.get(target.populationKey) ?? null) : null,
    city: target.kind === "local_page" ? target.city : null,
    state: target.kind === "local_page" ? target.state : null,
    practitioner: ctx.practitioner,
    brand: ctx.brand,
    sources: ctx.sources,
    ethicsRules: input.ethicsRules,
    bannedPhrases: input.bannedList,
  };
}

/* ── L'évaluation d'une réponse ───────────────────────────────────────── */

type Evaluated = {
  findings: Finding[];
  output: WriterOutput | null;
  bodyMd: string | null;
  slug: string;
  text: string | null;
  banned: string[];
  ethics: Array<{ rule: string; excerpt: string }>;
};

async function evaluate(
  ports: PipelinePorts,
  input: PipelineInput,
  target: StoredCandidate,
  result: SeoWriteResult,
  own: readonly OwnPiece[],
  allowedUrls: readonly string[]
): Promise<Evaluated> {
  const slug = slugFor(target.primaryQuery);
  const none: Evaluated = { findings: [], output: null, bodyMd: null, slug, text: null, banned: [], ethics: [] };

  /* 1. le schéma */
  if (result.output === null) {
    return { ...none, findings: [{ check: "schema.invalid", detail: result.problem ?? "no output" }] };
  }
  const parsed = writerOutputSchema.safeParse(result.output);
  if (!parsed.success) {
    return {
      ...none,
      findings: parsed.error.issues.slice(0, 8).map((i) => ({ check: "schema.invalid", detail: `${i.path.join(".") || "(root)"}: ${i.message}` })),
    };
  }
  const output = parsed.data;
  const bodyMd = assembleBody(output);
  const piece = {
    kind: target.kind,
    primaryQuery: target.primaryQuery,
    city: input.ctx.grid.city ? input.ctx.grid.city.trim() : null,
    state: input.ctx.grid.state ? input.ctx.grid.state.trim().toUpperCase() : null,
    title: output.title,
    meta: output.meta_description,
    h1: output.h1,
    slug,
    bodyMd,
    faq: output.faq,
  };
  const text = allText(piece);
  const findings: Finding[] = [];

  /* 2. phrases bannies, puis l'Ethics Guard — par la base, qui les appliquera à l'écriture */
  const banned = await ports.bannedPhrases(text);
  for (const phrase of banned) findings.push({ check: "banned_phrase", detail: `remove the phrase "${phrase}".` });
  const ethics = await ports.ethicsBlocks(text);
  for (const e of ethics) {
    findings.push({ check: `ethics.${e.rule}`, detail: `rewrite "${e.excerpt}": it breaks the ${e.rule} advertising rule for licensed clinicians.` });
  }

  /* 3. les gates adaptées au texte long */
  const body = `${bodyMd}\n${output.faq.map((f) => `${f.question} ${f.answer}`).join("\n")}`;
  findings.push(
    ...specificityFindings(text, {
      modalityTerm: target.modalityKey ? (input.terms.modality.get(target.modalityKey) ?? null) : null,
      populationTerm: target.populationKey ? (input.terms.population.get(target.populationKey) ?? null) : null,
      city: target.kind === "local_page" ? target.city : null,
      brandText: [input.ctx.brand.positioning, input.ctx.brand.usp].filter(Boolean).join(" "),
    }),
    ...distanceFindings(body, own),
    ...collisionFindings(body, await ports.peerPieces(target))
  );

  /* 4. les contrôles SEO et les règles du brief */
  findings.push(...deterministicFindings(piece, allowedUrls));

  return { findings, output, bodyMd, slug, text: body, banned, ethics };
}

/* ── La ligne à écrire ────────────────────────────────────────────────── */

function toInsert(
  input: PipelineInput,
  target: StoredCandidate,
  claimId: string,
  last: Evaluated | null,
  meta: { passed: boolean; cost: number; model: string; attempts: number; firstFindings: Finding[]; linkable: readonly LinkablePiece[] }
): PieceInsert {
  const { ctx } = input;
  const output = last?.output ?? null;
  const topic = target.modalityKey ? (input.terms.modality.get(target.modalityKey) ?? null) : null;
  const finalFindings = last?.findings ?? [{ check: "schema.invalid", detail: "no output" }];
  return {
    user_id: ctx.userId,
    target_id: target.id,
    slot_id: claimId,
    month: input.month,
    kind: target.kind,
    status: meta.passed ? "needs_review" : "quarantined",
    title: output?.title ?? null,
    meta_description: output?.meta_description ?? null,
    slug: last?.slug ?? null,
    h1: output?.h1 ?? null,
    body_md: last?.bodyMd ?? null,
    faq: output?.faq ?? null,
    schema_jsonld: output
      ? primaryJsonLd({
          kind: target.kind,
          title: output.title,
          meta: output.meta_description,
          practitioner: ctx.practitioner,
          topic,
          place: target.kind === "local_page" && target.city && target.state ? `${target.city}, ${target.state}` : null,
          url: null,
        })
      : null,
    internal_links: internalLinksFor(null, meta.linkable, ctx.siteUrl),
    checklist: checklistFor(ctx.builder, { kind: target.kind, slug: last?.slug ?? slugFor(target.primaryQuery) }),
    ethics_report: { banned: last?.banned ?? [], blocks: last?.ethics ?? [] },
    gates_report: {
      passed: meta.passed,
      attempts: meta.attempts,
      first_pass: meta.firstFindings.length === 0,
      first_findings: meta.firstFindings,
      final_findings: meta.passed ? [] : finalFindings,
      ...(meta.passed ? {} : { reason: finalFindings[0]?.check ?? "unknown" }),
    },
    writer_model: meta.model,
    cost_usd: Math.round(meta.cost * 1e6) / 1e6,
    run_id: input.runId,
  };
}
