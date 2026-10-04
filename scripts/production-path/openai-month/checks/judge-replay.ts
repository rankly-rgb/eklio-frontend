/*
 * ── LE JUGE DE COMPLÉTUDE REJOUÉ SUR UN MOIS PUBLIÉ — ⚠ DÉPENSE (~0,02 $) ──
 * Relit les lignes publiées d'un mois et les resoumet au juge par lots de 40,
 * en gardant le statut de chaque réponse et les clefs non rapprochées. C'est lui
 * qui a montré la puce « - » recopiée par le modèle (FOLLOWUP F74).
 *   EKLIO_OPENAI_API_KEY=… bun …/checks/judge-replay.ts <content_months.id> --confirm
 */
import { localDb } from "../../local-db";
import { writtenLinesIn } from "@/lib/content/month-checks";
import { undecidedIn } from "@/lib/content/writing-checks";
import { judgeCompleteness } from "@/lib/content/generate/completeness-judge";
import { meteredCall } from "@/lib/content/generate/openai";
import { openAiText, OPENAI_COPY_MODEL, type TextModel } from "@/lib/content/generate/provider";
import { confirmOrDie, sessionMeter, transportFromEnv } from "../session";
confirmOrDie("la contre-vérification du juge");
const db = localDb();
const rows = await db.read<{ title: string; payload: unknown; compose_archetype: string }>(
  "select title, payload, compose_archetype from public.content_items where month_id = $1", [process.argv[2]]);
const lines = undecidedIn(writtenLinesIn(rows.map((r) => ({ archetype: r.compose_archetype, title: r.title, cardLine: r.title, payload: r.payload }))));
const all = writtenLinesIn(rows.map((r) => ({ archetype: r.compose_archetype, title: r.title, cardLine: r.title, payload: r.payload })));
const seen: Array<{ status?: string; reason?: string; chars: number; output: number }> = [];
const transport = transportFromEnv(); const meter = sessionMeter();
const probe: TextModel = { async ask({ system, user, maxTokens }) {
  const { response, usage, costUsd } = await meteredCall(transport, meter, OPENAI_COPY_MODEL,
    { model: OPENAI_COPY_MODEL, instructions: system, input: user, max_output_tokens: maxTokens, store: false }, "contre-vérif juge");
  const text = openAiText(response);
  seen.push({ status: response.status, reason: response.incomplete_details?.reason, chars: text.length, output: usage.output });
  return { text, usage, costUsd };
} };
const batches: unknown[] = [];
for (let i = 0; i < lines.length; i += 40) {
  const slice = lines.slice(i, i + 40);
  const before = seen.length;
  const out = await judgeCompleteness(probe, slice);
  const matched = slice.filter((l) => l in out.verdicts).length;
  const returnedKeys = Object.keys(out.verdicts);
  const unmatchedKeys = returnedKeys.filter((k) => !slice.includes(k)).slice(0, 3);
  const missing = slice.filter((l) => !(l in out.verdicts)).slice(0, 3);
  batches.push({ asked: slice.length, matched, returned: returnedKeys.length, call: seen[before], incomplete: Object.entries(out.verdicts).filter(([, v]) => v === false).map(([l]) => l), unmatchedKeys, missing });
}
console.log(JSON.stringify({ posts: rows.length, sentToJudge: lines.length, batches }, null, 1));
await db.close();
