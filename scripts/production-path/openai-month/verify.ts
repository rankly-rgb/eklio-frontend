/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CE QUE LA BASE PORTE, RELU APRÈS COUP — PAS CE QUE L'ORCHESTRATEUR A DIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LA MESURE ET CE QU'ELLE MESURE SONT DEUX LECTURES DIFFÉRENTES (F48). Ce
 * fichier ne lit pas le rapport du lanceur : il relit le mois en base, PAR LE
 * CHEMIN DE LECTURE, sous l'identité de la praticienne, le recompose comme la
 * route d'image le compose, repasse les contrôles, relit le livre de crédit, et
 * tente une réservation au-delà du quota. Il ne parle à aucun modèle.
 *
 * ⚠ CE QUI N'EST PAS LE CHEMIN DE LECTURE À L'IDENTIQUE, ET POURQUOI :
 *   la palette   la route la prend dans les directions du kit ; le kit local n'en a
 *                pas (setup.ts), et la route rendrait 409 sur les trente. On passe
 *                la palette de la première famille du brief, celle du lanceur.
 *   le PNG       `composeToPng` demande `@resvg/resvg-js`, non installable ici : la
 *                vérification porte sur le SVG que la route rasteriserait.
 *
 *   bun scripts/production-path/openai-month/verify.ts --kit <id> --month 2026-12-01
 */
import { readFileSync, writeFileSync } from "node:fs";
import { localDb } from "../local-db";
import { arg } from "./session";
import { licenceMentionFor, reviewCardFor } from "@/lib/content/review";
import { carouselSlides } from "@/lib/content/slides";
import { render } from "@/lib/compose/engine";
import { footerCarriesLicence } from "@/lib/content/licence";
import { checkMonth, checkPostAlone, type MonthUnderCheck, type PostUnderCheck } from "@/lib/content/month-checks";
import { identityAllowList, type PractitionerFacts } from "@/lib/content/practitioner";
import { serverCreditPort } from "@/lib/credits/server-port";
import type { ContentItem } from "@/lib/data/content";

const KIT = arg("--kit");
const MONTH = arg("--month") ?? "2026-12-01";
const OUT = arg("--out") ?? "verify.json";
if (!KIT) throw new Error("--kit manquant");

async function main() {
  const service = localDb();
  const kitRow = (await service.read<{ project_id: string; user_id: string }>(
    "select bk.project_id, p.user_id from public.brand_kits bk join public.projects p on p.id = bk.project_id where bk.id = $1", [KIT]))[0];
  const her = localDb(undefined, kitRow.user_id);

  /* ── 1. le mois, par le chemin de lecture, sous son identité ───────────── */
  const read = await her.rpc("get_content_month", { p_brand_kit_id: KIT, p_month: MONTH });
  if (read.error) throw new Error(`get_content_month: ${read.error.message}`);
  const month = read.data as { items: ContentItem[]; error?: unknown };
  if (!Array.isArray(month.items)) throw new Error(`get_content_month a refusé : ${JSON.stringify(read.data)}`);

  const brief = (await service.read<{ practice_name: string; city: string; state: string; modality_ids: string[]; palette_family_ids: string[] }>(
    "select practice_name, city, state, modality_ids, palette_family_ids from public.project_briefs where project_id = $1", [kitRow.project_id]))[0];
  const fam = (await service.read<Record<string, string>>(
    "select primary_hex, secondary_hex, light_hex, dark_hex, paper_hex from public.palette_families where id = $1", [brief.palette_family_ids[0]]))[0];
  const palette = { primary: fam.primary_hex, secondary: fam.secondary_hex, light: fam.light_hex, dark: fam.dark_hex, paper: fam.paper_hex };

  /* ⚠ LA MENTION EST RELUE EN BASE PAR LA FONCTION DE LA ROUTE, pas reprise du lanceur. */
  const mention = await licenceMentionFor(her as never, kitRow.project_id);

  const cards: Array<{ id: string; title: string; archetype: string; footer: string; svgs: string[]; vector: boolean; licenceOnFooter: boolean; licenceInSvg: boolean; error?: string }> = [];
  const posts: PostUnderCheck[] = [];
  for (const item of month.items) {
    const card = await reviewCardFor(her as never, item, palette, brief.practice_name, mention);
    if (!card) {
      cards.push({ id: item.id, title: item.title, archetype: "?", footer: "", svgs: [], vector: false, licenceOnFooter: false, licenceInSvg: false, error: "reviewCardFor a rendu null" });
      continue;
    }
    let svgs: string[] = [];
    let error: string | undefined;
    try {
      const slides = carouselSlides(card);
      if (slides.kind === "slides") svgs = slides.slides.map((s) => s.svg);
      else if (slides.kind === "refused") error = slides.message;
      else svgs = [render({ archetype: card.archetypeKey, payload: card.payload, palette: card.palette, eyebrow: card.eyebrow, headline: card.headline, footer: card.footer }).svg];
    } catch (e) {
      error = (e as Error).message;
    }
    /*
     * ⚠ « VECTORIELLE » VEUT DIRE : DU SVG, ET AUCUNE IMAGE MATRICIELLE DEDANS.
     * Un SVG qui embarquerait un `<image href="data:image/png…">` passerait le
     * premier critère et tromperait le second.
     */
    const vector = svgs.length > 0 && svgs.every((s) => s.trimStart().startsWith("<svg") && !/<image\b|data:image\//i.test(s));
    const digits = (mention ?? "").replace(/\D/g, "");
    cards.push({
      id: item.id, title: item.title, archetype: card.archetypeKey, footer: card.footer, svgs, vector,
      licenceOnFooter: Boolean(mention) && footerCarriesLicence(card.footer, mention!),
      licenceInSvg: digits.length > 0 && svgs.length > 0 && svgs.every((s) => s.includes(digits)),
      ...(error ? { error } : {}),
    });
    posts.push({
      archetype: card.archetypeKey, title: item.title, cardLine: item.title, payload: card.payload,
      svg: svgs[0], eyebrow: card.eyebrow, footer: card.footer,
      caption: item.caption ?? undefined, altText: item.alt_text ?? undefined,
    });
  }

  /* ── 2. tous les contrôles, sur toutes les surfaces, sur ce qui a été RELU ─ */
  const intents = await service.read<{ id: string; label: string }>("select id, label from public.content_intents");
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name, city: brief.city, state: brief.state,
    modalities: brief.modality_ids.map((m) => m.toUpperCase()), takingClients: "yes",
  };
  const context: Omit<MonthUnderCheck, "posts" | "wanted"> = {
    direction: palette, practiceName: brief.practice_name, identityAllowList: identityAllowList(facts),
    modalities: facts.modalities, licenceMention: mention ?? undefined, eyebrowCatalogue: intents,
  } as never;
  const monthFindings = checkMonth({ ...context, posts, wanted: 30 } as MonthUnderCheck);
  const aloneFindings = posts.flatMap((p) => checkPostAlone(p, context as never).map((f) => ({ title: p.title, ...f })));

  /* ── 3. le livre de crédit ─────────────────────────────────────────────── */
  const ledger = await service.read<{ entry_type: string; n: number; delta: number; actual: number | null }>(
    `select entry_type, count(*)::int as n, sum(delta)::int as delta, sum(actual_cost_usd)::float as actual
       from public.credit_ledger where user_id = $1 and month = $2::date and kind = 'post_generation' group by 1 order by 1`,
    [kitRow.user_id, MONTH]);
  const audit = await service.read("select * from public.credit_month_audit where user_id = $1 and month = $2::date", [kitRow.user_id, MONTH]);
  const remaining = await service.rpc("credit_remaining", { p_user: kitRow.user_id, p_kind: "post_generation", p_month: MONTH });

  /* ── 4. un quota épuisé est refusé PAR LE SQL ──────────────────────────── */
  const before = Number((await service.read<{ n: number }>("select count(*)::int as n from public.credit_ledger"))[0].n);
  const credits = serverCreditPort(service as never, { provider: "openai", model: "quota-probe", month: MONTH });
  const probe = await credits.reserve({ userId: kitRow.user_id, kind: "post_generation", reason: "quota probe after the month" });
  const after = Number((await service.read<{ n: number }>("select count(*)::int as n from public.credit_ledger"))[0].n);

  /* ── 5. la reprise : un sujet n'est rédigé qu'une fois, un post n'est débité qu'une fois ─ */
  const run = (await service.read<{ id: string; state: string; cost_usd: number }>(
    "select id, state, cost_usd::float as cost_usd from public.content_generation_runs where brand_kit_id = $1 and month = $2::date", [KIT, MONTH]))[0];
  const runTopics = (await service.read<{ topic_id: string }>(
    "select topic_id from public.content_generation_results where run_id = $1", [run.id])).map((r) => r.topic_id);
  const since = arg("--since");
  const calls = readFileSync("design/production-first-month/openai-calls.jsonl", "utf8").split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as { at: string; label: string; usd: number })
    .filter((c) => !since || c.at >= since);
  const writes = new Map<string, number>();
  for (const c of calls) {
    const m = /^rédaction (\S+)$/.exec(c.label);
    if (m && runTopics.includes(m[1])) writes.set(m[1], (writes.get(m[1]) ?? 0) + 1);
  }
  const reservationsPerItem = await service.read<{ n: number }>(
    `select count(*)::int as n from public.credit_ledger
      where user_id = $1 and month = $2::date and kind = 'post_generation' and entry_type = 'reservation'`, [kitRow.user_id, MONTH]);

  const report = {
    label: "chemin produit, base locale, OpenAI — relu par le chemin de lecture (get_content_month sous l'identité de la praticienne, reviewCardFor, render) ; palette du brief à la place des directions du kit ; SVG sans rasterisation",
    month: MONTH,
    readPath: { items: month.items.length, statuses: month.items.reduce<Record<string, number>>((a, i) => ((a[i.status] = (a[i.status] ?? 0) + 1), a), {}) },
    licence: {
      mentionReadFromDatabase: mention,
      onFooter: cards.filter((c) => c.licenceOnFooter).length,
      inEverySvg: cards.filter((c) => c.licenceInSvg).length,
    },
    cards: {
      composed: cards.filter((c) => c.svgs.length > 0).length,
      vector: cards.filter((c) => c.vector).length,
      slides: cards.reduce((a, c) => a + c.svgs.length, 0),
      errors: cards.filter((c) => c.error).map((c) => ({ title: c.title, error: c.error })),
      byArchetype: cards.reduce<Record<string, number>>((a, c) => ((a[c.archetype] = (a[c.archetype] ?? 0) + 1), a), {}),
    },
    checks: { month: monthFindings, alone: aloneFindings },
    ledger: { byEntry: ledger, audit, remaining: remaining.data },
    quotaProbe: { outcome: probe, ledgerRowsBefore: before, ledgerRowsAfter: after },
    resume: {
      runState: run.state, runCostUsd: run.cost_usd, topicsInRun: runTopics.length,
      topicsWrittenMoreThanOnce: [...writes.entries()].filter(([, n]) => n > 1),
      topicsWrittenOnce: [...writes.values()].filter((n) => n === 1).length,
      reservations: reservationsPerItem[0].n,
    },
  };
  writeFileSync(`design/production-first-month/${OUT}`, JSON.stringify(report, null, 2));
  writeFileSync(`design/production-first-month/${OUT.replace(/\.json$/, "")}-cards.json`, JSON.stringify(cards.map((c) => ({ title: c.title, archetype: c.archetype, footer: c.footer, svgs: c.svgs })), null, 0));
  const { cards: _c, ...summary } = report;
  void _c;
  console.log(JSON.stringify({ ...summary, cards: { ...report.cards } }, null, 2));
  await service.close();
  await her.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
