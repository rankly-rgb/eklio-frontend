/*
 * ══════════════════════════════════════════════════════════════════════════
 *  RÉGÉNÉRER UNE PIÈCE POUR VÉRIFIER UNE CORRECTION DU BRIEF — SANS L'ÉCRIRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ HARNAIS. Le brief, le rédacteur et les contrôles sont ceux du PRODUIT
 * (`readSeoContext`, `writerSystemPrompt` via `openAiSeoWriter`, `assembleBody`,
 * `deterministicFindings`). Le coût est RÉSERVÉ puis RÉGLÉ dans `credit_ledger`
 * (`reserve_credit` / `settle_credit`, en overhead, rattaché à l'emplacement de la
 * pièce), donc compté dans le plafond de session.
 * Ce qui n'est PAS le produit : la pièce régénérée n'est pas écrite dans
 * `seo_pieces` — son emplacement est déjà utilisé ; on mesure, on ne remplace pas.
 *
 *   … bun scripts/seo-pages/regen-check.ts --confirm --since <…> --piece <uuid> [--piece <uuid>] --out <json>
 */
import { writeFileSync } from "node:fs";
import { arg, prepareSession, spentSince } from "./session";

const { since } = await prepareSession();
const ids = process.argv.flatMap((a, i) => (process.argv[i - 1] === "--piece" ? [a] : []));
if (ids.length === 0) throw new Error("--piece <uuid> requis");

const { createAdminClient } = await import("@/lib/supabase/server");
const { seoDb } = await import("@/lib/seo/db");
const { readSeoContext, readSearchTerms } = await import("@/lib/seo/context");
const { openAiTransport, spendMeter } = await import("@/lib/content/generate/openai");
const { SEO_MONTH_CAP_USD } = await import("@/lib/seo/kinds");
const { openAiSeoWriter } = await import("@/lib/seo/writer");
const { ethicsRulesFor } = await import("@/lib/content/generate/ethics-rules");
const { assembleBody, writerOutputSchema } = await import("@/lib/seo/output");
const { deterministicFindings, sentenceCase, slugFor } = await import("@/lib/seo/checks");
const { serverPipelinePorts } = await import("@/lib/seo/server-ports");
const { questionsOf } = await import("@/lib/seo/pipeline");
const { questionOverlapFindings } = await import("@/lib/seo/gates");

const admin = createAdminClient();
const db = seoDb(admin);
const results = [];
for (const id of ids) {
  const { data: piece } = await db.from("seo_pieces").select("id, user_id, target_id, slot_id, month, kind, meta_description").eq("id", id).single();
  const { data: target } = await db.from("seo_targets").select("*").eq("id", piece.target_id).single();
  const ctx = await readSeoContext(db, piece.user_id);
  if (!ctx.ok) throw new Error(`context: ${ctx.reason}`);
  const terms = await readSearchTerms(db);
  const rules = await ethicsRulesFor(admin);
  const banned = await admin.from("banned_phrases").select("phrase").eq("active", true);
  const ports = serverPipelinePorts(admin, { userId: piece.user_id, month: piece.month });
  /* La liste « déjà sur son site », comme le pipeline la construit : ses autres pièces, les plus récentes d'abord. */
  const own = (await ports.ownPieces()).filter((o) => o.id !== id);
  const answeredElsewhere = [...new Set([...own].reverse().flatMap((o) => o.questions))].slice(0, 80);
  const ownQuestions = own.flatMap((o) => o.questions);
  const writer = openAiSeoWriter({ transport: openAiTransport(process.env.OPENAI_API_KEY!), meter: spendMeter(SEO_MONTH_CAP_USD) });
  const brief = {
    kind: target.kind,
    primaryQuery: target.primary_query,
    modalityTerm: target.modality_key ? (terms.modality.get(target.modality_key) ?? null) : null,
    populationTerm: target.population_key ? (terms.population.get(target.population_key) ?? null) : null,
    city: target.kind === "local_page" ? target.city : null,
    state: target.kind === "local_page" ? target.state : null,
    practitioner: ctx.context.practitioner,
    brand: ctx.context.brand,
    sources: ctx.context.sources,
    ethicsRules: rules.map((r) => `${r.short_label}: ${r.description}`),
    bannedPhrases: (banned.data ?? []).map((r) => r.phrase),
    answeredElsewhere,
  };
  const reservation = await ports.reserveCost(piece.slot_id, writer.worstCaseUsd({ brief }), writer.model);
  if (!reservation) throw new Error("le livre a refusé la réservation");
  const res = await writer.write({ brief });
  await ports.settleCost(reservation, res.costUsd, true);
  const parsed = writerOutputSchema.safeParse(res.output);
  const findings = parsed.success
    ? [...questionOverlapFindings(questionsOf(assembleBody(parsed.data), parsed.data.faq), ownQuestions, [...terms.modality.values()]), ...deterministicFindings(
        {
          kind: target.kind,
          primaryQuery: target.primary_query,
          city: ctx.context.grid.city,
          state: ctx.context.grid.state,
          title: sentenceCase(parsed.data.title),
          meta: parsed.data.meta_description,
          h1: sentenceCase(parsed.data.h1),
          slug: slugFor(target.primary_query),
          bodyMd: assembleBody(parsed.data),
          faq: parsed.data.faq,
        },
        ctx.context.sources.map((s) => s.url)
      )]
    : [{ check: "schema.invalid", detail: parsed.error.issues[0]?.message ?? "" }];
  results.push({
    piece: id,
    intent: target.intent_key,
    before: { metaLength: piece.meta_description?.length ?? null },
    after: { metaLength: parsed.success ? parsed.data.meta_description.length : null, findings },
    costUsd: res.costUsd,
  });
}
const out = { label: "REGENERATION CHECK — product brief/writer/checks, NOT written to seo_pieces", spentUsd: (await spentSince(since)).usd, results };
console.log(JSON.stringify(out, null, 2));
const OUT = arg("--out");
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
