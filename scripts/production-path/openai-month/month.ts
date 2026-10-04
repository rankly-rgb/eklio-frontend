/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN MOIS DE TRENTE, PAR L'ORCHESTRATEUR PRODUIT, SUR OPENAI
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce lanceur n'orchestre RIEN lui-même. Il lit le compte, construit les ports
 * du produit — `serverPreflightPort`, `serverDrawPort`, le journal, `openAiWriter`,
 * le relecteur, `serverMonthRowPort`, `serverInsertPort`, `serverCreditPort`,
 * `serverReleaseTopics` — et appelle `orchestrateMonth`. Tout ce qui décide est
 * dans `lib/`.
 *
 * ⚠ CE QUI N'EST PAS LE PRODUIT, ET QUE LA PLANCHE NOMME :
 *   le transport   `../local-db.ts` (client SQL de Bun) à la place de PostgREST ;
 *   le compte      posé par `setup.ts` (kit sans directions, palette des épreuves) ;
 *   la banque      remplie par `bank.ts`, côté harnais — il n'existe pas de
 *                  fournisseur de banque côté produit ;
 *   l'appelant     ce lanceur, à la place de la route de cron (qui reste en 501).
 *
 * ⚠ `--kill-after N` TUE LE PROCESSUS (SIGKILL) après la N-ième réponse entrée
 * au journal : pas d'exception rattrapée, pas de `finally`, la base telle qu'une
 * panne la laisse. C'est la seule façon honnête d'éprouver la reprise.
 *
 *   EKLIO_OPENAI_API_KEY=… bun scripts/production-path/openai-month/month.ts \
 *     --kit <id> --month 2026-11-01 [--kill-after 20] --out run-1.json --confirm
 */
import { writeFileSync } from "node:fs";
import { localDb } from "../local-db";
import { arg, confirmOrDie, sessionMeter, transportFromEnv } from "./session";
import { orchestrateMonth, type WriterPort } from "@/lib/content/month/orchestrate";
import { openAiWriter } from "@/lib/content/month/openai-writer";
import { serverDrawPort } from "@/lib/content/month/draw-port";
import {
  serverInsertPort,
  serverMonthRowPort,
  serverPreflightPort,
  serverReleaseTopics,
} from "@/lib/content/month/server-ports";
import { serverCreditPort } from "@/lib/credits/server-port";
import type { JournalDb } from "@/lib/content/month/journal-port";
import { openAiTextModel, worstCaseCallUsd } from "@/lib/content/generate/openai";
import { openAiBody, OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { copyCallFor } from "@/lib/content/generate/copy-batch";
import { cardPalette } from "@/lib/compose/palette";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";
import { CANDIDATES_PER_ATTEMPT, POSTS_PER_MONTH } from "@/lib/content/bank";
import {
  identityAllowList,
  practitionerLines,
  PRACTITIONER_CARDS_PER_MONTH,
  type PractitionerFacts,
} from "@/lib/content/practitioner";
import { chooseArchetype, scheduleDates } from "@/lib/content/generate/plan";

confirmOrDie("le mois");
const KIT = arg("--kit");
const MONTH = arg("--month") ?? "2026-11-01";
const OUT = arg("--out") ?? "month-run.json";
const KILL_AFTER = arg("--kill-after") ? Number(arg("--kill-after")) : null;
if (!KIT) throw new Error("--kit <brand_kit_id> manquant");
const MODEL = OPENAI_COPY_MODEL;


async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  const db = localDb();
  const rpc = db as never;
  const meter = sessionMeter();
  const transport = transportFromEnv();
  const startedSpent = meter.spentUsd();

  const kit = await must("brand_kits", db.from("brand_kits").select("id, project_id").eq("id", KIT).single()) as { id: string; project_id: string };
  const project = await must("projects", db.from("projects").select("id, user_id").eq("id", kit.project_id).single()) as { id: string; user_id: string };
  const brief = await must("project_briefs", db.from("project_briefs")
    .select("practice_name, city, state, license_state_code, modality_ids, palette_family_ids").eq("project_id", project.id).single()) as {
    practice_name: string | null; city: string | null; state: string | null; license_state_code: string | null; modality_ids: string[] | null;
    palette_family_ids: string[] | null;
  };
  /*
   * ⚠ LA PALETTE EST CELLE DU BRIEF, PAS CELLE DES ÉPREUVES. Le kit local n'a pas
   * de directions (setup.ts) ; la première version de ce lanceur prenait la palette
   * des épreuves de l'orchestrateur, et 25 posts sur 57 sont tombés au portillon
   * sur `tints.tooClose` — un mois refusé que ce lanceur avait fabriqué. La règle
   * est donc celle des données : la PREMIÈRE famille que la praticienne a choisie.
   * ⚠ Elle n'est pas choisie pour passer : trois des six familles actives
   * échouent ce contrôle (FOLLOWUP F72), et ce compte-ci a `clay_sand` en tête.
   */
  const familyId = (brief.palette_family_ids ?? [])[0];
  if (!familyId) throw new Error("le brief ne nomme aucune famille de palette");
  const family = await must("palette_families", db.from("palette_families")
    .select("primary_hex, secondary_hex, light_hex, dark_hex, paper_hex").eq("id", familyId).single()) as Record<string, string>;
  const PALETTE = {
    primary: family.primary_hex, secondary: family.secondary_hex, light: family.light_hex,
    dark: family.dark_hex, paper: family.paper_hex,
  };
  const checkin = await must("content_checkins", db.from("content_checkins")
    .select("sessions_theme, happening, taking_clients").eq("brand_kit_id", KIT).eq("month", MONTH).maybeSingle()) as {
    sessions_theme: string | null; happening: string | null; taking_clients: string | null;
  } | null;
  const prefs = await must("content_preferences", db.from("content_preferences")
    .select("accepted_registers, off_limits").eq("brand_kit_id", KIT).single()) as { accepted_registers: string[]; off_limits: string | null };
  const intents = await must("content_intents", db.from("content_intents").select("id, label")) as Array<{ id: string; label: string }>;
  const rules = await must("ethics_rules", db.from("ethics_rules").select("id, short_label, description")) as Array<{ id: string; short_label: string; description: string }>;

  const practiceName = brief.practice_name ?? "Practice";
  const stateCode = brief.license_state_code || brief.state || null;
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name,
    city: brief.city,
    state: brief.state,
    modalities: (brief.modality_ids ?? []).map((id) => id.toUpperCase()),
    takingClients: (checkin?.taking_clients ?? null) as PractitionerFacts["takingClients"],
  };
  const brand = { practiceName, voice: "plain, warm, unhurried", offLimits: prefs.off_limits ?? "", ethicsRules: rules };

  /* ── les ports du produit ───────────────────────────────────────────── */
  const writer = openAiWriter({
    transport, meter, model: MODEL, brand,
    checkin: [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" "),
    intentLabels: new Map(intents.map((i) => [i.id, i.label])),
    /* ⚠ Le chemin produit n'écrit pas de thèmes (`content_months.themes = []`) : on n'en invente pas ici. */
    themes: [],
    practiceName,
    practitionerLines: practitionerLines(facts),
    concurrency: 6,
  });

  let journaled = 0;
  const killing: WriterPort = KILL_AFTER === null ? writer : {
    async write(request) {
      return writer.write({
        ...request,
        sink: {
          ...request.sink,
          async post(post) {
            await request.sink.post(post);
            journaled += 1;
            if (journaled >= KILL_AFTER!) {
              console.error(`✝ SIGKILL après ${journaled} réponses au journal (${meter.spentUsd().toFixed(4)} $ dépensés dans la session)`);
              process.kill(process.pid, "SIGKILL");
            }
          },
        },
      });
    },
  };

  const registers = prefs.accepted_registers;
  const layouts: string[] = [];
  let previous: Parameters<typeof chooseArchetype>[1] = null;
  for (let i = 0; i < CANDIDATES_PER_ATTEMPT; i += 1) {
    previous = chooseArchetype(registers[i % registers.length] as never, previous);
    layouts.push(previous);
  }

  /*
   * ⚠ L'ESTIMATION DU PLAFOND EST UN PIRE CAS CALCULÉ, PAS UN CHIFFRE ESPÉRÉ.
   * Aucun mois OpenAI n'a encore été mesuré : `estimatedCostPerPostUsd` est le
   * pire coût d'un appel de rédaction sur le préfixe le plus long (le carrousel),
   * tel que le compteur le réserve. C'est la règle de F58 : mesuré, ou borné.
   */
  const worstPost = worstCaseCallUsd(MODEL, openAiBody({
    ...copyCallFor(brand, { topicId: "x", archetypeKey: "carousel", title: "x".repeat(80), hook: "x".repeat(160), intent: "educate", checkin: "x".repeat(600) }),
    model: MODEL,
  }));

  const outcome = await orchestrateMonth(
    {
      preflight: serverPreflightPort(rpc, { stateCode }),
      draw: serverDrawPort(rpc, { kitId: KIT!, month: MONTH }),
      journal: db as unknown as JournalDb,
      writer: killing,
      editor: openAiTextModel(transport, meter, MODEL, "relecture / juge"),
      openMonthRow: (i) => serverMonthRowPort(rpc).open(i),
      closeMonthRow: (id, status) => serverMonthRowPort(rpc).close(id, status),
      assembleFor: (monthId) => ({
        insert: serverInsertPort(rpc, { brandKitId: KIT!, monthId }),
        credits: serverCreditPort(rpc, { provider: "openai", model: MODEL, month: MONTH }),
      }),
      releaseTopics: serverReleaseTopics(rpc, { brandKitId: KIT! }),
    },
    {
      brandKitId: KIT!,
      projectId: project.id,
      userId: project.user_id,
      month: MONTH,
      stateCode,
      wanted: POSTS_PER_MONTH,
      candidates: CANDIDATES_PER_ATTEMPT,
      perFamily: Math.ceil(CANDIDATES_PER_ATTEMPT / 3),
      families: FORMAT_FAMILIES as unknown as Record<string, string[]>,
      drawOrder: ["varied", "simple", "statement"],
      practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
      practitionerPayload: practitionerLines(facts) !== null,
      demand: { practitioners: 1, attempts: 1, rounds: 1 },
      ceiling: { capUsd: 3, estimatedCostPerPostUsd: worstPost, maxTopics: CANDIDATES_PER_ATTEMPT },
      direction: PALETTE as never,
      paletteFor: (i) => cardPalette(`${MONTH}-${i}`, PALETTE as never, false),
      practiceName,
      layoutFor: (i) => layouts[i] ?? layouts[layouts.length - 1],
      dates: scheduleDates(MONTH, [1, 2, 3, 4, 5, 6, 7], POSTS_PER_MONTH),
      context: { direction: PALETTE } as never,
      identityAllowList: identityAllowList(facts),
      intentCatalogue: intents,
      modalities: facts.modalities,
    }
  );

  const report = {
    palette: { family: familyId, ...PALETTE },
    label: "chemin produit, base locale, OpenAI — transport SQL de Bun à la place de PostgREST ; banque et compte posés par le harnais",
    at: new Date().toISOString(),
    month: MONTH,
    model: MODEL,
    worstCasePerPostUsd: worstPost,
    sessionSpentBeforeUsd: startedSpent,
    sessionSpentAfterUsd: meter.spentUsd(),
    thisRunUsdFromMeter: meter.spentUsd() - startedSpent,
    callsThisRun: meter.calls(),
    usageThisRun: meter.usage(),
    writerLedger: writer.ledger,
    outcome: outcome.ok
      ? {
          ok: true,
          monthId: outcome.monthId,
          runId: outcome.runId,
          costUsd: outcome.costUsd,
          written: outcome.month.written,
          resumed: outcome.resumed,
          writing: outcome.writing,
          editing: outcome.editing,
          gate: { arrived: outcome.month.gate.arrived, passedAlone: outcome.month.gate.passedAlone, byCheck: outcome.month.gate.byCheck, refused: outcome.month.gate.refused },
          selection: { remaining: outcome.month.selection.remaining },
          inserts: outcome.month.inserts,
          creditRefusal: outcome.month.creditRefusal,
          dateCollisions: outcome.month.dateCollisions,
          fallbacks: outcome.fallbacks,
          released: outcome.released.length,
        }
      : outcome,
  };
  writeFileSync(`design/production-first-month/${OUT}`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: outcome.ok, ...(outcome.ok ? { written: outcome.month.written, costUsd: outcome.costUsd } : { stage: outcome.stage, refusal: outcome.refusal }), thisRunUsd: report.thisRunUsdFromMeter, calls: report.callsThisRun }, null, 2));
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
