/*
 * ── LA BANQUE ÉLARGIE, PAR OPENAI, AVEC LA VARIÉTÉ CONTRÔLÉE À LA SOURCE ──
 *
 * Le pilote `10-topic-bank.ts` écrit en Anthropic Batch ; cet environnement
 * n'a qu'une clé OpenAI. Ce pilote fait la même chose — même consigne
 * (`bank-prompt.ts`), mêmes gardes (budget de mots, `checkEthics`, CHECK et
 * triggers en base) — sur le modèle de rédaction du mois, en sortie stricte, et
 * il AJOUTE ce qui manquait au premier :
 *
 *   ⚠ LE CONTRÔLE DE VARIÉTÉ AU MOMENT OÙ LE SUJET S'ÉCRIT (`admitToSegment`) :
 *   une famille d'ouverture déjà au plafond de son segment, ou une intention
 *   « corriger un mythe » au-delà de sa part, fait refuser le sujet — relancé
 *   une fois avec la liste des ouvertures fermées, puis compté comme échec ;
 *   l'axe de situation (`situationFor`) dans la partie variable.
 *
 * ⚠ IL N'AJOUTE QUE DES PHRASES SEULES ET DES CARROUSELS (F119) : ce sont eux
 * qui manquent sous le plafond d'archétypes à liste. Il ne retire rien
 * (ON DELETE SET NULL sur `topic_id`).
 *
 *   EKLIO_OPENAI_API_KEY=… NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     bun scripts/local-render/12-topic-bank-openai.ts --confirm --single 6 --carousel 6 --cap 1.5
 */
import { budgetErrors } from "../../lib/compose/budget";
import { payloadSchema } from "../../lib/compose/archetypes/schema";
import { checkEthics } from "../../lib/ethics/rules";
import { OPENAI_RESPONSES_URL, openAiCostUsd } from "../../lib/content/generate/openai";
import { OPENAI_COPY_MODEL, openAiText, openAiUsage } from "../../lib/content/generate/provider";
import { admitToSegment, MYTH_INTENT, saturatedOpenings, situationFor, type BankTopicText } from "../../lib/content/bank-variety";
import { admin, noteSpend, untypedTable } from "./lib";
import { INTENTS, prefix, variable, type Seg } from "./bank-prompt";

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const SCHEMA = (archetype: string) => ({
  type: "json_schema",
  name: "eklio_bank_topic",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      hook: { type: "string" },
      payload: payloadSchema(archetype),
      caption_seed: { type: "string" },
      rationale_template: { type: "string" },
    },
    required: ["title", "hook", "payload", "caption_seed", "rationale_template"],
  },
});

/** Ce que la consigne dit des ouvertures fermées, dans la partie VARIABLE (le préfixe reste en cache). */
function openingNote(closed: string[]): string {
  if (closed.length === 0) return "";
  const said = closed.map((f) => `${f.startsWith("title/") ? "title" : "hook"} starting "${f.replace(/^(title|hook)\/(lead|neg):/, "")}…"`);
  return [
    ``,
    `⚠ THESE OPENINGS ARE ALREADY OVERUSED IN THIS LIBRARY. An idea whose title or hook`,
    `opens the same way is refused: ${said.join("; ")}.`,
    `Open with the concrete situation instead.`,
  ].join("\n");
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const key = process.env.EKLIO_OPENAI_API_KEY;
  if (!key) throw new Error("EKLIO_OPENAI_API_KEY is required.");
  const perSegment: Array<[string, number]> = [["single_statement", arg("--single", 6)], ["carousel", arg("--carousel", 6)]];
  const capUsd = arg("--cap", 1.5);
  const model = OPENAI_COPY_MODEL;

  const db = admin();
  const { data: segments } = await untypedTable<Seg>(db, "content_segments").select("id, modality_id, persona_id, state_code");
  if (!segments?.length) throw new Error("No segments.");
  const { data: modalities } = await db.from("modality_cards").select("id, label");
  const { data: personas } = await db.from("client_persona_cards").select("id, label, description");
  const { data: rules } = await db.from("ethics_rules").select("id, short_label, description");
  if (!rules?.length) throw new Error("No ethics rules in the catalogue.");
  const { data: held } = await untypedTable<{ segment_id: string; title: string; hook: string; intent: string }>(db, "content_topics").select("segment_id, title, hook, intent");

  const bySegment = new Map<string, BankTopicText[]>();
  for (const t of held ?? []) bySegment.set(t.segment_id, [...(bySegment.get(t.segment_id) ?? []), { title: t.title, hook: t.hook, intent: t.intent }]);

  let spent = 0;
  const failures: Record<string, number> = {};
  const fail = (why: string) => (failures[why.split(":")[0]] = (failures[why.split(":")[0]] ?? 0) + 1);
  let written = 0;
  let reviewed = 0;
  let calls = 0;
  let retriedOnOpening = 0;
  const usageTotal = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

  const call = async (archetype: string, input: string) => {
    const body = {
      model,
      instructions: prefix(archetype, rules)[0].text,
      input,
      max_output_tokens: 4000,
      reasoning: { effort: "low" },
      prompt_cache_key: `eklio-bank-${archetype}`,
      text: { format: SCHEMA(archetype) },
      store: false,
    };
    const res = await fetch(OPENAI_RESPONSES_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    const json = (await res.json()) as Record<string, unknown>;
    calls += 1;
    const usage = openAiUsage(json.usage as never);
    for (const k of Object.keys(usageTotal) as Array<keyof typeof usageTotal>) usageTotal[k] += usage[k];
    spent += openAiCostUsd(model, usage);
    if (!res.ok) return { error: `http ${res.status}: ${JSON.stringify(json.error ?? "").slice(0, 120)}` };
    try {
      return { parsed: JSON.parse(openAiText(json as never)) as { title: string; hook: string; payload: unknown; caption_seed: string; rationale_template: string } };
    } catch {
      return { error: "not json" };
    }
  };

  let k = 0;
  outer: for (const seg of segments) {
    const modality = modalities?.find((m) => m.id === seg.modality_id);
    const persona = personas?.find((p) => p.id === seg.persona_id);
    const topics = bySegment.get(seg.id) ?? [];
    for (const [archetype, count] of perSegment) {
      for (let i = 0; i < count; i += 1, k += 1) {
        if (spent >= capUsd) {
          console.error(`▸ plafond ${capUsd} $ atteint (${spent.toFixed(4)} $) : arrêt`);
          break outer;
        }
        /* L'intention à tour de rôle ; « corriger un mythe » sautée si elle dépasserait sa part. */
        let intent = INTENTS[k % INTENTS.length];
        if (intent === MYTH_INTENT && admitToSegment(topics, { title: "x", hook: "x", intent }) !== null) intent = INTENTS[(k + 1) % INTENTS.length];
        const situation = situationFor(seg.persona_id, k);
        const base = [
          variable(seg, modality?.label ?? seg.modality_id, persona?.label ?? seg.persona_id, persona?.description ?? "", intent, k),
          situation ? `SITUATION: ${situation} — the idea is about this moment of life, said plainly.` : "",
        ].join("\n");

        let attempt = await call(archetype, base + openingNote(saturatedOpenings(topics)));
        let refusal: string | null = null;
        for (let tries = 0; tries < 2; tries += 1) {
          if ("error" in attempt) {
            refusal = attempt.error!;
            break;
          }
          const p = attempt.parsed!;
          const over = budgetErrors(archetype, p.payload);
          if (over.length > 0) {
            refusal = `word budget: ${over.map((e) => e.path).join(",")}`;
            break;
          }
          refusal = admitToSegment(topics, { title: p.title, hook: p.hook, intent });
          if (refusal === null || tries === 1) break;
          retriedOnOpening += 1;
          attempt = await call(archetype, `${base}${openingNote(saturatedOpenings(topics))}\n\nYour previous idea was refused: ${refusal}. Write a different idea that opens differently.`);
        }
        if (refusal !== null || "error" in attempt) {
          fail(refusal ?? "unknown");
          continue;
        }
        const p = attempt.parsed!;
        const verdict = checkEthics([p.title, p.hook, p.caption_seed, JSON.stringify(p.payload)].join("\n"));
        const clean = verdict.violations.length === 0;
        const { error } = await db.from("content_topics").insert({
          segment_id: seg.id,
          archetype_key: archetype,
          intent,
          title: p.title,
          hook: p.hook,
          payload: p.payload as never,
          caption_seed: p.caption_seed,
          rationale_template: p.rationale_template,
          ethics_reviewed_at: clean ? new Date().toISOString() : null,
        });
        if (error) {
          fail(`db: ${error.message.slice(0, 60)}`);
          continue;
        }
        topics.push({ title: p.title, hook: p.hook, intent });
        bySegment.set(seg.id, topics);
        written += 1;
        if (clean) reviewed += 1;
      }
    }
  }

  noteSpend(spent, "remplissage de banque (OpenAI, variété à la source)");
  console.log(JSON.stringify({ step: "topic-bank-openai", model, calls, written, drawable: reviewed, retriedOnOpening, failures, usage: usageTotal, costUsd: Number(spent.toFixed(5)), capUsd }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
