/*
 * Enregistre les verdicts du juge de complétude sur des lignes données, pour
 * que la suite les rejoue au lieu de les redemander.
 *
 * ⚠ LES VERDICTS D'UN TEST DOIVENT ÊTRE MESURÉS, PAS ÉCRITS À LA MAIN. Un
 * verdict inventé prouve que le test passe, pas que le juge tranche.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/97-record-verdicts.ts --lines "a|b|c"
 */
import Anthropic from "@anthropic-ai/sdk";
import { judgeCompleteness } from "../../lib/content/generate/completeness-judge";
import { completenessOf } from "../../lib/content/writing-checks";
import { syncCostUsd } from "../../lib/content/generate/copy-batch";
import { anthropicKeyOrDie } from "./lib";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  const lines = (arg("lines") ?? "").split("|").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("rien à juger : passer --lines \"a|b|c\"");

  const client = new Anthropic({ apiKey: anthropicKeyOrDie() });
  const { verdicts, usage } = await judgeCompleteness(client, lines);

  console.log(JSON.stringify({
    step: "record-verdicts",
    asked: lines.length,
    lexical: Object.fromEntries(lines.map((l) => [l, completenessOf(l)])),
    verdicts,
    usage,
    costUsd: Number(syncCostUsd({ ...usage, cacheRead: 0, cacheWrite: 0 }).toFixed(6)),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
