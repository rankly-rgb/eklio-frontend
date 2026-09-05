/*
 * ── GENERATE EXACTLY ONE SLOT, THROUGH THE REAL PRODUCT PATH ────────────
 *
 *   npx tsx scripts/brand-image/generate-one.ts --kit <brand_kit_id> --slot hero
 *
 * This is NOT the marketing CLI (`scripts/brand-shots/`). It calls the same
 * `generateBrandImage` the route handler calls, against the same RPCs, with
 * the same claim, the same daily ceiling, the same price table and the same
 * storage path. If it works here, the product works.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────
 *
 * `api.openai.com` is unreachable from the session that built this, so the
 * one real generation has to be run by a human on a machine that can reach
 * it. Everything else about the pipeline is proved by tests against a stubbed
 * client, which spend nothing.
 *
 * ── THE GUARD ───────────────────────────────────────────────────────────
 *
 * It refuses more than one slot per run. There is no --all, no loop, no
 * comma-separated list, and `--slot` must name a slot that is `enabled` in
 * the prompt pack. Cost is bounded by construction, not by care.
 *
 * ── WHAT IT NEEDS ───────────────────────────────────────────────────────
 *
 *   OPENAI_API_KEY               in .env.local at the repo root (already
 *                                covered by .gitignore) or in the environment
 *   NEXT_PUBLIC_SUPABASE_URL     the project URL
 *   EKLIO_SESSION_ACCESS_TOKEN   a signed-in therapist's session, so every RPC
 *   EKLIO_SESSION_REFRESH_TOKEN  runs as SHE would run it. Get both from
 *                                `session-token.ts` next to this file -- they
 *                                are not meant to be dug out of cookies.
 *
 * It deliberately does NOT accept a service_role key. The whole point is to
 * exercise the caller's own session: `brand_kit_entitled()` and the
 * storage.objects policies are the security boundary, and a service_role run
 * would prove nothing about either.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { IMAGE_SLOTS, isImageSlot, slotPriceCents, type ImageSlot } from "../../lib/images/config";
import { openAiImageClientFromEnv } from "../../lib/images/client";
import { computeImageFingerprint } from "../../lib/images/fingerprint";
import { buildImagePrompt } from "../../lib/images/prompt";
import { generateBrandImage } from "../../lib/images/generate";
import { loadImageContext } from "../../lib/images/context";
import { loadBrandKit } from "../../lib/data/brand-kit";
import { arg, die, loadEnvLocal, publishableKey, required } from "./shared";

async function main(): Promise<void> {
  loadEnvLocal();

  const kitId = arg("kit") ?? die("Pass --kit <brand_kit_id>.");
  const slotArg = arg("slot") ?? "hero";

  /*
   * THE GUARD. One slot, named, enabled. Anything that looks like a batch is
   * refused before a client is even constructed.
   */
  if (process.argv.includes("--all") || slotArg.includes(",")) {
    die("This script generates ONE slot per run. There is no batch mode, deliberately.");
  }
  if (!isImageSlot(slotArg)) {
    die(`"${slotArg}" is not a slot. Known slots: ${Object.keys(IMAGE_SLOTS).join(", ")}.`);
  }
  const slot: ImageSlot = slotArg;
  if (!IMAGE_SLOTS[slot].enabled) {
    die(`The "${slot}" slot is not enabled in the prompt pack. Enabling it is a deliberate edit.`);
  }

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  // Refused by CONTENT, not by variable name -- see shared.ts. A service_role
  // key bypasses RLS, so this run would prove nothing about the boundary it
  // exists to exercise. The header above promised this; now it is true.
  const anonKey = publishableKey();

  const supabase = createClient<Database>(supabaseUrl, anonKey);
  const session = await supabase.auth.setSession({
    access_token: required("EKLIO_SESSION_ACCESS_TOKEN"),
    refresh_token: required("EKLIO_SESSION_REFRESH_TOKEN"),
  });
  if (session.error || !session.data.user) {
    die("Could not restore that session. Sign in to the app and copy a fresh pair of tokens.");
  }
  const userId = session.data.user.id;

  const kit = await loadBrandKit(supabase, kitId, userId);
  if (!kit) die("No such brand kit for this signed-in user. (404, never 403 — same as the product.)");

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) die(`This kit is not ready for photography: ${context.reason}.`);

  const fingerprint = computeImageFingerprint(context.input);
  const prompt = buildImagePrompt(slot, context.input);

  console.log("");
  console.log(`  kit           ${kitId}`);
  console.log(`  slot          ${slot}`);
  console.log(`  size/quality  ${IMAGE_SLOTS[slot].size} ${IMAGE_SLOTS[slot].quality}`);
  console.log(`  fingerprint   ${fingerprint}`);
  console.log(`  price table   ${slotPriceCents(slot)} cents`);
  console.log("");
  console.log("  prompt");
  console.log(`    ${prompt}`);
  console.log("");
  console.log("  calling the image API once…");

  const outcome = await generateBrandImage({
    supabase,
    client: openAiImageClientFromEnv(),
    brandKitId: kitId,
    slot,
    fingerprintInput: context.input,
    userId,
    // Always false here: this script is for proving the initial path, and an
    // initial slot is part of what she bought. It never spends a credit.
    isRegeneration: false,
  });

  console.log("");
  if (!outcome.ok) {
    console.error(`  REFUSED  ${outcome.reason}`);
    console.error(`           ${outcome.message}`);
    process.exit(2);
  }

  console.log("  DONE");
  console.log(`    storage path  ${outcome.storagePath}`);
  console.log(`    byte size     ${outcome.byteSize.toLocaleString("en-US")} bytes`);
  console.log(`    cost_cents    ${outcome.costCents}   (recorded on brand_images)`);
  console.log(`    usage         ${JSON.stringify(outcome.usage)}   (recorded only; never money)`);
  console.log("");
}

main().catch((err: Error) => {
  // The message, never the stack: a stack from the Supabase client can carry
  // request headers.
  die(`Unexpected failure: ${err.message}`);
});
