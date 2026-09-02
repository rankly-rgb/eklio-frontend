import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "../..");
export const ENV_LOCAL_PATH = path.join(REPO_ROOT, ".env.local");

// Minimal .env parser (no dependency) — only reads OPENAI_API_KEY at repo root.
// Real process.env values always take precedence over the file.
function loadEnvLocal(): void {
  if (!existsSync(ENV_LOCAL_PATH)) return;

  const contents = readFileSync(ENV_LOCAL_PATH, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getApiKey(): string {
  loadEnvLocal();

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error(
      [
        "OPENAI_API_KEY is not set.",
        "",
        "Add it to .env.local at the repo root:",
        "",
        "  OPENAI_API_KEY=sk-...your key...",
        "",
        "Create the file if it doesn't exist yet — it's already covered by .gitignore, so it will never be committed.",
      ].join("\n"),
    );
    process.exit(1);
  }

  return key;
}
