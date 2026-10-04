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
 */
import { localDb } from "../local-db";
import { INTENTS, prefix, variable, type Seg } from "../../local-render/bank-prompt";
import { payloadSchema } from "@/lib/compose/archetypes/schema";
import { budgetErrors } from "@/lib/compose/budget";
import { checkEthics } from "@/lib/ethics/rules";
import { bankPayloadFor, PRACTITIONER_ARCHETYPE } from "@/lib/content/practitioner";
import { bankTarget } from "@/lib/content/bank";
import { meteredCall, openAiRefusal, openAiTextModel, SpendCapReached } from "@/lib/content/generate/openai";
import { openAiText, OPENAI_COPY_MODEL } from "@/lib/content/generate/provider";
import { repairPayload } from "@/lib/content/generate/repair";
import { arg, confirmOrDie, sessionMeter, transportFromEnv } from "./session";

confirmOrDie("le remplissage de banque");
const KIT = arg("--kit");
if (!KIT) throw new Error("--kit <brand_kit_id> manquant");
const MODEL = OPENAI_COPY_MODEL;
const DEMAND = { practitioners: 1, attempts: 1, rounds: 1 };

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
  const db = localDb();
  const transport = transportFromEnv();
  const meter = sessionMeter();
  const repairModel = openAiTextModel(transport, meter, MODEL, "banque : réparation");

  const segRead = await db.from("content_segments").select("id, modality_id, persona_id, state_code").eq("modality_id", "emdr").eq("state_code", "CA");
  if (segRead.error) throw new Error(segRead.error.message);
  const segments = segRead.data as Seg[];
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
