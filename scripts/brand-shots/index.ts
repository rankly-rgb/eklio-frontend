import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { getApiKey, REPO_ROOT } from "./env";
import {
  ContentPolicyError,
  estimateCostUsd,
  generateImages,
  InvalidApiKeyError,
  type ImageQuality,
  type ImageSize,
} from "./openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_PATH = path.join(__dirname, "presets.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "brand-shots");

const VALID_SIZES: ImageSize[] = ["1536x1024", "1024x1024", "1024x1536"];
const VALID_QUALITIES: ImageQuality[] = ["low", "medium", "high"];
const MAX_COUNT = 4;

interface PromptPack {
  masterArtDirection: string;
  presets: Record<string, string>;
}

interface Args {
  shot?: string;
  prompt?: string;
  count: number;
  size: ImageSize;
  quality: ImageQuality;
  yes: boolean;
}

function printHelp(presets: PromptPack): void {
  const shotNames = Object.keys(presets.presets).join(", ");
  console.log(
    [
      "Usage: npm run brand-shots -- --shot <name> [options]",
      "       npm run brand-shots -- --prompt \"...\" [options]",
      "",
      `--shot <name>     one of: ${shotNames}`,
      '--prompt "..."    free prompt (master art direction is still prepended)',
      "--count <n>       number of images, 1-4 (default 1)",
      `--size <size>     ${VALID_SIZES.join(" | ")} (default 1536x1024)`,
      `--quality <q>     ${VALID_QUALITIES.join(" | ")} (default high)`,
      "--yes             skip the cost confirmation prompt",
    ].join("\n"),
  );
}

function parseArgs(argv: string[], presets: PromptPack): Args {
  const args: Args = {
    count: 1,
    size: "1536x1024",
    quality: "high",
    yes: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--shot":
        args.shot = argv[++i];
        break;
      case "--prompt":
        args.prompt = argv[++i];
        break;
      case "--count":
        args.count = Number(argv[++i]);
        break;
      case "--size":
        args.size = argv[++i] as ImageSize;
        break;
      case "--quality":
        args.quality = argv[++i] as ImageQuality;
        break;
      case "--yes":
      case "-y":
        args.yes = true;
        break;
      case "--help":
      case "-h":
        printHelp(presets);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${flag}`);
        printHelp(presets);
        process.exit(1);
    }
  }

  if (!args.shot && !args.prompt) {
    console.error("Pass either --shot <name> or --prompt \"...\".\n");
    printHelp(presets);
    process.exit(1);
  }
  if (args.shot && args.prompt) {
    console.error("Pass only one of --shot or --prompt, not both.");
    process.exit(1);
  }
  if (args.shot && !(args.shot in presets.presets)) {
    console.error(
      `Unknown --shot "${args.shot}". Valid presets: ${Object.keys(presets.presets).join(", ")}`,
    );
    process.exit(1);
  }
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > MAX_COUNT) {
    console.error(`--count must be an integer between 1 and ${MAX_COUNT}.`);
    process.exit(1);
  }
  if (!VALID_SIZES.includes(args.size)) {
    console.error(`--size must be one of: ${VALID_SIZES.join(", ")}`);
    process.exit(1);
  }
  if (!VALID_QUALITIES.includes(args.quality)) {
    console.error(`--quality must be one of: ${VALID_QUALITIES.join(", ")}`);
    process.exit(1);
  }

  return args;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextFileIndex(shotLabel: string, date: string): number {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const prefix = `${date}-${shotLabel}-`;
  let maxIndex = 0;
  for (const name of readdirSync(OUTPUT_DIR)) {
    if (!name.startsWith(prefix) || !name.endsWith(".png")) continue;
    const n = Number(name.slice(prefix.length, -".png".length));
    if (Number.isInteger(n)) maxIndex = Math.max(maxIndex, n);
  }
  return maxIndex + 1;
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const presets: PromptPack = JSON.parse(readFileSync(PRESETS_PATH, "utf8"));
  const args = parseArgs(process.argv.slice(2), presets);

  const brief = args.shot ? presets.presets[args.shot] : args.prompt!;
  const prompt = `${presets.masterArtDirection}\n\n${brief}`;
  const shotLabel = args.shot ?? "custom";

  const estimatedCost = estimateCostUsd(args.size, args.quality, args.count);
  console.log(
    `Requesting ${args.count} image(s) — shot="${shotLabel}", size=${args.size}, quality=${args.quality}`,
  );
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(3)}`);

  if (args.count > 2 && !args.yes) {
    const ok = await confirm(`This run will generate ${args.count} images for ~$${estimatedCost.toFixed(3)}. Continue?`);
    if (!ok) {
      console.log("Cancelled.");
      return;
    }
  }

  const apiKey = getApiKey();

  let images: string[];
  try {
    images = await generateImages({
      apiKey,
      prompt,
      n: args.count,
      size: args.size,
      quality: args.quality,
    });
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      console.error("OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local.");
      process.exit(1);
    }
    if (err instanceof ContentPolicyError) {
      console.error(`OpenAI declined this prompt on content-policy grounds:\n${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const date = todayStamp();
  let index = nextFileIndex(shotLabel, date);
  const savedPaths: string[] = [];

  for (const b64 of images) {
    const filename = `${date}-${shotLabel}-${index}.png`;
    const filePath = path.join(OUTPUT_DIR, filename);
    writeFileSync(filePath, Buffer.from(b64, "base64"));
    savedPaths.push(path.relative(REPO_ROOT, filePath));
    index++;
  }

  console.log("\nSaved:");
  for (const p of savedPaths) console.log(`  ${p}`);
  console.log(`\nApprox. cost for this run: ~$${estimatedCost.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
