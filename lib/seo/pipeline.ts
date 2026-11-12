import { ProviderRejected, ProviderUnavailable, SpendCapReached } from "@/lib/content/generate/openai";
import type { SeoKind } from "@/lib/seo/kinds";
import type { ClaimResult, ChecklistStep, InternalLink, SeoColumn } from "@/lib/seo/db";
import type { SeoContext } from "@/lib/seo/context";
import type { MonthPlan, StoredCandidate } from "@/lib/seo/plan";
import type { FailureReport, SeoWriterBrief } from "@/lib/seo/brief";
import type { FieldRepairRequest, RepairableField, SeoWriterPort, SeoWriteResult } from "@/lib/seo/writer";
import type { Finding } from "@/lib/seo/finding";
import { assembleBody, sectionsOf, writerOutputSchema, type WriterOutput } from "@/lib/seo/output";
import { allText, deterministicFindings, sentenceCase, slugFor } from "@/lib/seo/checks";
import {
  collisionFindings,
  distanceFindings,
  questionOverlapFindings,
  specificityFindings,
  type ComparedPiece,
} from "@/lib/seo/gates";
import { checklistFor, internalLinksFor, primaryJsonLd, type LinkablePiece } from "@/lib/seo/derive";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PIPELINE D'UN MOIS SEO — claim_seo_slot → WRITER → CONTRÔLES → seo_pieces
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Pour chaque cible du plan (les étapes 1–2 en parallèle, la suite dans l'ordre — voir
 * `runSeoMonth`) :
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

export type PassStage = "first" | "field_repair" | "rewrite" | null;

/** Les constats qu'une réparation de champ peut lever, et le champ qu'elle répare. */
const REPAIRABLE: Record<string, (f: Finding) => RepairableField | null> = {
  "seo.meta_length": () => "meta_description",
  "seo.title_length": () => "title",
  "seo.query_missing": (f) => (f.detail.startsWith("the title ") ? "title" : null),
};

/** Les champs à réparer, ou null si un seul constat sort de ce que la réparation sait faire. */
export function repairableFields(findings: readonly Finding[]): RepairableField[] | null {
  if (findings.length === 0) return null;
  const fields = new Set<RepairableField>();
  for (const f of findings) {
    const field = REPAIRABLE[f.check]?.(f) ?? null;
    if (!field) return null;
    fields.add(field);
  }
  return [...fields];
}

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

/** Une de ses pièces : son texte (distance), ses champs de lien, et les questions qu'elle traite déjà. */
export type OwnPiece = ComparedPiece & LinkablePiece & { questions: string[] };

/** Les questions qu'une pièce traite : ses titres H2 et les questions de sa FAQ. */
export function questionsOf(bodyMd: string | null, faq: ReadonlyArray<{ question?: string }> | null): string[] {
  return [...sectionsOf(bodyMd ?? "").map((s) => s.heading), ...(faq ?? []).map((f) => f.question ?? "").filter(Boolean)];
}

export type PipelinePorts = {
  claim(kind: SeoKind): Promise<ClaimResult>;
  release(claimId: string, reason: string): Promise<void>;
  /**
   * Prend la cible, SEULEMENT si elle est encore disponible (session 3). `false` : une
   * autre exécution la tient — deux appels simultanés ne l'écrivent jamais deux fois.
   */
  assignTarget(targetId: string): Promise<boolean>;
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
  /**
   * Où la pièce a passé tous les contrôles : au premier appel, après la réparation
   * d'un champ (session 3), après la réécriture complète — ou nulle part (null).
   */
  stage: PassStage;
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

/** Le livre d'UNE pièce : chaque appel payant réservé puis réglé ; son coût et son modèle. */
type Bill = {
  cost: number;
  model: string;
  paid<T extends { costUsd: number; model: string }>(worst: number, call: () => Promise<T>): Promise<T>;
};

/** Une cible après la phase A : un premier jet en main, ou une issue déjà connue. */
type Drafted =
  | { kind: SeoKind; target: StoredCandidate; done: PieceOutcome }
  | { kind: SeoKind; target: StoredCandidate; failed: unknown }
  | { kind: SeoKind; target: StoredCandidate; claimId: string; bill: Bill; siblings: string[]; brief: SeoWriterBrief; first: SeoWriteResult };

/*
 * ⚠ DEUX PHASES (session 3), POUR LE DÉBIT SANS PERDRE LES CONTRÔLES CROISÉS.
 *
 *   A. EN PARALLÈLE   réserver (`claim_seo_slot`, atomique en base), prendre la cible
 *                     (conditionnellement : une autre exécution qui la tient déjà la
 *                     garde), et écrire le premier jet — les trois appels longs du mois
 *                     partent ensemble.
 *   B. DANS L'ORDRE   contrôler chaque jet contre ses pièces ET celles que ce mois vient
 *                     d'accepter (distance, questions répétées), réparer un champ,
 *                     réécrire, écrire ou mettre en quarantaine. La réécriture repart
 *                     d'un brief rafraîchi, qui voit les questions de ses sœurs.
 *
 * Une panne du fournisseur arrête TOUT appel suivant du mois (`stopped`) ; les jets déjà
 * payés sont encore contrôlés, et écrits s'ils passent sans nouvel appel.
 */
export async function runSeoMonth(ports: PipelinePorts, input: PipelineInput): Promise<MonthOutcome> {
  const pieces: PieceOutcome[] = [];
  let total = 0;
  let stopped: string | null = null;
  const own = await ports.ownPieces();
  const allowedUrls = input.ctx.sources.map((s) => s.url);
  const ordered = (["local_page", "article"] as const).flatMap((kind) => input.plan.chosen[kind].map((target) => ({ kind, target })));
  const askedSoFar = () => [...own].reverse().flatMap((o) => o.questions);

  const billFor = (claimId: string): Bill => {
    const bill: Bill = {
      cost: 0,
      model: input.writer.model,
      async paid(worst, call) {
        if (stopped) throw new WriterStopped(stopped);
        const reservation = await ports.reserveCost(claimId, worst, input.writer.model);
        if (!reservation) {
          stopped ??= "the cost book refused the reservation";
          throw new WriterStopped(stopped);
        }
        let out;
        try {
          out = await call();
        } catch (error) {
          await ports.settleCost(reservation, 0, false);
          if (error instanceof SpendCapReached || error instanceof ProviderUnavailable || error instanceof ProviderRejected) {
            stopped ??= error.message;
            throw new WriterStopped(error.message);
          }
          throw error;
        }
        await ports.settleCost(reservation, out.costUsd, true);
        bill.cost += out.costUsd;
        bill.model = out.model;
        return out;
      },
    };
    return bill;
  };

  const unwritten = (kind: SeoKind, target: StoredCandidate, status: "not_claimed" | "stopped", detail: string | undefined, attempts = 0, costUsd = 0): PieceOutcome => ({
    targetId: target.id,
    intentKey: target.intentKey,
    kind,
    status,
    attempts,
    firstPass: false,
    stage: null,
    costUsd,
    findings: [],
    ...(detail ? { detail } : {}),
  });

  /** Rend l'emplacement et la cible d'une pièce qui ne sera pas écrite. */
  const giveBack = async (claimId: string, target: StoredCandidate, why: string) => {
    await ports.release(claimId, why.slice(0, 400));
    await ports.unassignTarget(target.id);
  };

  /* ── A. réserver, prendre la cible, premier jet — en parallèle ─────────── */
  const drafted: Drafted[] = await Promise.all(
    ordered.map(async ({ kind, target }): Promise<Drafted> => {
      const claim = await ports.claim(kind);
      if (!claim.ok || !claim.claim_id) return { kind, target, done: unwritten(kind, target, "not_claimed", claim.reason) };
      const claimId = claim.claim_id;
      /* ⚠ une autre exécution tient déjà cette cible : on lui rend l'emplacement, sans appel */
      if (!(await ports.assignTarget(target.id))) {
        await ports.release(claimId, "target already assigned by another run");
        return { kind, target, done: unwritten(kind, target, "not_claimed", "target_taken") };
      }
      const siblings = ordered.filter((o) => o.target.id !== target.id).map((o) => o.target.primaryQuery);
      const brief = briefFor(target, input, askedSoFar(), siblings);
      const bill = billFor(claimId);
      try {
        const request = { brief };
        const first = await bill.paid(input.writer.worstCaseUsd(request), () => input.writer.write(request));
        return { kind, target, claimId, bill, siblings, brief, first };
      } catch (error) {
        if (error instanceof WriterStopped) {
          await giveBack(claimId, target, `writer stopped: ${error.message}`);
          return { kind, target, done: unwritten(kind, target, "stopped", error.message, 1, bill.cost) };
        }
        await giveBack(claimId, target, `error: ${(error as Error).message}`);
        return { kind, target, failed: error };
      }
    })
  );

  /* ── B. contrôler, réparer, réécrire, écrire — dans l'ordre du plan ───── */
  const errors: unknown[] = [];
  for (const d of drafted) {
    if ("done" in d) {
      total += d.done.costUsd;
      pieces.push(d.done);
      continue;
    }
    if ("failed" in d) {
      errors.push(d.failed);
      continue;
    }
    const { kind, target, claimId, bill } = d;
    let failure: FailureReport | undefined;
    let firstFindings: Finding[] = [];
    let last: Evaluated | null = null;
    let attempts = 0;
    let stage: PassStage = null;
    const repaired: RepairableField[] = [];
    const paid = bill.paid;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        attempts = attempt;
        /* ── 2. le premier jet (phase A), ou une réécriture au livre ─────── */
        let result: SeoWriteResult;
        if (attempt === 1) {
          result = d.first;
        } else {
          // Le brief rafraîchi : il voit maintenant les questions des pièces acceptées ce mois.
          const request = { brief: briefFor(target, input, askedSoFar(), d.siblings), failure };
          result = await paid(input.writer.worstCaseUsd(request), () => input.writer.write(request));
        }

        /* ── 3. contrôler ──────────────────────────────────────────── */
        last = await evaluate(ports, input, target, result, own, allowedUrls);
        if (attempt === 1) firstFindings = last.findings;
        if (last.findings.length === 0) {
          stage = attempt === 1 ? "first" : "rewrite";
          break;
        }

        /*
         * ── 3 bis. LA RÉPARATION DU SEUL CHAMP FAUTIF (session 3) ───────
         * Après le premier passage seulement, et seulement quand TOUS les
         * constats portent sur la longueur de la meta ou du title : un appel
         * court par champ, puis la pièce réparée repasse par TOUS les contrôles.
         * Si elle échoue encore, on revient au chemin d'avant : la réécriture
         * complète, puis la quarantaine.
         */
        const fields = attempt === 1 && last.output ? repairableFields(last.findings) : null;
        if (fields && last.output) {
          let output: WriterOutput = last.output;
          let complete = true;
          for (const field of fields) {
            const req: FieldRepairRequest = {
              field,
              current: output[field],
              problem: last.findings.filter((f) => REPAIRABLE[f.check]?.(f) === field).map((f) => f.detail).join(" "),
              primaryQuery: target.primaryQuery,
              h1: output.h1,
              intro: output.intro,
            };
            const fix = await paid(input.writer.worstCaseRepairUsd(req), () => input.writer.repairField(req));
            if (!fix.value) {
              complete = false;
              break;
            }
            output = { ...output, [field]: fix.value };
            repaired.push(field);
          }
          if (complete) {
            const again = await evaluate(ports, input, target, { ...result, output }, own, allowedUrls);
            if (again.findings.length === 0) {
              last = again;
              stage = "field_repair";
              break;
            }
            last = again;
          }
        }
        failure = { findings: last.findings, previous: last.output ?? result.output };
      }
    } catch (error) {
      if (!(error instanceof WriterStopped)) {
        await giveBack(claimId, target, `error: ${(error as Error).message}`);
        errors.push(error);
        continue;
      }
      /* ⚠ une panne du fournisseur : on rend, sans quarantaine ; les jets suivants sont encore lus */
      await giveBack(claimId, target, `writer stopped: ${error.message}`);
      total += bill.cost;
      pieces.push(unwritten(kind, target, "stopped", error.message, attempts, bill.cost));
      continue;
    }

    const cost = bill.cost;
    const model = bill.model;
    total += cost;
    const passed = last !== null && last.findings.length === 0;
    const row = toInsert(input, target, claimId, last, {
      passed,
      cost,
      model,
      attempts,
      firstFindings,
      linkable: own,
      stage,
      repaired,
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
    else if (last?.text && pieceId) {
      own.push({
        id: pieceId,
        text: last.text,
        title: row.title,
        slug: row.slug,
        status: "needs_review",
        published_url: null,
        questions: questionsOf(row.body_md, row.faq),
      });
    }

    pieces.push({
      targetId: target.id,
      intentKey: target.intentKey,
      kind,
      status,
      pieceId,
      attempts,
      firstPass: firstFindings.length === 0,
      stage: status === "needs_review" ? stage : null,
      costUsd: cost,
      findings: last?.findings ?? [],
      ...(detail ? { detail } : {}),
    });
  }
  // Une erreur hors fournisseur remonte, APRÈS que les autres pièces du mois ont été écrites ou rendues.
  if (errors.length > 0) throw errors[0];
  return { pieces, costUsd: total, stopped };
}

/* ── Le brief d'une cible ─────────────────────────────────────────────── */

function briefFor(target: StoredCandidate, input: PipelineInput, answeredElsewhere: string[], siblingQueries: string[] = []): SeoWriterBrief {
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
    // Les plus récentes d'abord ; 80 au plus (à 40, la liste était tronquée dès le 3ᵉ mois).
    answeredElsewhere: [...new Set(answeredElsewhere)].slice(0, 80),
    siblingQueries,
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
  // Une requête recopiée en minuscules ne fait pas un titre : la casse de tête est posée en code.
  const output = { ...parsed.data, title: sentenceCase(parsed.data.title), h1: sentenceCase(parsed.data.h1) };
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
    ...questionOverlapFindings(
      questionsOf(bodyMd, output.faq),
      own.flatMap((o) => o.questions),
      [...input.terms.modality.values()]
    ),
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
  meta: {
    passed: boolean;
    cost: number;
    model: string;
    attempts: number;
    firstFindings: Finding[];
    linkable: readonly LinkablePiece[];
    stage: PassStage;
    repaired: RepairableField[];
  }
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
      // Session 3 : où elle a passé (first | field_repair | rewrite), et quels champs ont été réparés.
      stage: meta.passed ? meta.stage : null,
      repaired_fields: meta.repaired,
      first_findings: meta.firstFindings,
      final_findings: meta.passed ? [] : finalFindings,
      ...(meta.passed ? {} : { reason: finalFindings[0]?.check ?? "unknown" }),
    },
    writer_model: meta.model,
    cost_usd: Math.round(meta.cost * 1e6) / 1e6,
    run_id: input.runId,
  };
}
