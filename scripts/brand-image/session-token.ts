/*
 * ── GET A SESSION TO RUN generate-one.ts WITH ───────────────────────────
 *
 *   npx tsx scripts/brand-image/session-token.ts --email her@example.com
 *
 * Signs in as a real therapist and prints the two lines `generate-one.ts`
 * needs, ready to paste into `.env.local`:
 *
 *   EKLIO_SESSION_ACCESS_TOKEN=...
 *   EKLIO_SESSION_REFRESH_TOKEN=...
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * `generate-one.ts` runs every RPC as SHE would run it, because
 * `brand_kit_entitled()` and the storage.objects policies are the security
 * boundary and a service_role run would prove nothing about either. That
 * means it needs a real session — and digging one out of browser cookies by
 * hand is not a procedure anyone should be asked to follow. This is the
 * missing half.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────
 *
 *  - It never writes `.env.local` itself. You paste. A script that edits the
 *    file holding your API key is a script you have to trust twice.
 *  - It never prints, echoes or logs the password. `--password` is accepted
 *    for a non-interactive run, but the prompt is the default precisely
 *    because argv lands in shell history.
 *  - It refuses a service_role key, by content rather than by variable name.
 *
 * STDOUT carries only the paste-able lines. Everything else — the prompt,
 * the confirmation, a refusal — goes to STDERR, so `| pbcopy` gives you
 * exactly what belongs in the file and nothing else.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { arg, die, loadEnvLocal, publishableKey, required } from "./shared";

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";

/**
 * Reads a password from a TTY without echoing it.
 *
 * Raw mode is restored before every exit path, Ctrl-C included: leaving
 * someone's terminal with echo off is a real thing to do to them. Falls back
 * to a plain read when stdin is not a TTY, which is the piped case — there is
 * nothing to hide from a pipe, and refusing would just break it.
 */
function readPassword(promptText: string): Promise<string> {
  process.stderr.write(promptText);

  const { stdin } = process;
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let buffer = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk: string) => {
        buffer += chunk;
      });
      stdin.on("end", () => {
        process.stderr.write("\n");
        resolve(buffer.trim());
      });
    });
  }

  return new Promise((resolve) => {
    let buffer = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function finish(value: string): void {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stderr.write("\n");
      resolve(value);
    }

    function onData(char: string): void {
      if (char === "\r" || char === "\n" || char === CTRL_D) {
        finish(buffer);
        return;
      }
      if (char === CTRL_C) {
        stdin.setRawMode(false);
        process.stderr.write("\n");
        process.exit(130);
      }
      if (char === BACKSPACE || char === "\b") {
        buffer = buffer.slice(0, -1);
        return;
      }
      // No echo, not even a bullet per character: the length is information too.
      buffer += char;
    }

    stdin.on("data", onData);
  });
}

function readLine(promptText: string): Promise<string> {
  process.stderr.write(promptText);
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk: string) => {
      process.stdin.pause();
      resolve(chunk.trim());
    });
    process.stdin.resume();
  });
}

/** "in 59 minutes", "in 23 hours" — how long you have, in words. */
function humanRemaining(expiresAtSeconds: number): string {
  const seconds = expiresAtSeconds - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "already expired";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = publishableKey();

  const email = arg("email") ?? (await readLine("Email: "));
  if (!email) die("No email given.");

  const password = arg("password") ?? (await readPassword("Password (not echoed): "));
  if (!password) die("No password given.");

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // The reason, never the credentials, and never which of the two was wrong.
    die(`Sign-in failed: ${error?.message ?? "no session returned"}`);
  }

  const { access_token, refresh_token, expires_at } = data.session;

  /*
   * STDOUT: exactly what belongs in .env.local, and nothing else. The `#`
   * line is a comment that `loadEnvLocal` skips, so all three lines can be
   * pasted together and the expiry travels with the tokens it describes.
   */
  if (expires_at) {
    process.stdout.write(
      `# access token expires ${new Date(expires_at * 1000).toISOString()} (${humanRemaining(expires_at)})\n`
    );
  }
  process.stdout.write(`EKLIO_SESSION_ACCESS_TOKEN=${access_token}\n`);
  process.stdout.write(`EKLIO_SESSION_REFRESH_TOKEN=${refresh_token}\n`);

  process.stderr.write(
    `\nSigned in as ${data.user?.email ?? email}. Paste the lines above into .env.local.\n`
  );
  if (expires_at) {
    process.stderr.write(
      `The access token expires ${humanRemaining(expires_at)}; run this again after that.\n`
    );
  }
  process.stderr.write("\n");
}

main().catch((err: Error) => {
  // The message, never the stack: a stack from the auth client can carry
  // request headers.
  die(`Unexpected failure: ${err.message}`);
});
