import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The two pieces both brand-image scripts need, in one place: reading
 * `.env.local`, and refusing a key that would make the run prove nothing.
 *
 * Deliberately NOT shared with `scripts/brand-shots/` — that CLI is the
 * marketing one, has its own env handling, and is not part of the product
 * path these two scripts exist to exercise.
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Minimal `.env.local` reader. Real `process.env` always wins, and a value is
 * only ever read — never echoed, never written back, never logged.
 */
export function loadEnvLocal(): void {
  const file = path.join(REPO_ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Errors go to stderr, so stdout stays whatever the script is FOR. */
export function die(message: string): never {
  process.stderr.write(`\n${message}\n\n`);
  process.exit(1);
}

export function required(name: string): string {
  const value = process.env[name];
  // The VALUE is never printed, here or anywhere — only whether it is set.
  if (!value) die(`${name} is not set. See this script's header for what it needs.`);
  return value;
}

export function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

/**
 * The role a Supabase API key carries, without trusting its name.
 *
 * Two shapes exist: the newer `sb_publishable_…` / `sb_secret_…` prefixes,
 * and the older JWTs whose payload carries a `role` claim. Both are checked
 * by CONTENT, because a secret key pasted into a variable named
 * `NEXT_PUBLIC_…` is exactly the mistake worth catching — and the one a name
 * check would miss.
 *
 * Only the header/payload is decoded. The signature is never verified here:
 * this is a "did you paste the wrong key" guard, not authentication.
 */
function keyRole(key: string): "publishable" | "secret" | "unknown" {
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";

  const parts = key.split(".");
  if (parts.length !== 3) return "unknown";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      role?: string;
    };
    if (payload.role === "service_role") return "secret";
    if (payload.role === "anon" || payload.role === "authenticated") return "publishable";
  } catch {
    return "unknown";
  }
  return "unknown";
}

/**
 * The project's publishable key, or a refusal.
 *
 * A `service_role` key bypasses RLS entirely, so a run using one would prove
 * nothing about `brand_kit_entitled()` or the storage policies — which are
 * the security boundary these scripts exist to exercise. Refusing it is the
 * whole reason this function is not just a `process.env` read.
 */
export function publishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    die("Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY).");

  if (keyRole(key) === "secret") {
    die(
      [
        "That is a service_role key, and these scripts refuse one.",
        "",
        "A service_role key bypasses RLS, so the run would prove nothing about",
        "brand_kit_entitled() or the storage policies — which are the security",
        "boundary the whole exercise is about. Use the project's publishable",
        "(anon) key and a real signed-in session instead.",
      ].join("\n")
    );
  }

  return key;
}
