/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PREMIER MOIS DU CHEMIN PRODUIT — CE QU'ON PEUT PROUVER SANS CLEF
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE, ET ELLE EST LA PREMIÈRE CHOSE QUE CE FICHIER DIT :
 *
 *   chemin produit, base locale — RÉDACTION REJOUÉE depuis un mois déjà payé.
 *
 * Le compte fournisseur est sous limite d'usage jusqu'au 2026-10-01 00:00 UTC :
 * `claude-haiku-4-5` et `claude-sonnet-5` refusent tous deux avant le premier
 * jeton. Aucun mois ne peut donc être RÉDIGÉ aujourd'hui, par le chemin produit
 * comme par le harnais.
 *
 * Ce qui PEUT être prouvé, et qui l'est ici, contre le vrai PostgreSQL :
 *
 *   le préalable          les cinq refus, dont la porte F46 sur `verified_at`
 *   le tirage             la ronde par famille contre la vraie banque
 *   la composition        trente cartes vectorielles, pied de licence compris
 *   les contrôles         le portillon par post, puis checkMonth sur les retenus
 *   le crédit             `reserve_credit` / `settle_credit`, et `EK010` au SQL
 *   l'écriture            `content_items`, avec ses cinq gâchettes déontologiques
 *   le journal            les deux tables, et la reprise sans repayer
 *
 * Ce qui ne peut PAS l'être : que le modèle écrive juste du premier coup. C'est
 * la mesure M0, et elle attend le 1ᵉʳ octobre.
 *
 * ── ⚠ POURQUOI REJOUER PLUTÔT QUE FABRIQUER ─────────────────────────────
 *
 * Fabriquer des payloads ferait passer ce lancement en satisfaisant les
 * contrôles sans faire le travail — ce que le garde-fou de la session interdit,
 * et à juste titre : un mois inventé prouverait que mes fixtures passent mes
 * contrôles. Les payloads rejoués ont été RÉELLEMENT payés, par une session
 * antérieure, et ils portent les défauts d'un vrai modèle.
 *
 *   npx tsx scripts/production-path/first-month.ts --confirm
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { admin, localEnv } from "../local-render/lib";
import { drawMonth } from "@/lib/content/month/draw";
import { serverDrawPort, serverBankGuardPort, type DrawRpcClient } from "@/lib/content/month/draw-port";
import {
  serverPreflightPort,
  serverInsertPort,
  serverMonthRowPort,
  serverReleaseTopics,
  type MonthRpcClient,
} from "@/lib/content/month/server-ports";
import { serverCreditPort } from "@/lib/credits/server-port";
import { orchestrateMonth, type WriterPort, type WrittenPost } from "@/lib/content/month/orchestrate";
import type { JournalDb } from "@/lib/content/month/journal-port";
import { cardPalette } from "@/lib/compose/palette";
import { cardBands, licenceMentionFor } from "@/lib/content/review";
import { composeCard } from "@/lib/content/month/compose-card";
import { footerCarriesLicence } from "@/lib/content/licence";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";
import { CANDIDATES_PER_ATTEMPT, POSTS_PER_MONTH, type BankDemand } from "@/lib/content/bank";
import { PRACTITIONER_CARDS_PER_MONTH } from "@/lib/content/practitioner";
import { scheduleDates } from "@/lib/content/generate/plan";

const LABEL = "chemin produit, base locale — rédaction rejouée depuis un mois déjà payé";

/*
 * ⚠ LA DEMANDE DE BANQUE EST CELLE D'UNE SEULE PRATICIENNE, UN SEUL ESSAI. Ce
 * lanceur ne mesure pas le seuil de remplissage du segment : il vérifie qu'un mois
 * passe. Mettre le chiffre du segment ici ferait refuser le préalable pour une
 * pénurie qui n'a rien à voir avec ce mois-là.
 */
const DEMAND: BankDemand = { practitioners: 1, attempts: 1, rounds: 1 };

/** Le kit, le mois source et le mois visé. Tous locaux, tous de test. */
const KIT = "96128f29-537b-42db-b7c6-64020dfe2985";
const SOURCE_MONTH_ID = "11e2f29d-1eef-4cb3-b236-d15b249c246b";
const TARGET_MONTH = process.argv.includes("--month")
  ? process.argv[process.argv.indexOf("--month") + 1]
  : "2028-07-01";

if (!process.argv.includes("--confirm")) {
  console.error("Refusing without --confirm.");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(localEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "")) {
  /*
   * ⚠ CE LANCEUR ÉCRIT. Il ne doit jamais s'exécuter contre autre chose que la
   * base locale : le garde-fou de la session l'interdit, et un lanceur qui se
   * contenterait d'y penser n'est pas un garde-fou.
   */
  console.error("Refusing: NEXT_PUBLIC_SUPABASE_URL is not local.");
  process.exit(1);
}

type Report = Record<string, unknown>;

async function main() {
  const db = admin();
  const rpc = db as unknown as MonthRpcClient & DrawRpcClient;
  const report: Report = { label: LABEL, at: new Date().toISOString(), targetMonth: TARGET_MONTH };

  const { data: kitRow } = await db
    .from("brand_kits")
    .select("id, project_id, projects!inner(user_id)")
    .eq("id", KIT)
    .single();
  if (!kitRow) throw new Error(`no kit ${KIT}`);
  const projectId = (kitRow as { project_id: string }).project_id;
  const userId = (kitRow as { projects: { user_id: string } }).projects.user_id;

  /*
   * ── ⚠ L'ERREUR EST VÉRIFIÉE, ET LA PREMIÈRE VERSION NE LE FAISAIT PAS ──
   *
   * Elle demandait `modalities`, qui n'existe pas : la colonne s'appelle
   * `modality_ids`. PostgREST rendait donc une erreur et `data` à `null`, et les
   * replis ont produit un nom de cabinet « Practice » et un État nul — deux
   * valeurs parfaitement plausibles. Le préalable a refusé pour « État absent du
   * brief », ce qui était vrai de ce qu'il avait reçu et faux de la base.
   *
   * C'est la classe de défaut que cette session passe son temps à trouver : une
   * lecture dont l'échec n'est pas vérifié rend une valeur crédible. Un repli sur
   * une erreur NON LUE ne protège de rien, il déguise.
   */
  const briefRead = await db
    .from("project_briefs")
    .select("practice_name, state, license_state_code, modality_ids")
    .eq("project_id", projectId)
    .maybeSingle();
  if (briefRead.error) throw new Error(`project_briefs: ${briefRead.error.message}`);
  const brief = briefRead.data as {
    practice_name?: string | null;
    state?: string | null;
    license_state_code?: string | null;
    modality_ids?: string[] | null;
  } | null;
  if (!brief) throw new Error(`no project_brief for ${projectId}`);
  const practiceName = brief.practice_name ?? "Practice";
  /*
   * ⚠ LE MÊME REPLI QUE LE PRÉALABLE ET QUE LE HARNAIS : `license_state_code ??
   * state`. Un brief rempli avant que le champ dédié existe porte l'État du
   * cabinet, et c'est le seul État qu'on ait de lui.
   */
  const stateCode = brief.license_state_code || brief.state || null;
  const modalities = brief.modality_ids ?? [];

  /* ══ 1. LE TIRAGE, CONTRE LA VRAIE BANQUE ══════════════════════════════ */
  /*
   * ⚠ IL EST MESURÉ SÉPARÉMENT, ET TOUT EST RENDU ENSUITE. C'est la seule façon
   * de savoir si le tirage à 57 de F41 tient contre une vraie banque sans écrire
   * un mois — et de le savoir sans clef.
   */
  const draw = await drawMonth(serverDrawPort(rpc, { kitId: KIT, month: TARGET_MONTH }), {
    families: FORMAT_FAMILIES as unknown as Record<string, string[]>,
    drawOrder: ["varied", "simple", "statement"],
    perFamily: Math.ceil(CANDIDATES_PER_ATTEMPT / 3),
    candidates: CANDIDATES_PER_ATTEMPT,
    practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
    practitionerPayload: false,
  });
  const release = serverReleaseTopics(rpc, { brandKitId: KIT });
  await release([...draw.drawn.map((d) => d.topic.id), ...draw.releasedEarly]);
  report.draw = {
    asked: CANDIDATES_PER_ATTEMPT,
    drawn: draw.drawn.length,
    rejected: draw.rejected.length,
    releasedEarly: draw.releasedEarly.length,
    shortfall: draw.shortfall,
    byArchetype: draw.drawn.reduce<Record<string, number>>((acc, d) => {
      acc[d.topic.archetype_key] = (acc[d.topic.archetype_key] ?? 0) + 1;
      return acc;
    }, {}),
    allReleased: true,
  };

  /* ══ 2. LA GARDE DE BANQUE, TELLE QUE LE PRÉALABLE LA LIRA ═════════════ */
  const bankPort = serverBankGuardPort(rpc);
  const counts = await bankPort.drawableCounts(KIT);
  report.bank = {
    archetypes: Object.keys(counts).length,
    thinnest: Object.entries(counts).sort((a, b) => a[1] - b[1])[0] ?? null,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  /* ══ 3. LE MOIS REJOUÉ, PAR L'ORCHESTRATEUR PRODUIT ════════════════════ */
  /*
   * ⚠ LES SUJETS ET LES PAYLOADS VIENNENT DU MOIS SOURCE, et les deux ensemble.
   * Prendre un payload d'un sujet et le titre d'un autre ferait échouer le
   * dédoublonnage pour une raison qui n'existe que dans ce lanceur.
   */
  const { data: source } = await db
    .from("content_items")
    .select("topic_id, title, caption, alt_text, rationale, payload, compose_archetype, archetype, on_image_text")
    .eq("month_id", SOURCE_MONTH_ID);
  const replayed = (source ?? []).filter(
    (r) => (r as { topic_id?: string | null }).topic_id
  ) as Array<{
    topic_id: string;
    title: string;
    caption: string;
    alt_text: string;
    rationale: string | null;
    payload: unknown;
    archetype: string;
    compose_archetype: string;
  }>;
  report.replay = { sourceMonthId: SOURCE_MONTH_ID, posts: replayed.length };

  /*
   * ⚠ LES SURTITRES VIENNENT DU CATALOGUE, PAS D'UNE INVENTION. Le portillon
   * refuse `eyebrow.empty` et `eyebrow.off_catalogue` : un surtitre fabriqué ici
   * ferait échouer trente posts pour un défaut de ce lanceur.
   */
  const intentRead = await db.from("content_intents").select("id, label");
  if (intentRead.error) throw new Error(`content_intents: ${intentRead.error.message}`);
  const catalogue = (intentRead.data ?? []) as Array<{ id: string; label: string }>;
  if (catalogue.length === 0) throw new Error("content_intents is empty: the gate would refuse every eyebrow");

  const byTopic = new Map(replayed.map((r) => [r.topic_id, r]));
  const writer: WriterPort = {
    async write({ topics }) {
      const posts: WrittenPost[] = [];
      for (const t of topics) {
        const row = byTopic.get(t.id);
        if (!row) continue;
        posts.push({
          topicId: t.id,
          cardLine: row.title,
          payload: row.payload,
          caption: row.caption ?? "",
          altText: row.alt_text ?? "",
          rationale: row.rationale ?? "",
          /*
           * ⚠ ILS TOURNENT DANS LE CATALOGUE, ET LA PREMIÈRE VERSION LES METTAIT
           * TOUS PAREILS. Vingt-neuf surtitres identiques : `checkMonth` a vu la
           * répétition — à juste titre — et le mois a gardé deux constats. Le
           * contrôle avait raison ; c'était le lanceur qui fabriquait le défaut.
           */
          eyebrow: catalogue[posts.length % catalogue.length].label.toUpperCase(),
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        });
      }
      /* ⚠ ZÉRO DOLLAR, ET C'EST VRAI : rien n'a été demandé à un modèle. */
      return { posts, batchId: null, costUsd: 0 };
    },
  };

  const monthRow = serverMonthRowPort(rpc);
  const { data: direction } = await db
    .from("brand_kits")
    .select("directions, selected_direction_id")
    .eq("id", KIT)
    .single();
  const palette = pickPalette(direction);

  const layouts = new Map(replayed.map((r) => [r.topic_id, r.archetype]));

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  ⚠ DEUX LANCEMENTS, ET LE PREMIER MONTRE UN ARTEFACT DE CE LANCEUR
   * ══════════════════════════════════════════════════════════════════════
   *
   * 3a — LE MOIS NEUF. Les trente sujets passent par `drawMonth`, donc par son
   * dédoublonnage. `redundantAgainst` compare un titre à ceux DÉJÀ acceptés : il
   * dépend de l'ORDRE, et rejouer un ensemble déjà dédoublonné dans un autre
   * ordre en refuse un. On obtient 29 sur 30, puis `mix.dominant` à 31 % — deux
   * constats dont la seule cause est cette perte.
   *
   * ⚠ CE N'EST PAS UN DÉFAUT DU MOIS SOURCE. Ses trente lignes de carte sont
   * distinctes une fois coupées à trente caractères, et son mélange tombe à
   * 30,0 % — pile au plafond, qui est un dépassement STRICT. C'est le rejeu qui
   * fabrique le défaut, et c'est pourquoi il est nommé plutôt que contourné.
   *
   * 3b — LE MOIS REPRIS. Les trente résultats sont posés dans le journal, comme
   * une panne les laisse, et l'orchestrateur prend le chemin de la REPRISE : il
   * lit les sujets du journal plutôt que d'en tirer. C'est la seule façon de
   * passer les trente ET de prouver la reprise contre la vraie base.
   */
  const outcome = await runMonth(replayed.map((r) => r.topic_id));

  async function runMonth(order: string[]) {
    const topicsForRun = [...order];
    return await orchestrateMonth(
    {
      preflight: serverPreflightPort(rpc, { stateCode }),
      /*
       * ⚠ LE TIRAGE EST COURT-CIRCUITÉ ICI, ET L'ÉTIQUETTE LE DIT. Les sujets sont
       * ceux du mois source : les retirer de la banque donnerait des sujets dont on
       * n'a pas les payloads. Le tirage a été mesuré à l'étape 1, séparément.
       */
      draw: {
        assign: async () => topicsForRun.shift() ?? null,
        topic: async (id) => {
          const { data } = await db
            .from("content_topics")
            .select("id, archetype_key, intent, title, hook")
            .eq("id", id)
            .maybeSingle();
          return (data as never) ?? null;
        },
      },
      journal: rpc as unknown as JournalDb,
      writer,
      openMonthRow: (i) => monthRow.open(i),
      closeMonthRow: (id, status) => monthRow.close(id, status),
      assembleFor: (monthId) => ({
        insert: serverInsertPort(rpc, { brandKitId: KIT, monthId }),
        credits: serverCreditPort(rpc as never, { model: "replayed", month: TARGET_MONTH }),
      }),
      releaseTopics: release,
    },
    {
      brandKitId: KIT,
      projectId,
      userId,
      month: TARGET_MONTH,
      stateCode,
      wanted: POSTS_PER_MONTH,
      candidates: replayed.length,
      perFamily: replayed.length,
      families: { statement: ["single_statement"] },
      drawOrder: ["statement"],
      practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
      practitionerPayload: false,
      demand: DEMAND,
      direction: palette as never,
      paletteFor: (i) => cardPalette(`${TARGET_MONTH}-${i}`, palette as never, false),
      practiceName,
      layoutFor: (i) => layouts.get(replayed[i]?.topic_id ?? "") ?? "statement",
      /*
       * ⚠ LES SEPT JOURS, COMME LE HARNAIS. Ma première version passait du lundi
       * au vendredi : décembre 2027 n'a que vingt-trois jours ouvrés, et le repli
       * `dates[index] ?? dates[dates.length - 1]` a empilé six posts sur la même
       * date. Trente posts demandent trente créneaux.
       */
      dates: scheduleDates(TARGET_MONTH, [1, 2, 3, 4, 5, 6, 7], POSTS_PER_MONTH),
      context: {
        direction: palette,
        modalities,
        eyebrowCatalogue: catalogue,
      } as never,
      identityAllowList: [],
      intentCatalogue: catalogue,
      modalities,
      completeness: {},
    }
  );

  }

  report.freshMonth = summarise(outcome);

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  3b — LE MOIS REPRIS : LES TRENTE RÉSULTATS POSÉS DANS LE JOURNAL
   * ══════════════════════════════════════════════════════════════════════
   *
   * ⚠ LES LIGNES SONT POSÉES COMME UNE PANNE LES LAISSE, et c'est le seul moyen
   * d'éprouver la reprise contre la vraie base sans dépenser : un lot soumis, ses
   * trente sujets, leurs trente résultats, aucun soldé. L'orchestrateur doit alors
   * LIRE le journal et ne rien redemander à la rédaction.
   */
  const resumeMonth = nextMonth(TARGET_MONTH);
  const monthRowPort = serverMonthRowPort(rpc);
  const resumeMonthId = await monthRowPort.open({ brandKitId: KIT, month: resumeMonth });
  const runInsert = await db
    .from("content_generation_runs")
    .insert({
      brand_kit_id: KIT,
      month: resumeMonth,
      batch_id: "replayed-batch",
      state: "submitted",
      cost_usd: 0,
    })
    .select("id")
    .single();
  if (runInsert.error) throw new Error(`content_generation_runs: ${runInsert.error.message}`);
  const resumeRunId = (runInsert.data as { id: string }).id;

  const resultRows = replayed.map((r, i) => ({
    run_id: resumeRunId,
    topic_id: r.topic_id,
    result: {
      topicId: r.topic_id,
      cardLine: r.title,
      payload: r.payload,
      caption: r.caption ?? "",
      altText: r.alt_text ?? "",
      rationale: r.rationale ?? "",
      eyebrow: catalogue[i % catalogue.length].label.toUpperCase(),
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
    usage: {},
    settled: false,
  })) as never;
  const resultsInsert = await db.from("content_generation_results").insert(resultRows);
  if (resultsInsert.error) throw new Error(`content_generation_results: ${resultsInsert.error.message}`);

  let writeCalls = 0;
  const resumeOutcome = await orchestrateMonth(
    {
      preflight: serverPreflightPort(rpc, { stateCode }),
      draw: {
        /*
         * ⚠ LE TIRAGE DOIT RESTER MUET SUR UNE REPRISE. S'il est appelé, c'est que
         * l'orchestrateur a refait son tirage au lieu de lire le journal — le
         * défaut du 2026-09-23, qui a fait payer un lot dont on ne savait plus lire
         * les réponses.
         */
        assign: async () => {
          throw new Error("le tirage a été appelé sur une reprise");
        },
        topic: async (id) => {
          const r = await db
            .from("content_topics")
            .select("id, archetype_key, intent, title, hook")
            .eq("id", id)
            .maybeSingle();
          if (r.error) throw new Error(`content_topics: ${r.error.message}`);
          return (r.data as never) ?? null;
        },
      },
      journal: rpc as unknown as JournalDb,
      writer: {
        async write(request) {
          writeCalls += request.topics.length;
          return { posts: [], batchId: null, costUsd: 0 };
        },
      },
      openMonthRow: async () => resumeMonthId,
      closeMonthRow: (id, status) => monthRowPort.close(id, status),
      assembleFor: (monthId) => ({
        insert: serverInsertPort(rpc, { brandKitId: KIT, monthId }),
        credits: serverCreditPort(rpc as never, { model: "replayed", month: resumeMonth }),
      }),
      releaseTopics: release,
    },
    {
      brandKitId: KIT,
      projectId,
      userId,
      month: resumeMonth,
      stateCode,
      wanted: POSTS_PER_MONTH,
      candidates: replayed.length,
      perFamily: replayed.length,
      families: { statement: ["single_statement"] },
      drawOrder: ["statement"],
      practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
      practitionerPayload: false,
      demand: DEMAND,
      direction: palette as never,
      paletteFor: (i) => cardPalette(`${resumeMonth}-${i}`, palette as never, false),
      practiceName,
      layoutFor: (i) => layouts.get(replayed[i]?.topic_id ?? "") ?? "statement",
      dates: scheduleDates(resumeMonth, [1, 2, 3, 4, 5, 6, 7], POSTS_PER_MONTH),
      context: {
        direction: palette,
        modalities,
        eyebrowCatalogue: catalogue,
      } as never,
      identityAllowList: [],
      intentCatalogue: catalogue,
      modalities,
      completeness: {},
    }
  );

  report.resumedMonth = {
    month: resumeMonth,
    ...summarise(resumeOutcome),
    /* ⚠ ZÉRO : rien n'a été redemandé à la rédaction pour un travail déjà payé. */
    postsAskedOfTheWriter: writeCalls,
  };

  const outcomeForDb = resumeOutcome.ok ? resumeOutcome : outcome;
  const monthForDb = resumeOutcome.ok ? resumeMonth : TARGET_MONTH;

  /* ══ 4. CE QUE LA BASE PORTE VRAIMENT, RELU APRÈS COUP ═════════════════ */
  /*
   * ⚠ ON RELIT LA BASE, ON NE FAIT PAS CONFIANCE AU RAPPORT DE L'ORCHESTRATEUR.
   * Un rapport qui se relit lui-même est la forme de F48 : la mesure et ce qu'elle
   * mesure doivent être deux lectures différentes.
   */
  if (outcomeForDb.ok) {
    const writtenRead = await db
      .from("content_items")
      .select("id, title, payload, compose_archetype, archetype, scheduled_for, status")
      .eq("month_id", outcomeForDb.monthId);
    if (writtenRead.error) throw new Error(`content_items: ${writtenRead.error.message}`);
    const rows = (writtenRead.data ?? []) as Array<Record<string, unknown>>;

    const auditRead = await db
      .from("credit_month_audit")
      .select("kind, reservations, settlements, releases, cost_usd")
      .eq("user_id", userId)
      .eq("month", monthForDb);
    if (auditRead.error) throw new Error(`credit_month_audit: ${auditRead.error.message}`);

    const runsRead = await db
      .from("content_generation_runs")
      .select("state, cost_usd, batch_id")
      .eq("brand_kit_id", KIT)
      .eq("month", monthForDb);
    if (runsRead.error) throw new Error(`content_generation_runs: ${runsRead.error.message}`);

    const stateRead = await db
      .from("content_months")
      .select("status")
      .eq("id", outcomeForDb.monthId)
      .maybeSingle();
    if (stateRead.error) throw new Error(`content_months: ${stateRead.error.message}`);

    const settledRead = await db
      .from("content_generation_results")
      .select("settled")
      .eq("run_id", outcomeForDb.runId);
    if (settledRead.error) throw new Error(`content_generation_results: ${settledRead.error.message}`);
    const settledRows = (settledRead.data ?? []) as Array<{ settled: boolean }>;

    report.database = {
      month: monthForDb,
      itemsWritten: rows.length,
      distinctDates: new Set(rows.map((r) => r.scheduled_for)).size,
      allProposed: rows.every((r) => r.status === "proposed"),
      withPayload: rows.filter((r) => r.payload !== null).length,
      /* ⚠ Les cartes sont-elles vectorielles ? Le payload composé en est la preuve. */
      composeArchetypes: [...new Set(rows.map((r) => r.compose_archetype))].length,
      monthStatus: (stateRead.data as { status?: string } | null)?.status ?? null,
      creditAudit: auditRead.data ?? [],
      journal: runsRead.data ?? [],
      journalSettled: settledRows.filter((r) => r.settled).length,
      journalTotal: settledRows.length,
    };
  }

  /* ══ 5. LA MENTION DE LICENCE, PAR LE CHEMIN DE LECTURE ════════════════ */
  /*
   * ⚠ C'EST LE CHEMIN QUI COMPTE, PAS CELUI DE L'ÉCRITURE. `content_items` n'a pas
   * de colonne de pied : la carte est RECOMPOSÉE à la lecture, par `cardBands`. La
   * composition à l'écriture peut donc porter la mention et l'écran n'en rien
   * montrer — c'est exactement ce qui se passait (F56).
   *
   * On relit donc les trente lignes, on reconstruit le pied comme l'écran le fait,
   * et on compose. Une carte dont le pied ne porte pas la mention entière est
   * comptée.
   */
  if (outcomeForDb.ok) {
    const mention = await licenceMentionFor(db as never, projectId);
    const itemsRead = await db
      .from("content_items")
      .select("id, title, theme, payload, compose_archetype, topic_id")
      .eq("month_id", outcomeForDb.monthId);
    if (itemsRead.error) throw new Error(`content_items: ${itemsRead.error.message}`);
    const items = (itemsRead.data ?? []) as Array<{
      id: string;
      title: string | null;
      theme: string | null;
      payload: unknown;
      compose_archetype: string;
      topic_id: string | null;
    }>;

    const cards: Array<{ id: string; footer: string; svg: string | null; carriesLicence: boolean }> = [];
    for (const [i, item] of items.entries()) {
      const bands = cardBands(
        { theme: item.theme, title: item.title, topic: null } as never,
        practiceName,
        mention
      );
      let svg: string | null = null;
      try {
        const card = composeCard({
          archetype: item.compose_archetype,
          payload: item.payload,
          palette: cardPalette(`${monthForDb}-${i}`, palette as never, false),
          eyebrow: bands.eyebrow,
          headline: bands.headline,
          footer: bands.footer,
          licenceMention: mention ?? "",
        });
        svg = card.svg;
      } catch {
        /* Une carte que le moteur refuse est comptée sans SVG, jamais inventée. */
      }
      cards.push({
        id: item.id,
        footer: bands.footer,
        svg,
        carriesLicence: mention !== null && footerCarriesLicence(bands.footer, mention),
      });
    }

    report.readPath = {
      mention,
      cards: cards.length,
      withLicence: cards.filter((c) => c.carriesLicence).length,
      vectorial: cards.filter((c) => c.svg !== null).length,
    };

    writeFileSync(
      "design/production-first-month/planche.html",
      planche(cards, report, monthForDb),
      "utf8"
    );
  }

  mkdirSync("design/production-first-month", { recursive: true });
  writeFileSync(
    "design/production-first-month/run.json",
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );
  console.error(JSON.stringify(report, null, 2));
}

/**
 * La planche : les trente cartes, leur pied, et l'étiquette en tête.
 *
 * ⚠ L'ÉTIQUETTE EST LA PREMIÈRE CHOSE QU'ON LIT, et elle dit ce qui n'est pas du
 * chemin produit. Une planche qu'on commenterait comme un mois vendu alors que la
 * rédaction est rejouée serait la pire sortie possible de cette session.
 */
function planche(
  cards: Array<{ id: string; footer: string; svg: string | null; carriesLicence: boolean }>,
  report: Record<string, unknown>,
  month: string
): string {
  const read = report.readPath as { withLicence: number; vectorial: number; mention: string | null };
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Premier mois — chemin produit</title>
<style>
  :root { --paper:#F7F3EC; --ink:#1C1A17; --warn:#8A4B2A; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#1C1A17; --ink:#EFE9DF; } }
  :root[data-theme="dark"] { --paper:#1C1A17; --ink:#EFE9DF; }
  body { background:var(--paper); color:var(--ink); margin:0; padding:24px 16px;
         font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  .wrap { max-width:1200px; margin:0 auto; }
  .label { border:2px solid var(--warn); color:var(--warn); padding:12px 16px; border-radius:6px;
           font-weight:600; margin-bottom:20px; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:4px 16px; margin:0 0 24px; }
  dt { font-variant-numeric:tabular-nums; opacity:.7; }
  dd { margin:0; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
  figure { margin:0; }
  figure svg { width:100%; height:auto; display:block; border:1px solid color-mix(in oklab, var(--ink) 15%, transparent); }
  figcaption { font-size:12px; opacity:.75; margin-top:6px; word-break:break-word; }
  .missing { color:var(--warn); font-weight:700; }
</style></head><body><div class="wrap">
<div class="label">${escapeHtml(LABEL)}<br>
API sous limite d'usage jusqu'au 2026-10-01 : aucun mois ne peut être RÉDIGÉ aujourd'hui.
La rédaction de ces trente posts a été payée par une session antérieure ; tout le reste —
préalable, tirage, composition, contrôles, crédit, écriture, journal, reprise — est du chemin produit.</div>
<dl>
<dt>mois</dt><dd>${escapeHtml(month)}</dd>
<dt>cartes</dt><dd>${cards.length}</dd>
<dt>avec mention de licence</dt><dd>${read.withLicence} / ${cards.length}</dd>
<dt>vectorielles</dt><dd>${read.vectorial} / ${cards.length}</dd>
<dt>mention</dt><dd>${escapeHtml(read.mention ?? "(absente)")}</dd>
</dl>
<div class="grid">
${cards
  .map(
    (c) => `<figure>${c.svg ?? '<div class="missing">carte non composée</div>'}
<figcaption>${c.carriesLicence ? "" : '<span class="missing">SANS MENTION — </span>'}${escapeHtml(c.footer)}</figcaption></figure>`
  )
  .join("\n")}
</div></div></body></html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function summarise(outcome: Awaited<ReturnType<typeof orchestrateMonth>>) {
  return outcome.ok
    ? {
        ok: true,
        written: outcome.month.written,
        gate: outcome.month.gate,
        selection: {
          chosen: outcome.month.selection.chosen.length,
          dropped: outcome.month.selection.dropped.length,
          remaining: outcome.month.selection.remaining.length,
        },
        inserts: outcome.month.inserts,
        dateCollisions: outcome.month.dateCollisions,
        creditRefusal: outcome.month.creditRefusal,
        costUsd: outcome.costUsd,
        resumed: outcome.resumed,
        fallbacks: outcome.fallbacks.length,
        released: outcome.released.length,
        monthId: outcome.monthId,
      }
    : {
        ok: false,
        stage: outcome.stage,
        refusal: outcome.refusal,
        remaining: outcome.remaining ?? [],
        costUsd: outcome.costUsd,
      };
}

/** Le mois suivant, premier du mois. */
function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 10);
}

function pickPalette(row: unknown): unknown {
  const r = row as { directions?: unknown[]; selected_direction_id?: string } | null;
  const list = (r?.directions ?? []) as Array<{ id?: string; palette?: unknown }>;
  const chosen = list.find((d) => d.id === r?.selected_direction_id) ?? list[0];
  return (
    (chosen?.palette as Record<string, string>) ?? {
      primary: "#2B2724",
      secondary: "#7A6A56",
      light: "#EFE9DF",
      dark: "#1C1A17",
      paper: "#F7F3EC",
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
