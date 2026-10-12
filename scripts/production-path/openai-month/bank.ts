/*
 * ── LA BANQUE DE SUJETS, REMPLIE SUR OPENAI — CÔTÉ HARNAIS ──────────────
 *
 * ⚠ ÉTIQUETTE : la banque n'a AUCUN fournisseur côté produit, sur aucun
 * fournisseur de modèle. `10-topic-bank.ts` était le seul ; celui-ci en est la
 * traduction sur OpenAI, avec la MÊME consigne (`scripts/local-render/bank-prompt.ts`)
 * et les MÊMES juges : `content_topic_bank_payload_valid`, les deux gardes
 * déontologiques en trigger, et `checkEthics` avant de poser `ethics_reviewed_at`.
 * La planche le dit : « banque : harnais ».
 *
 * Ce qui change de 10-topic-bank : la sortie est STRICTE sur le schéma de
 * l'archétype (le préfixe de banque demande le même payload que la rédaction),
 * et un dépassement de budget passe par `repairPayload` — la réparation du
 * produit — plutôt que par une relance de l'objet entier.
 *
 *   EKLIO_OPENAI_API_KEY=… bun scripts/production-path/openai-month/bank.ts --kit <id> --confirm
 *
 * ── ⚠ EN PRODUCTION (2026-10-11) ────────────────────────────────────────
 *
 *   EKLIO_DB_URL=postgresql://…  EKLIO_OPENAI_API_KEY=…  bun …/bank.ts --kit <id> \
 *     --db-url-env EKLIO_DB_URL --cap 3 --log …/openai-calls-bank-production.jsonl \
 *     [--also-state] [--dry-run] --confirm
 *
 *   la base     l'URL est lue dans la variable NOMMÉE par `--db-url-env`, jamais
 *               imprimée ; chaque écriture passe en `service_role`, comme PostgREST.
 *   les segments ceux du brief du kit (modalités × populations × son État), créés
 *               s'ils manquent — la règle de `setup.ts`. Aucun produit ne les crée.
 *   la cible    `bankTarget` sur TROIS tours (la fenêtre de 90 jours), moins ce que
 *               le kit tire déjà ; `--also-state` complète ensuite chaque autre
 *               segment existant de l'État, segment par segment.
 *   le plafond  `--cap` dollars, journal `--log` : le compteur s'arrête net au plafond.
 *   `--dry-run` imprime le plan (sujets par archétype, coût estimé) et n'appelle rien.
 */
import { localDb } from "../local-db";
import { INTENTS, prefix, variable, type Seg } from "../../local-render/bank-prompt";
import { payloadSchema } from "@/lib/compose/archetypes/schema";
import { budgetErrors } from "@/lib/compose/budget";
import { checkEthics } from "@/lib/ethics/rules";
import { bankPayloadFor, PRACTITIONER_ARCHETYPE } from "@/lib/content/practitioner";
import { bankTarget, WINDOW_ROUNDS } from "@/lib/content/bank";
import { meteredCall, openAiRefusal, openAiTextModel, SpendCapReached } from "@/lib/content/generate/openai";
import { openAiText, OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { repairPayload } from "@/lib/content/generate/repair";
import { arg, confirmOrDie, sessionMeter, transportFromEnv } from "./session";

confirmOrDie("le remplissage de banque");
const KIT = arg("--kit");
if (!KIT) throw new Error("--kit <brand_kit_id> manquant");
const MODEL = OPENAI_COPY_MODEL;
/* ⚠ TROIS TOURS PAR DÉFAUT : ce qu'une praticienne prend reste bloqué 90 jours (F13). */
const DEMAND = { practitioners: 1, attempts: 1, rounds: Number(arg("--rounds") ?? WINDOW_ROUNDS) };
const DB_URL_ENV = arg("--db-url-env");
const CAP = arg("--cap") ? Number(arg("--cap")) : undefined;
const LOG = arg("--log") ?? undefined;
const DRY = process.argv.includes("--dry-run");
/* Mesuré le 2026-10-11 : 129 sujets pour 0,9025 $. Ne sert qu'au plan imprimé. */
const MEASURED_USD_PER_TOPIC = 0.0070;
/* ⚠ HORS DE LA BASE LOCALE, LE PLAFOND ET LE JOURNAL SE DISENT À L'APPEL : aucun défaut hérité. */
if (DB_URL_ENV && (CAP === undefined || !LOG)) throw new Error("--db-url-env exige --cap <dollars> et --log <fichier>");

function bankFormat(archetype: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    title: { type: "string" },
    hook: { type: "string" },
    caption_seed: { type: "string" },
    rationale_template: { type: "string" },
  };
  /* ⚠ La carte de praticienne n'a pas de corps écrit par un modèle : son schéma n'en demande pas. */
  if (archetype !== PRACTITIONER_ARCHETYPE) properties.payload = payloadSchema(archetype);
  return {
    type: "json_schema",
    name: "eklio_bank_topic",
    strict: true,
    schema: { type: "object", additionalProperties: false, properties, required: Object.keys(properties) },
  };
}

async function main() {
  let db: ReturnType<typeof localDb>;
  if (DB_URL_ENV) {
    const url = process.env[DB_URL_ENV];
    if (!url) throw new Error(`${DB_URL_ENV} absente de l'environnement — rien n'a été lu ni écrit`);
    db = localDb(url);
  } else {
    db = localDb();
  }

  /* ── les segments du kit : modalités × populations × son État ───────── */
  const kitRow = (await db.from("brand_kits").select("id, project_id").eq("id", KIT).maybeSingle()).data as { project_id: string } | null;
  if (!kitRow) throw new Error(`kit ${KIT} introuvable`);
  const brief = (await db.from("project_briefs").select("modality_ids, client_persona_ids, state").eq("project_id", kitRow.project_id).maybeSingle()).data as {
    modality_ids: string[] | null; client_persona_ids: string[] | null; state: string | null;
  } | null;
  const state = brief?.state?.trim().toUpperCase() || null;
  if (!brief || !state || !brief.modality_ids?.length || !brief.client_persona_ids?.length) {
    throw new Error("le brief du kit n'a pas de modalité, de population ou d'État : aucun segment à remplir");
  }
  const segments: Seg[] = [];
  for (const modality of brief.modality_ids) {
    for (const persona of brief.client_persona_ids) {
      const found = (await db.from("content_segments").select("id, modality_id, persona_id, state_code")
        .eq("modality_id", modality).eq("persona_id", persona).eq("state_code", state).maybeSingle()).data as Seg | null;
      if (found) segments.push(found);
      else if (DRY) segments.push({ id: "(à créer)", modality_id: modality, persona_id: persona, state_code: state } as Seg);
      else {
        const made = await db.from("content_segments").insert({ modality_id: modality, persona_id: persona, state_code: state })
          .select("id, modality_id, persona_id, state_code").single();
        if (made.error) throw new Error(`content_segments insert: ${made.error.message}`);
        segments.push(made.data as Seg);
      }
    }
  }
  const modalities = (await db.from("modality_cards").select("id, label")).data as Array<{ id: string; label: string }>;
  const personas = (await db.from("client_persona_cards").select("id, label, description")).data as Array<{ id: string; label: string; description: string }>;
  const rules = (await db.from("ethics_rules").select("id, short_label, description")).data as Array<{ id: string; short_label: string; description: string }>;
  if (!rules?.length) throw new Error("aucune règle déontologique au catalogue");

  /* ⚠ CE QUI EST DÉJÀ TIRABLE N'EST PAS REDEMANDÉ : la banque complète, elle ne refait pas. */
  const drawable = (await db.rpc("drawable_count_for_kit", { p_brand_kit_id: KIT })).data as Array<{ archetype_key: string; drawable: number }> | Record<string, number> | null;
  const have = new Map<string, number>();
  if (Array.isArray(drawable)) for (const r of drawable) have.set(r.archetype_key, Number(r.drawable));

  type Job = { seg: Seg; archetype: string; intent: string; angle: number };
  const jobs: Job[] = [];
  const target = bankTarget(DEMAND);
  for (const [archetype, total] of Object.entries(target)) {
    const missing = Math.max(0, total - (have.get(archetype) ?? 0));
    for (let i = 0; i < missing; i += 1) {
      const seg = segments[i % segments.length];
      jobs.push({ seg, archetype, intent: INTENTS[(jobs.length) % INTENTS.length], angle: i + 1 });
    }
  }
  const forKit = jobs.length;

  /*
   * ── `--also-state` : CHAQUE AUTRE SEGMENT EXISTANT DE L'ÉTAT, APRÈS LE KIT ──
   *
   * ⚠ APRÈS, ET PAS ENTRE. Le kit d'abord, parce que c'est lui dont le mois doit
   * sortir ; le plafond arrête ensuite là où l'argent s'arrête. Ce qu'un segment
   * porte déjà (sujets relus) est déduit, segment par segment.
   */
  if (process.argv.includes("--also-state")) {
    const others = ((await db.from("content_segments").select("id, modality_id, persona_id, state_code").eq("state_code", state)).data ?? []) as Seg[];
    for (const seg of others.filter((o) => !segments.some((m) => m.id === o.id))) {
      const rows = ((await db.from("content_topics").select("archetype_key, ethics_reviewed_at").eq("segment_id", seg.id)).data ?? []) as Array<{ archetype_key: string; ethics_reviewed_at: string | null }>;
      for (const [archetype, total] of Object.entries(target)) {
        const owned = rows.filter((r) => r.archetype_key === archetype && r.ethics_reviewed_at).length;
        for (let i = 0; i < Math.max(0, total - owned); i += 1) {
          jobs.push({ seg, archetype, intent: INTENTS[jobs.length % INTENTS.length], angle: owned + i + 1 });
        }
      }
    }
  }

  const byArchetype = jobs.slice(0, forKit).reduce<Record<string, number>>((a, j) => ((a[j.archetype] = (a[j.archetype] ?? 0) + 1), a), {});
  const plan = {
    state, segmentsOfKit: segments.map((g) => `${g.modality_id}/${g.persona_id}/${g.state_code} ${g.id}`),
    rounds: DEMAND.rounds, alreadyDrawableForKit: Object.fromEntries(have), toWriteForKit: forKit, byArchetype,
    toWriteElsewhereInState: jobs.length - forKit,
    estimatedUsd: Number((jobs.length * MEASURED_USD_PER_TOPIC).toFixed(2)), cap: CAP ?? null,
  };
  console.error(`▸ plan ${JSON.stringify(plan)}`);
  if (DRY) {
    console.log(JSON.stringify({ step: "bank — plan seul (--dry-run), aucun appel, aucune écriture", ...plan }, null, 2));
    await db.close();
    return;
  }
  const transport = transportFromEnv();
  const meter = sessionMeter(LOG, CAP);
  const repairModel = openAiTextModel(transport, meter, MODEL, "banque : réparation");
  const only = arg("--only");
  if (only) jobs.splice(0, jobs.length, ...jobs.filter((j) => j.archetype === only));
  const limit = Number(arg("--limit") ?? Infinity);
  if (jobs.length > limit) jobs.splice(limit);
  console.error(`▸ ${jobs.length} sujets à écrire sur ${segments.length} segments · ${MODEL} · strict`);
  console.error(`▸ déjà dépensé dans la session : ${meter.spentUsd().toFixed(4)} $ sur ${meter.capUsd} $`);

  const tally = { asked: jobs.length, answered: 0, written: 0, drawable: 0, repaired: 0, failures: [] as Array<{ archetype: string; because: string }>, stopped: null as string | null };
  let next = 0;

  async function one(job: Job) {
    const modality = modalities.find((m) => m.id === job.seg.modality_id);
    const persona = personas.find((p) => p.id === job.seg.persona_id);
    const body = {
      model: MODEL,
      instructions: prefix(job.archetype, rules)[0].text,
      input: variable(job.seg, modality?.label ?? job.seg.modality_id, persona?.label ?? job.seg.persona_id, persona?.description ?? "", job.intent, job.angle),
      max_output_tokens: job.archetype === "carousel" ? 2400 : 1200,
      reasoning: { effort: "low" },
      prompt_cache_key: `eklio-bank-${job.archetype}`,
      prompt_cache_retention: "24h",
      text: { format: bankFormat(job.archetype) },
      store: false,
    };
    const { response } = await meteredCall(transport, meter, MODEL, body, `banque ${job.archetype}`);
    tally.answered += 1;
    if (openAiRefusal(response)) {
      tally.failures.push({ archetype: job.archetype, because: "model_refusal" });
      return;
    }
    let parsed: { title?: string; hook?: string; payload?: unknown; caption_seed?: string; rationale_template?: string };
    try {
      parsed = JSON.parse(openAiText(response));
    } catch {
      tally.failures.push({ archetype: job.archetype, because: `not_json (${response.status})` });
      return;
    }
    const bankBody = bankPayloadFor(job.archetype);
    if (bankBody) parsed.payload = bankBody;

    if (budgetErrors(job.archetype, parsed.payload).length > 0) {
      const repair = await repairPayload(repairModel, job.archetype, parsed.payload);
      if (!repair.ok) {
        tally.failures.push({ archetype: job.archetype, because: `word budget: ${repair.remaining.map((e) => `${e.path} ${e.said}/${e.allowed}`).join("; ")}` });
        return;
      }
      parsed.payload = repair.payload;
      tally.repaired += 1;
    }

    const { title, hook, caption_seed: captionSeed, rationale_template: rationaleTemplate, payload } = parsed;
    if (!title || !hook || !captionSeed || !rationaleTemplate || !payload) {
      tally.failures.push({ archetype: job.archetype, because: "a required field is empty" });
      return;
    }
    const clean = checkEthics([title, hook, captionSeed, JSON.stringify(payload)].join("\n")).violations.length === 0;
    const { error } = await db.from("content_topics").insert({
      segment_id: job.seg.id,
      archetype_key: job.archetype,
      intent: job.intent,
      title,
      hook,
      payload,
      caption_seed: captionSeed,
      rationale_template: rationaleTemplate,
      ethics_reviewed_at: clean ? new Date().toISOString() : null,
    });
    if (error) {
      tally.failures.push({ archetype: job.archetype, because: `db: ${error.message.slice(0, 140)}` });
      return;
    }
    tally.written += 1;
    if (clean) tally.drawable += 1;
  }

  async function worker() {
    while (!tally.stopped) {
      const i = next;
      next += 1;
      if (i >= jobs.length) return;
      try {
        await one(jobs[i]);
      } catch (error) {
        if (error instanceof SpendCapReached) tally.stopped = error.message;
        else tally.failures.push({ archetype: jobs[i].archetype, because: `call: ${(error as Error).message.slice(0, 160)}` });
      }
      if ((i + 1) % 20 === 0) console.error(`  … ${i + 1}/${jobs.length} · ${meter.spentUsd().toFixed(4)} $`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  const after = (await db.rpc("drawable_count_for_kit", { p_brand_kit_id: KIT })).data;
  console.log(JSON.stringify({
    step: "bank (harnais, OpenAI)", model: MODEL, ...tally,
    sessionSpentUsd: Number(meter.spentUsd().toFixed(5)), usage: meter.usage(), drawableAfter: after,
  }, null, 2));
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
