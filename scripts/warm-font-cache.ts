import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import type { Database } from "@/types/supabase";

/*
 * Pre-fills the `fonts` storage bucket for every family in every active
 * `type_pairings` row — the whole set a rendered asset could ever need a
 * font for, six pairings today, at most a dozen distinct families.
 *
 * WHY THIS EXISTS, AND WHAT IT DOES NOT FIX
 * ------------------------------------------
 * `lib/kit/render/font-cache.ts` acquires a ttf file from Google Fonts by
 * sending a User-Agent that's been observed (not documented) to get a
 * `format('truetype')` `src` back — see FINDINGS.md. Running this script
 * takes that dependency off the user-facing render path entirely: once
 * every family is cached, a render never calls Google Fonts again unless
 * the cache is cleared or a new pairing is added. It does NOT fix the
 * underlying fragility — if Google's behavior changes, this script's own
 * next run is what would surface that, not a paying user's render.
 *
 * Run it:
 *   - now, once, as part of this lot;
 *   - again, by hand, any time `type_pairings` gains a new family.
 *
 *   npx tsx scripts/warm-font-cache.ts
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL_PATH = path.join(REPO_ROOT, ".env.local");

// Same minimal, dependency-free .env.local reader as scripts/brand-shots/env.ts,
// scoped to the two vars this script needs. Real process.env always wins.
function loadEnvLocal(): void {
  if (!existsSync(ENV_LOCAL_PATH)) return;
  for (const rawLine of readFileSync(ENV_LOCAL_PATH, "utf8").split("\n")) {
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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set (.env.local or the environment)."
    );
    process.exit(1);
  }

  // getCachedFontBuffer itself always opens its own admin client
  // (createAdminClient, lib/supabase/server.ts) for the `fonts` bucket —
  // this client here is only for reading type_pairings.
  const supabase = createClient<Database>(url, serviceKey);

  const { data: pairings, error } = await supabase
    .from("type_pairings")
    .select("id, heading_font, body_font, google_fonts_url")
    .eq("active", true)
    .order("sort_order");

  if (error || !pairings) {
    console.error("Could not read type_pairings:", error);
    process.exit(1);
  }

  console.log(`${pairings.length} active type pairing(s).`);

  const jobs = pairings.flatMap((p) => [
    { family: p.heading_font, url: p.google_fonts_url, pairing: p.id },
    { family: p.body_font, url: p.google_fonts_url, pairing: p.id },
  ]);

  const seen = new Set<string>();
  let failures = 0;

  for (const job of jobs) {
    if (seen.has(job.family)) continue;
    seen.add(job.family);

    process.stdout.write(`  ${job.family} (from ${job.pairing})... `);
    try {
      const buf = await getCachedFontBuffer(job.family, job.url);
      console.log(`ok, ${buf.byteLength} bytes`);
    } catch (err) {
      failures += 1;
      console.log("FAILED");
      console.error(`    ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${seen.size} distinct famil${seen.size === 1 ? "y" : "ies"}, ${failures} failure(s).`);
  if (failures > 0) process.exit(1);
}

main();
