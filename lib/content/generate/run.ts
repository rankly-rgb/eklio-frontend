import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database } from "@/types/supabase";
import { openAiImageClientFromEnv } from "@/lib/images/client";
import { IMAGE_MODEL, priceCents } from "@/lib/images/config";
import type { EthicsRule } from "@/lib/catalog/types";
import type {
  ContentCadence,
  ContentCheckin,
  ContentPreferences,
  ContentRegister,
} from "@/lib/data/content";
import { buildGroundPrompt } from "./ground";
import { anthropicContentModel, type ContentModel } from "./model";
import { PHOTOGRAPHIC_ARCHETYPES } from "./plan";
import {
  generateMonth,
  type AllowancePort,
  type ComposePort,
  type GeneratedMonth,
  type GroundRequest,
  type GroundResult,
} from "./pipeline";

type Admin = SupabaseClient<Database>;

/*
 * ── FROM A PURE PIPELINE TO A REAL MONTH ────────────────────────────────
 *
 * `pipeline.ts` decides and writes; it knows nothing about Supabase, storage,
 * or the RPCs. This file is the adapter: it fills every port with the real
 * thing and then persists what came back.
 *
 * The split is not tidiness. It is what makes the forbidden order — draw the
 * photograph first, reserve the money after — impossible to write by accident,
 * and it is what let the whole pipeline be tested months before a key existed.
 */

/* ── The meter ─────────────────────────────────────────────────────────── */

/**
 * Reserve before, settle after, release on failure — against
 * `content_image_allowance`, which is keyed `(brand_kit_id, month)` so the
 * monthly reset is structural rather than a job someone has to remember.
 *
 * ⚠ NOT `plans.image_budget_cents`. That is a LIFETIME pot attached to a
 * one-time purchase: she bought seven photographs with her kit and that money
 * is hers until she spends it. Three months of content drawing on it would be
 * spending what she already paid for outright.
 */
export function contentAllowancePort(
  admin: Admin,
  brandKitId: string,
  month: string
): AllowancePort {
  return {
    async reserve(costCents) {
      const { data, error } = await admin.rpc("reserve_content_image", {
        p_brand_kit_id: brandKitId,
        p_month: month,
        p_cost_cents: costCents,
      } as never);

      if (error) {
        // A meter that cannot be read is "we could not tell", never "go ahead".
        console.error(`[content/run] reserve_content_image: ${error.message}`);
        return { ok: false, reason: "meter_unreadable" };
      }
      const row = data as unknown as { ok?: boolean; reason?: string } | null;
      return { ok: row?.ok === true, reason: row?.reason };
    },

    async settle(costCents, succeeded) {
      const { error } = await admin.rpc("settle_content_image", {
        p_brand_kit_id: brandKitId,
        p_month: month,
        p_cost_cents: costCents,
        p_succeeded: succeeded,
      } as never);
      if (error) {
        /*
         * ⚠ LOUD, AND NOT SWALLOWED. A reservation that is neither settled nor
         * released is money gone from her month with nothing to show for it,
         * and there is no post-purchase refund primitive anywhere in this
         * product. Nothing else releases it later.
         */
        console.error(
          `[content/run] settle_content_image LEAKED ${costCents}c for ${brandKitId} ${month}: ${error.message}`
        );
      }
    },
  };
}

/* ── The photograph ────────────────────────────────────────────────────── */

/** Medium 1024×1024: these sit under a scrim with type over them. */
export const GROUND_QUALITY = "medium" as const;
export const GROUND_SIZE = "1024x1024" as const;
export const GROUND_COST_CENTS = priceCents(IMAGE_MODEL, GROUND_QUALITY, GROUND_SIZE);

export const CONTENT_BUCKET = "brand-assets";

/** Stable per (kit, month, theme, prompt): the same brief never pays twice. */
export function groundFingerprint(brandKitId: string, month: string, prompt: string): string {
  return createHash("sha256").update(`${brandKitId}|${month}|${prompt}`).digest("hex").slice(0, 32);
}

export function groundStoragePath(brandKitId: string, month: string, fingerprint: string): string {
  return `${brandKitId}/content/${month}/${fingerprint}.webp`;
}

export function contentGroundDrawer(
  admin: Admin,
  brandKitId: string,
  month: string
): (request: GroundRequest) => Promise<GroundResult> {
  const client = openAiImageClientFromEnv();

  return async ({ theme, prompt }) => {
    const fingerprint = groundFingerprint(brandKitId, month, prompt);
    const path = groundStoragePath(brandKitId, month, fingerprint);

    const result = await client.generate({
      prompt,
      size: GROUND_SIZE,
      quality: GROUND_QUALITY,
      // The kit, not the person: this string reaches a third party.
      user: brandKitId,
    });

    const upload = await admin.storage.from(CONTENT_BUCKET).upload(path, result.bytes, {
      contentType: "image/webp",
      upsert: true,
    });
    if (upload.error) throw new Error(`ground upload failed: ${upload.error.message}`);

    return {
      storagePath: path,
      fingerprint,
      description: describeGround(theme),
      costCents: GROUND_COST_CENTS,
    };
  };
}

/**
 * What the photograph shows, in the words the prompt asked for.
 *
 * Deliberately derived from the THEME and the master direction rather than
 * from the returned pixels: nothing in this stack looks at the bytes, and a
 * description invented about an image nobody read would be a confident lie in
 * a screen-reader's ear.
 */
export function describeGround(theme: string): string {
  return (
    `A quiet, sunlit interior in natural materials — plaster, linen, matte ` +
    `ceramic — standing for ${theme.toLowerCase()}. No people are in the frame.`
  );
}

/* ── Step 6's input ────────────────────────────────────────────────────── */

/*
 * ── WHY THIS IS NOT A RENDERER, AND WHY THAT IS STILL HONEST ────────────
 *
 * The ruling is that alt text comes from the COMPOSED image, and it is right:
 * alt text written from the caption describes something that is not on the
 * screen, which is worse than none because it is confidently wrong.
 *
 * There is no composer yet — setting her typeface over a ground and rasterising
 * it is its own lot. But the composition adds NO visual content the two inputs
 * below do not already carry: it is a known photograph with a known line set
 * over it, and nothing else. Describing it from those two is therefore not a
 * guess about pixels; it is the composition's own inputs, read back.
 *
 * ⚠ THAT STOPS BEING TRUE the moment the composer adds anything of its own —
 * a wordmark, a gradient, a practice name in the corner. Whoever builds it
 * must come back here, or the alt text will start omitting what it gains.
 */
export const composeFromGround: ComposePort = async ({ post, groundPath }) => ({
  description:
    groundPath && PHOTOGRAPHIC_ARCHETYPES.has(post.archetype)
      ? describeGround(post.theme)
      : "A plain paper ground in the practice's own colours, with no photograph.",
});

/* ── The run ───────────────────────────────────────────────────────────── */

export type RunMonthInput = {
  admin: Admin;
  brandKitId: string;
  /** YYYY-MM-01. */
  month: string;
  themes: readonly string[];
  preferences: ContentPreferences;
  checkin: ContentCheckin | null;
  safetyRules: Record<ContentRegister, string>;
  rules: EthicsRule[];
  /** The brief and her off-limits, already assembled. */
  context: string;
  /** Injected so a dry run can pass a stub without touching the vendor. */
  model?: ContentModel;
};

export async function runMonthForKit(input: RunMonthInput): Promise<GeneratedMonth> {
  const monthKey = input.month.slice(0, 7);

  return generateMonth({
    month: monthKey,
    themes: input.themes,
    cadence: input.preferences.cadence_per_week as ContentCadence,
    acceptedRegisters: input.preferences.accepted_registers,
    safetyRules: input.safetyRules,
    takingClients: input.checkin?.taking_clients ?? null,
    context: input.context,
    rules: input.rules,
    model: input.model ?? anthropicContentModel(input.rules),
    allowance: contentAllowancePort(input.admin, input.brandKitId, input.month),
    drawGround: contentGroundDrawer(input.admin, input.brandKitId, input.month),
    groundPrompt: (theme) =>
      buildGroundPrompt({
        theme,
        subject: "objects and surfaces from the practice's own rooms",
        paletteLine: "The palette appears in the objects and never as a grade over the image.",
        mood: "unhurried",
      }),
    groundCostCents: GROUND_COST_CENTS,
    compose: composeFromGround,
  });
}

/* ── Persistence ───────────────────────────────────────────────────────── */

/**
 * Writes the month, its grounds and its posts.
 *
 * ⚠ THE MONTH ROW GOES IN FIRST, and the posts carry its id. `theme` on an
 * item is checked in the database against `content_months.themes`, so an item
 * written before its month would be refused — which is the constraint doing
 * its job, not an ordering inconvenience.
 *
 * Everything lands as `proposed`. Nothing is hers until she has read the plan
 * and taken it, and `approve_content_month` is the only thing that moves the
 * batch to `draft`.
 */
export async function persistGeneratedMonth(
  admin: Admin,
  brandKitId: string,
  month: string,
  generated: GeneratedMonth
): Promise<{ monthId: string; items: number }> {
  const { data: monthRow, error: monthError } = await admin
    .from("content_months")
    .insert({
      brand_kit_id: brandKitId,
      month,
      themes: generated.themes,
      status: "proposed",
    })
    .select("id")
    .single();

  if (monthError || !monthRow) {
    throw new Error(`could not write the month: ${monthError?.message ?? "no row"}`);
  }

  const monthId = monthRow.id;

  for (const ground of generated.grounds) {
    /*
     * ⚠ `content_grounds_settled_has_path_check`: a settled ground HAS bytes
     * and anything else has not. A released ground with a path would let the
     * composer be asked to draw on nothing.
     */
    const { error } = await admin.from("content_grounds").insert({
      month_id: monthId,
      theme: ground.theme,
      fingerprint: ground.fingerprint ?? groundFingerprint(brandKitId, month, ground.theme),
      storage_path: ground.state === "settled" ? ground.storagePath : null,
      cost_cents: ground.costCents,
      state: ground.state,
    });
    if (error) console.error(`[content/run] ground row: ${error.message}`);
  }

  const { error: itemsError } = await admin.from("content_items").insert(
    generated.posts.map((post) => ({
      brand_kit_id: brandKitId,
      month_id: monthId,
      theme: post.theme,
      register: post.register,
      archetype: post.archetype,
      status: "proposed",
      on_image_text: post.onImageText,
      caption: post.caption,
      alt_text: post.altText,
      scheduled_for: post.scheduledFor,
    }))
  );
  if (itemsError) throw new Error(`could not write the posts: ${itemsError.message}`);

  return { monthId, items: generated.posts.length };
}
