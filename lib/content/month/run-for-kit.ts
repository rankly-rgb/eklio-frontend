import { orchestrateMonth, type OrchestrateOutcome } from "@/lib/content/month/orchestrate";
import { openAiWriter } from "@/lib/content/month/openai-writer";
import { serverDrawPort } from "@/lib/content/month/draw-port";
import {
  serverInsertPort,
  serverMonthRowPort,
  serverPreflightPort,
  serverReassertTopics,
  serverReleaseTopics,
} from "@/lib/content/month/server-ports";
import { serverCreditPort } from "@/lib/credits/server-port";
import type { JournalDb } from "@/lib/content/month/journal-port";
import { openAiTextModel, worstCaseCallUsd, type OpenAiTransport, type SpendMeter } from "@/lib/content/generate/openai";
import { openAiBody, OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { copyCallFor } from "@/lib/content/generate/copy-batch";
import { chooseArchetype, scheduleDates } from "@/lib/content/generate/plan";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { parseDirections } from "@/lib/data/brand-kit";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";
import { CANDIDATES_PER_ATTEMPT, POSTS_PER_MONTH } from "@/lib/content/bank";
import {
  identityAllowList,
  practitionerLines,
  PRACTITIONER_CARDS_PER_MONTH,
  type PractitionerFacts,
} from "@/lib/content/practitioner";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN MOIS POUR UN COMPTE, PAR L'ORCHESTRATEUR PRODUIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce module lit le compte, construit les ports du produit et appelle
 * `orchestrateMonth`. Il ne décide RIEN de ce que l'orchestrateur décide : tout
 * ce qui refuse, tire, rédige, contrôle et publie est dans `orchestrate.ts` et
 * ses ports. Il reprend la construction du lanceur de répétition
 * (`scripts/production-path/openai-month/month.ts`), qui garde la sienne pour deux
 * raisons nommées : le kit local n'a pas de directions (il prend la famille du
 * brief), et son rédacteur peut être tué en cours de mois pour éprouver la reprise.
 *
 * ── ⚠ LA PALETTE EST CELLE QUE LA PAGE DE LECTURE RECOMPOSE ─────────────
 *
 * `app/app/content/[id]/page.tsx` et la route d'image recomposent chaque carte
 * avec `selectedDirection.palette ?? directions[0].palette`, en fond clair. Le
 * portillon doit juger CETTE palette : une autre lui ferait valider des teintes
 * que la praticienne ne verra jamais. Un kit sans palette n'a pas de mois — il
 * n'y a rien à composer.
 */

/** Ce qu'un mois peut coûter au plus, reprise comprise (F58). Mesuré : 0,69 à 0,77 $ ; pire cas 57 × 0,035 $. */
export const MONTH_CAP_USD = 3;

/** Les accès dont ce module a besoin : le client Supabase côté service, vu par ses ports. */
export type RunForKitDb = {
  from(table: string): unknown;
  rpc(fn: string, args?: Record<string, unknown>): unknown;
};

export type RunForKitAccount = {
  brandKitId: string;
  projectId: string;
  userId: string;
};

export type RunForKitDeps = {
  transport: OpenAiTransport;
  /** Le compteur de CET appel : il borne ce que la requête entière peut dépenser. */
  meter: SpendMeter;
  model?: string;
};

export type RunForKitOutcome =
  | { ok: false; stage: "account"; refusal: string; costUsd: 0; nothingWritten: true }
  | OrchestrateOutcome;

type Read<T> = PromiseLike<{ data: T; error: { message: string } | null }>;

async function must<T>(label: string, query: unknown): Promise<T> {
  const { data, error } = await (query as Read<T>);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/**
 * La palette que la page de lecture recomposera, ou `null`.
 *
 * ⚠ LA MÊME LECTURE QUE `loadBrandKit` : `parseDirections`, puis la direction
 * retenue, sinon la première. Une seconde lecture du jsonb serait un second
 * arbitre de la couleur des cartes.
 */
export function readPathPalette(kit: { selected_direction_id: string | null; directions: unknown }): DirectionPalette | null {
  const directions = parseDirections(kit.directions) ?? [];
  const chosen = directions.find((d) => d.id === kit.selected_direction_id) ?? directions[0] ?? null;
  const p = chosen?.palette as Partial<DirectionPalette> | undefined;
  if (!p?.primary || !p.secondary || !p.light || !p.dark || !p.paper) return null;
  return { primary: p.primary, secondary: p.secondary, light: p.light, dark: p.dark, paper: p.paper };
}

export async function orchestrateMonthForKit(
  db: RunForKitDb,
  account: RunForKitAccount,
  month: string,
  deps: RunForKitDeps
): Promise<RunForKitOutcome> {
  const rpc = db as never;
  const from = (t: string) => (db.from(t) as {
    select(c: string): {
      eq(c: string, v: unknown): { maybeSingle(): unknown; eq(c: string, v: unknown): { maybeSingle(): unknown } };
    } & PromiseLike<unknown>;
  });
  const model = deps.model ?? OPENAI_COPY_MODEL;
  const KIT = account.brandKitId;

  const kit = await must<{ selected_direction_id: string | null; directions: unknown } | null>(
    "brand_kits",
    from("brand_kits").select("selected_direction_id, directions").eq("id", KIT).maybeSingle()
  );
  const palette = kit ? readPathPalette(kit) : null;
  if (!palette) {
    return {
      ok: false,
      stage: "account",
      refusal: "le kit n'a aucune direction avec une palette complète : il n'y a rien à composer",
      costUsd: 0,
      nothingWritten: true,
    };
  }

  const brief = await must<{
    practice_name: string | null;
    city: string | null;
    state: string | null;
    license_state_code: string | null;
    modality_ids: string[] | null;
  } | null>(
    "project_briefs",
    from("project_briefs")
      .select("practice_name, city, state, license_state_code, modality_ids")
      .eq("project_id", account.projectId)
      .maybeSingle()
  );
  if (!brief) {
    return { ok: false, stage: "account", refusal: "le projet n'a pas de brief", costUsd: 0, nothingWritten: true };
  }
  const checkin = await must<{ sessions_theme: string | null; happening: string | null; taking_clients: string | null } | null>(
    "content_checkins",
    from("content_checkins").select("sessions_theme, happening, taking_clients").eq("brand_kit_id", KIT).eq("month", month).maybeSingle()
  );
  const prefs = await must<{ accepted_registers: string[] | null; off_limits: string | null } | null>(
    "content_preferences",
    from("content_preferences").select("accepted_registers, off_limits").eq("brand_kit_id", KIT).maybeSingle()
  );
  const intents = (await must<Array<{ id: string; label: string }> | null>(
    "content_intents",
    from("content_intents").select("id, label")
  )) ?? [];
  const rules = (await must<Array<{ id: string; short_label: string; description: string }> | null>(
    "ethics_rules",
    from("ethics_rules").select("id, short_label, description")
  )) ?? [];

  const practiceName = brief.practice_name ?? "Practice";
  const stateCode = brief.license_state_code || brief.state || null;
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name,
    city: brief.city,
    state: brief.state,
    modalities: (brief.modality_ids ?? []).map((id) => id.toUpperCase()),
    takingClients: (checkin?.taking_clients ?? null) as PractitionerFacts["takingClients"],
  };
  const brand = { practiceName, voice: "plain, warm, unhurried", offLimits: prefs?.off_limits ?? "", ethicsRules: rules };

  const writer = openAiWriter({
    transport: deps.transport,
    meter: deps.meter,
    model,
    brand,
    checkin: [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" "),
    intentLabels: new Map(intents.map((i) => [i.id, i.label])),
    /* ⚠ Le chemin produit n'écrit pas de thèmes (F75) : on n'en invente pas ici. */
    themes: [],
    practiceName,
    practitionerLines: practitionerLines(facts),
    concurrency: 6,
  });

  /*
   * ⚠ LES REGISTRES ACCEPTÉS DÉCIDENT DES MISES EN PAGE. Sans préférences
   * enregistrées, le registre par défaut est « educate » — ce que `chooseArchetype`
   * sait servir — plutôt qu'une liste vide qui ferait lever le modulo.
   */
  const registers = prefs?.accepted_registers?.length ? prefs.accepted_registers : ["educate"];
  const layouts: string[] = [];
  let previous: Parameters<typeof chooseArchetype>[1] = null;
  for (let i = 0; i < CANDIDATES_PER_ATTEMPT; i += 1) {
    previous = chooseArchetype(registers[i % registers.length] as never, previous);
    layouts.push(previous);
  }

  /* ⚠ LE PIRE CAS CALCULÉ (F58) : le carrousel sur le préfixe le plus long. */
  const worstPost = worstCaseCallUsd(
    model,
    openAiBody({
      ...copyCallFor(brand, {
        topicId: "x",
        archetypeKey: "carousel",
        title: "x".repeat(80),
        hook: "x".repeat(160),
        intent: "educate",
        checkin: "x".repeat(600),
      }),
      model,
    })
  );

  return orchestrateMonth(
    {
      preflight: serverPreflightPort(rpc, { stateCode }),
      draw: serverDrawPort(rpc, { kitId: KIT, month }),
      journal: db as unknown as JournalDb,
      writer,
      editor: openAiTextModel(deps.transport, deps.meter, model, "relecture / juge"),
      openMonthRow: (i) => serverMonthRowPort(rpc).open(i),
      closeMonthRow: (id, status) => serverMonthRowPort(rpc).close(id, status),
      assembleFor: (monthId) => ({
        insert: serverInsertPort(rpc, { brandKitId: KIT, monthId }),
        credits: serverCreditPort(rpc, { provider: "openai", model, month }),
      }),
      releaseTopics: serverReleaseTopics(rpc, { brandKitId: KIT }),
      reassertTopics: serverReassertTopics(rpc, { brandKitId: KIT }),
    },
    {
      brandKitId: KIT,
      projectId: account.projectId,
      userId: account.userId,
      month,
      stateCode,
      wanted: POSTS_PER_MONTH,
      candidates: CANDIDATES_PER_ATTEMPT,
      perFamily: Math.ceil(CANDIDATES_PER_ATTEMPT / 3),
      families: FORMAT_FAMILIES as unknown as Record<string, string[]>,
      drawOrder: ["varied", "simple", "statement"],
      practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
      practitionerPayload: practitionerLines(facts) !== null,
      demand: { practitioners: 1, attempts: 1, rounds: 1 },
      ceiling: { capUsd: MONTH_CAP_USD, estimatedCostPerPostUsd: worstPost, maxTopics: CANDIDATES_PER_ATTEMPT },
      direction: palette as never,
      /* ⚠ `false` : la page de lecture recompose en fond clair (`review.ts`). */
      paletteFor: (i) => cardPalette(`${month}-${i}`, palette, false),
      practiceName,
      layoutFor: (i) => layouts[i] ?? layouts[layouts.length - 1],
      dates: scheduleDates(month, [1, 2, 3, 4, 5, 6, 7], POSTS_PER_MONTH),
      context: { direction: palette } as never,
      identityAllowList: identityAllowList(facts),
      intentCatalogue: intents,
      modalities: facts.modalities,
    }
  );
}
