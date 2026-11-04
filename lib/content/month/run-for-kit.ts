import { orchestrateMonth, type OrchestrateOutcome } from "@/lib/content/month/orchestrate";
import { illustrateMonth } from "@/lib/visual-library/illustrate";
import { openAiWriter } from "@/lib/content/month/openai-writer";
import { serverDrawPort } from "@/lib/content/month/draw-port";
import {
  serverInsertPort,
  serverRemovePort,
  serverMonthRowPort,
  serverPreflightPort,
  serverReassertTopics,
  serverReleaseTopics,
} from "@/lib/content/month/server-ports";
import { serverCreditPort } from "@/lib/credits/server-port";
import type { JournalDb } from "@/lib/content/month/journal-port";
import { storeMonthCards } from "@/lib/content/month/card-store";
import { serverCardRasteriser, serverCardStorePort } from "@/lib/content/month/card-store-server";
import { licenceMentionFor } from "@/lib/content/review";
import { openAiTextModel, worstCaseCallUsd, type OpenAiTransport, type SpendMeter } from "@/lib/content/generate/openai";
import { openAiBody, OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { copyCallFor } from "@/lib/content/generate/copy-batch";
import { chooseArchetype, scheduleDates } from "@/lib/content/generate/plan";
import { CONTENT_REGISTERS, IMAGE_ARCHETYPES, type ContentRegister } from "@/lib/data/content-catalogue";
import { cardPalette, curatedAccent, type DirectionPalette, type PaletteFamilyRow } from "@/lib/compose/palette";
import { parseDirections } from "@/lib/data/brand-kit";
import { CANDIDATES_PER_ATTEMPT, DRAW_GROUPS, DRAW_ORDER, drawQuotas, POSTS_PER_MONTH } from "@/lib/content/bank";
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

/**
 * La mise en page de chaque candidat, `content_items.archetype` (NOT NULL).
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  ⚠ LE MOIS DE NOVEMBRE 2026 EST SORTI À 24 POSTS POUR CETTE SEULE RAISON
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Sans préférences enregistrées, le registre par défaut était `"educate"`. C'est
 * une INTENTION (`content_intents`), pas un REGISTRE (`content_registers`) :
 * `DEFAULT_ARCHETYPE["educate"]` vaut `undefined`, et `chooseArchetype` rendait
 * `undefined`, puis `"notes"` (le repli d'une répétition), puis `undefined`…
 * Un cast `as never` taisait le compilateur. Un post sur deux arrivait à la base
 * sans mise en page : 28 écritures refusées (`null value in column "archetype"`),
 * le banc épuisé, 24 posts écrits — tous en `notes`.
 *
 * Désormais : seuls les registres du catalogue comptent ; aucun registre connu,
 * c'est tous les registres ; et une mise en page absente ou inconnue LÈVE ici,
 * avant toute dépense, au lieu d'être découverte par la base après rédaction.
 */
export function monthLayouts(accepted: readonly string[] | null, count: number): string[] {
  const known = (accepted ?? []).filter((r): r is ContentRegister =>
    (CONTENT_REGISTERS as readonly string[]).includes(r)
  );
  const registers: readonly ContentRegister[] = known.length > 0 ? known : CONTENT_REGISTERS;
  const layouts: string[] = [];
  let previous: Parameters<typeof chooseArchetype>[1] = null;
  for (let i = 0; i < count; i += 1) {
    previous = chooseArchetype(registers[i % registers.length], previous);
    if (!(IMAGE_ARCHETYPES as readonly string[]).includes(previous as string)) {
      throw new Error(`mise en page inconnue pour le registre ${registers[i % registers.length]} : ${String(previous)}`);
    }
    layouts.push(previous);
  }
  return layouts;
}

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
  const read = kit ? readPathPalette(kit) : null;
  /*
   * ⚠ L'ACCENT CHOISI DE LA FAMILLE (F108, 2026-11-04) : la règle de
   * `site_spec_curated_accent`, lue ici. Sans famille correspondante, l'emphase
   * est en italique seul — jamais une encre dérivée.
   */
  const families = read
    ? await must<PaletteFamilyRow[] | null>(
        "palette_families",
        (db.from("palette_families") as { select(c: string): unknown }).select("primary_hex, secondary_hex, light_hex, dark_hex, paper_hex, accent_hex")
      )
    : null;
  const accent = read ? curatedAccent(read, families ?? []) : null;
  const palette = read ? { ...read, ...(accent ? { accent } : {}) } : null;
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
    modality_ids: string[] | null;
  } | null>(
    "project_briefs",
    from("project_briefs")
      .select("practice_name, city, state, modality_ids")
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

  /* ⚠ Les registres décident des mises en page — voir `monthLayouts`. */
  const layouts = monthLayouts(prefs?.accepted_registers ?? null, CANDIDATES_PER_ATTEMPT);

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
      preflight: serverPreflightPort(rpc),
      draw: serverDrawPort(rpc, { kitId: KIT, month }),
      journal: db as unknown as JournalDb,
      writer,
      editor: openAiTextModel(deps.transport, deps.meter, model, "relecture / juge"),
      openMonthRow: (i) => serverMonthRowPort(rpc).open(i),
      closeMonthRow: (id, status) => serverMonthRowPort(rpc).close(id, status),
      assembleFor: (monthId) => ({
        insert: serverInsertPort(rpc, { brandKitId: KIT, monthId }),
        remove: serverRemovePort(rpc, { monthId }),
        credits: serverCreditPort(rpc, { provider: "openai", model, month }),
      }),
      /*
       * ⚠ LA MENTION EST LUE PAR `licenceMentionFor`, LA FONCTION DE L'ÉCRAN, pas
       * reprise du préalable : la clé de la carte gardée est calculée sur ce que
       * l'écran dessinera, et le préalable ne lit pas `verified_at`.
       */
      /* Le dessin de chaque post, choisi par le sens (lib/visual-library). */
      illustrate: illustrateMonth,
      storeCards: async (monthId) =>
        storeMonthCards(serverCardStorePort(db as never), serverCardRasteriser, {
          kitId: KIT,
          monthId,
          direction: palette,
          practiceName,
          licence: await licenceMentionFor(db as never, account.projectId),
        }),
      releaseTopics: serverReleaseTopics(rpc, { brandKitId: KIT }),
      reassertTopics: serverReassertTopics(rpc, { brandKitId: KIT }),
    },
    {
      brandKitId: KIT,
      projectId: account.projectId,
      userId: account.userId,
      month,
      wanted: POSTS_PER_MONTH,
      candidates: CANDIDATES_PER_ATTEMPT,
      /* ⚠ Le tirage par forme : quotas par groupe, sous le plafond de listes (`drawQuotas`). */
      perFamily: drawQuotas(CANDIDATES_PER_ATTEMPT),
      families: DRAW_GROUPS as unknown as Record<string, string[]>,
      drawOrder: [...DRAW_ORDER],
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
