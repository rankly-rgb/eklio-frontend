import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LOT 6 — THE EDITORIAL CALENDAR SHE CAN ACTUALLY WRITE IN ─────────────
 *
 * Reads and writes `content_items`, the ONLY month model. It superseded an
 * older monthly-content table that refused every client write by policy and
 * held zero rows for its entire life; 20260906155600 built this one beside it,
 * and the Content chantier then RETIRED the old one outright (backend
 * `20260910082539`) along with its two RPCs, its notification kind and the
 * partial index whose key was a jsonb payload path. There is no second model
 * left to diverge from.
 *
 * ── PUBLICATION STATE IS DERIVED, NEVER STORED HERE ─────────────────────
 *
 * There is no `published_at` column on an item. `posted`, `posted_at` and
 * `channel` come from the last row of the append-only `content_publications`
 * log, and the database computes them. Nothing in this file may reconstruct
 * them from a local guess: an item is posted because the log says so.
 *
 * ── NOTHING HERE GENERATES ANYTHING ─────────────────────────────────────
 *
 * No model call, no credit, no image budget. Every caption in this lot is
 * typed by her. `lib/data/__tests__/content-never-generates.test.ts` reads
 * this file and the content routes and fails if a spending path ever appears
 * in them.
 */

type Client = SupabaseClient<Database>;

export const CONTENT_ARCHETYPES = [
  "statement",
  "question",
  "notes",
  "signature",
  "story",
] as const;
export type ContentArchetype = (typeof CONTENT_ARCHETYPES)[number];

/*
 * ⚠ `proposed` GOES IN FRONT, AND IT CHANGES WHAT THE COUNTS MEAN.
 *
 *   proposed -> draft -> ready -> archived
 *
 * A `proposed` item is one Eklio wrote and she has not yet read. It counts in
 * NEITHER `Ready` nor `Posted`. Today "Ready 0" is true only by vacuity —
 * three untitled drafts and nothing else — and the moment a month arrives
 * full, a status that counted proposals would report work she has never seen.
 * Approving the month moves the batch to `draft`.
 *
 * `posted` is deliberately absent. It is derived from `content_publications`,
 * which is append-only and which clients cannot write. One copy of the fact.
 */
export const CONTENT_STATUSES = ["proposed", "draft", "ready", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/*
 * ── REGISTER IS NOT ARCHETYPE ────────────────────────────────────────────
 *
 * `archetype` above is a LAYOUT — it maps to the satori renderer's catalogue
 * keys. A register is an EDITORIAL SHAPE with its own safety rule, governing
 * what a caption may say and what it may never say. A named feeling can be
 * laid out as a statement or as notes; a practical note usually lands in notes
 * but does not have to.
 *
 * The two value sets are DISJOINT by construction — note `reflective_question`
 * rather than `question` — and a guard rail in the creating migration fails if
 * they ever overlap. That is the `min_tier` lesson applied in advance: two
 * vocabularies that agree only because both are currently permissive will
 * eventually disagree, silently.
 *
 * The catalogue itself lives in `content_registers`, with each register's
 * safety rule stored as data. This array is the TypeScript mirror of its ids;
 * the labels and rules are read from the table, never duplicated here.
 */
export const CONTENT_REGISTERS = [
  "named_feeling",
  "reflective_question",
  "how_the_work_works",
  "permission",
  "practical_note",
  "seasonal_note",
] as const;
export type ContentRegister = (typeof CONTENT_REGISTERS)[number];

/** 1, 2 or 3 posts a week. Closed: the generation plan is a table indexed by it. */
export const CONTENT_CADENCES = [1, 2, 3] as const;
export type ContentCadence = (typeof CONTENT_CADENCES)[number];

/** Governs whether a post may carry a call to action, and which one. */
export const TAKING_CLIENTS = ["yes", "waitlist", "no"] as const;
export type TakingClients = (typeof TAKING_CLIENTS)[number];

export const PUBLISH_CHANNELS = [
  "instagram",
  "facebook",
  "linkedin",
  "newsletter",
  "other",
] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

/** The seven photograph slots, by name. Mirrors the CHECK on the column. */
export const CONTENT_IMAGE_SLOTS = [
  "hero",
  "ambient_a",
  "ambient_b",
  "post_bg_1",
  "post_bg_2",
  "post_bg_3",
  "texture",
] as const;

/** What the calendar tile and the editor both render. */
export const contentItemSchema = z.object({
  id: z.string(),
  brand_kit_id: z.string(),
  archetype: z.enum(CONTENT_ARCHETYPES),
  status: z.enum(CONTENT_STATUSES),
  title: z.string().nullable(),
  caption: z.string().nullable(),
  /*
   * ⚠ TWO TEXTS, NEVER ONE SLICED. `caption` is the long thought underneath,
   * up to Instagram's 2,200. This is the line rendered ON the image, in her
   * typeface, and it carries the register. They are written separately and by
   * separate calls: cutting the opening off a caption to fill the picture
   * gives a fragment on the image and the same words repeated under it.
   *
   * Null on everything she wrote herself, and on anything generated before the
   * generator learned to write one. "No line" is a real state; an empty string
   * would render as a zero-height box.
   */
  on_image_text: z.string().nullable(),
  alt_text: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  image_slot: z.string().nullable(),
  /*
   * Null on anything she wrote herself before the generator existed — which is
   * every item in production today. Not defaulted to a register: "we do not
   * know what shape this was written under" is the truth, and inventing one
   * would put a safety category on a caption nothing checked.
   */
  register: z.enum(CONTENT_REGISTERS).nullable(),
  /** Which generated month produced it. Never derived from `scheduled_for`. */
  month_id: z.string().nullable(),
  /*
   * ⚠ NOT `category`. `category` is hers — free text on the item editor, and
   * she may rename it whenever she likes. This is one of the month's three
   * themes, written once by the generator and validated in the database
   * against the month it claims. Grouping the review screen by `category`
   * would mean a post left its theme the day she retitled it.
   */
  theme: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  posted: z.boolean(),
  posted_at: z.string().nullable(),
  channel: z.string().nullable(),
});
export type ContentItem = z.infer<typeof contentItemSchema>;

export const contentMonthSchema = z.object({
  month: z.string(),
  items: z.array(contentItemSchema),
  unscheduled: z.array(contentItemSchema),
  counts: z.object({
    /*
     * ⚠ THESE THREE COUNT ONLY WHAT SHE HAS SEEN. `proposed` items are
     * excluded from all three in `get_content_month` — the only honest count
     * is one that comes from a row SHE created, and a proposal is a row EKLIO
     * created. Counting it beside her own work would tell her she has done
     * something she has not done.
     */
    scheduled: z.number().int(),
    ready: z.number().int(),
    posted: z.number().int(),
    /*
     * Eklio's work, waiting on her — measurable, honest, and kept separate so
     * the month plan can say "twelve waiting for you" without inflating the
     * three above. Optional so a response from before the count existed still
     * parses rather than blanking the calendar.
     */
    proposed: z.number().int().optional(),
  }),
});
export type ContentMonth = z.infer<typeof contentMonthSchema>;

export const publishingLogEntrySchema = z.object({
  id: z.string(),
  item_id: z.string(),
  title: z.string().nullable(),
  archetype: z.enum(CONTENT_ARCHETYPES),
  action: z.enum(["published", "unpublished"]),
  channel: z.string().nullable(),
  occurred_at: z.string(),
});
export type PublishingLogEntry = z.infer<typeof publishingLogEntrySchema>;

export const publishingLogSchema = z.object({
  entries: z.array(publishingLogEntrySchema),
});

/* ── PREFERENCES, THE CHECK-IN, AND APPROVING A MONTH ────────────────────
 *
 * ⚠ READS GO DIRECT, WRITES GO THROUGH RPCs, and the asymmetry is the schema's
 * not a shortcut. `content_preferences` and `content_checkins` carry
 * `select_own` policies, so a session client reading them is already bounded
 * by RLS. Their INSERT/UPDATE policies are `false`, so the only door is a
 * SECURITY DEFINER function. Wrapping the reads in RPCs too would add a
 * function whose whole body is the policy that already exists.
 */

export const contentPreferencesSchema = z.object({
  brand_kit_id: z.string(),
  cadence_per_week: z.number().int(),
  accepted_registers: z.array(z.enum(CONTENT_REGISTERS)),
  off_limits: z.string().nullable(),
});
export type ContentPreferences = z.infer<typeof contentPreferencesSchema>;

export const contentCheckinSchema = z.object({
  brand_kit_id: z.string(),
  month: z.string(),
  sessions_theme: z.string().nullable(),
  taking_clients: z.enum(TAKING_CLIENTS).nullable(),
  happening: z.string().nullable(),
});
export type ContentCheckin = z.infer<typeof contentCheckinSchema>;

/*
 * The refusal shape every content RPC returns, and the ONE place its code
 * becomes an HTTP status. `not_found` is 404 rather than 403 on purpose: a
 * 403 would confirm that someone else's item exists.
 */
const rpcErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ContentResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  payment_required: 402,
  unknown_field: 400,
  /*
   * All four are 400: the caller sent something the schema refuses. They are
   * listed rather than folded into a default so that a NEW refusal code lands
   * on 500 and gets noticed, instead of being quietly reported as the client's
   * fault.
   */
  alt_text_required: 400,
  invalid_preferences: 400,
  invalid_checkin: 400,
  month_not_ready: 409,
};

function refusal(code: string, message: string): ContentResult<never> {
  return { ok: false, code, message, status: STATUS_BY_CODE[code] ?? 500 };
}

/**
 * One decoder for every content RPC: a refusal envelope becomes a typed
 * refusal, anything else is parsed against the caller's schema. A shape that
 * does not parse is a 500 rather than a silent empty state — an editor that
 * quietly renders nothing is indistinguishable from an item with no content.
 */
function decode<T>(
  context: string,
  schema: z.ZodType<T>,
  data: unknown,
  error: { message: string } | null
): ContentResult<T> {
  if (error) {
    console.error(`[content] ${context}`, error);
    return refusal("server_error", "Something went wrong. Try again.");
  }

  const asError = rpcErrorSchema.safeParse(data);
  if (asError.success) {
    return refusal(asError.data.error.code, asError.data.error.message);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[content] ${context} shape`, parsed.error.issues);
    return refusal("server_error", "Something went wrong. Try again.");
  }
  return { ok: true, data: parsed.data };
}

/*
 * The autosave patch, validated before it reaches the database.
 *
 * `.partial().strict()` is the whole point: a key that is ABSENT means "leave
 * this alone", a key present with `null` means "clear it", and an UNKNOWN key
 * is refused rather than dropped. Dropping it is what would let a renamed
 * field autosave into nothing for a whole release without anything going red.
 *
 * The lengths mirror the CHECK constraints on the columns rather than
 * inventing softer ones, so the message she reads is the real limit.
 */
export const contentPatchSchema = z
  .object({
    archetype: z.enum(CONTENT_ARCHETYPES),
    status: z.enum(CONTENT_STATUSES),
    title: z.string().max(34, "A title fits in 34 characters.").nullable(),
    caption: z.string().max(2200, "A caption fits in 2,200 characters.").nullable(),
    /*
     * 480 is the column's CHECK: the largest measured archetype floor
     * (`notes`, 472) plus air. The tighter per-archetype floor is the
     * generator's to enforce, because it is the thing that knows which layout
     * it picked; putting 144 here would refuse a legal `notes` line.
     */
    on_image_text: z
      .string()
      .max(480, "A line on the image fits in 480 characters.")
      .nullable(),
    alt_text: z.string().max(420, "Alt text fits in 420 characters.").nullable(),
    tags: z.array(z.string().max(24)).max(8, "Eight tags is the ceiling."),
    category: z.string().max(40).nullable(),
    image_slot: z.enum(CONTENT_IMAGE_SLOTS).nullable(),
    scheduled_for: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Give a date as YYYY-MM-DD.")
      .nullable(),
  })
  .partial()
  .strict();

export type ContentPatch = z.infer<typeof contentPatchSchema>;

export async function getContentMonth(
  supabase: Client,
  brandKitId: string,
  month: string
): Promise<ContentResult<ContentMonth>> {
  const { data, error } = await supabase.rpc("get_content_month", {
    p_brand_kit_id: brandKitId,
    p_month: month,
  });
  return decode("get_content_month", contentMonthSchema, data, error);
}

export async function getContentItem(
  supabase: Client,
  id: string
): Promise<ContentResult<ContentItem>> {
  const { data, error } = await supabase.rpc("get_content_item", { p_id: id });
  return decode("get_content_item", contentItemSchema, data, error);
}

export async function createContentItem(
  supabase: Client,
  brandKitId: string,
  archetype: ContentArchetype,
  scheduledFor: string | null
): Promise<ContentResult<{ id: string }>> {
  const { data, error } = await supabase.rpc("create_content_item", {
    p_brand_kit_id: brandKitId,
    p_archetype: archetype,
    /*
     * ⚠ `?? undefined` BECAUSE THE GENERATOR RENDERS A DEFAULTED PARAM AS
     * OPTIONAL, NOT NULLABLE. In the database this argument is `text default
     * null`, so passing null and omitting it reach the same value — but
     * `gen types` types it `string | undefined` and refuses the null. Omitting
     * lets Postgres apply its own default, which IS null.
     *
     * Surfaced by regenerating types that had drifted for four days. Coerced
     * rather than cast: a cast would silence the checker without making the
     * call correct, and the next defaulted param would drift the same way.
     */
    p_scheduled_for: scheduledFor ?? undefined,
  });
  return decode("create_content_item", z.object({ id: z.string() }), data, error);
}

/**
 * The autosave write. `patch` carries only what changed — a key that is absent
 * is left alone, and a key present with `null` clears the field. Those are
 * different requests, which is exactly why the RPC takes a patch rather than
 * a full row.
 */
export async function updateContentItem(
  supabase: Client,
  id: string,
  patch: Record<string, unknown>
): Promise<ContentResult<{ id: string; saved_at: string }>> {
  const { data, error } = await supabase.rpc("update_content_item", {
    p_id: id,
    p_patch: patch as never,
  });
  return decode(
    "update_content_item",
    z.object({ id: z.string(), saved_at: z.string() }),
    data,
    error
  );
}

export async function deleteContentItem(
  supabase: Client,
  id: string
): Promise<ContentResult<{ deleted: boolean }>> {
  const { data, error } = await supabase.rpc("delete_content_item", { p_id: id });
  return decode("delete_content_item", z.object({ deleted: z.boolean() }), data, error);
}

/**
 * "Mark as posted", and its undo. Idempotent in the database: marking an
 * already-posted item posted again writes no second log row, so a double
 * click cannot invent a publication that did not happen.
 */
export async function markContentPosted(
  supabase: Client,
  id: string,
  posted: boolean,
  channel: PublishChannel | null
): Promise<ContentResult<{ posted: boolean; changed: boolean }>> {
  const { data, error } = await supabase.rpc("mark_content_posted", {
    p_id: id,
    p_posted: posted,
    p_channel: channel ?? undefined,
  });
  return decode(
    "mark_content_posted",
    z.object({ posted: z.boolean(), changed: z.boolean() }),
    data,
    error
  );
}

export async function getPublishingLog(
  supabase: Client,
  brandKitId: string,
  limit = 50
): Promise<ContentResult<{ entries: PublishingLogEntry[] }>> {
  const { data, error } = await supabase.rpc("get_publishing_log", {
    p_brand_kit_id: brandKitId,
    p_limit: limit,
  });
  return decode("get_publishing_log", publishingLogSchema, data, error);
}

/** `2026-09-01` for the month a date falls in, in the product's time zone. */
export function contentMonthKey(date: Date, timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}-01`;
}

/** The label a human reads: `2026-09-01` → `September 2026`. */
export function contentMonthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
}

/** How many days the month has, so the calendar grid knows its own length. */
export function daysInMonth(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The weekday the first of the month falls on, 0 = Sunday. */
export function firstWeekday(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** The month with nothing in it. Home degrades to this rather than failing. */
export const EMPTY_CONTENT_MONTH: ContentMonth = {
  month: "1970-01-01",
  items: [],
  unscheduled: [],
  counts: { scheduled: 0, ready: 0, posted: 0 },
};

/** `2026-09-01` → `SEPTEMBER`, for a section header's mono label. */
export function contentMonthMono(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(`${key}T12:00:00Z`))
    .toUpperCase();
}

export const ARCHETYPE_LABELS: Record<ContentArchetype, string> = {
  statement: "Statement",
  question: "Question",
  notes: "Notes",
  signature: "Signature",
  story: "Story",
};

export const CHANNEL_LABELS: Record<PublishChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
  other: "Somewhere else",
};

/* ── The register catalogue ──────────────────────────────────────────────── */

export const contentRegisterRowSchema = z.object({
  id: z.enum(CONTENT_REGISTERS),
  label: z.string(),
  safety_rule: z.string(),
  sort_order: z.number().int(),
});
export type ContentRegisterRow = z.infer<typeof contentRegisterRowSchema>;

/**
 * The six editorial shapes, with the rule that bounds each one.
 *
 * ⚠ READ FROM `content_registers`, NEVER RESTATED IN TYPESCRIPT. The safety
 * rule is what the generator is held to AND what the preferences form shows
 * her, so the two must be the same string. A copy here would let the screen
 * promise one thing while the prompt asked for another, and nobody would see
 * it until a caption said something it should not.
 *
 * Returns [] on failure rather than a hard-coded fallback: a form that showed
 * six registers with invented rules would be worse than a form that says it
 * could not load.
 */
export async function getContentRegisters(
  supabase: Client
): Promise<ContentRegisterRow[]> {
  const { data, error } = await supabase
    .from("content_registers")
    .select("id, label, safety_rule, sort_order")
    .order("sort_order");

  if (error) {
    console.error(`[content] getContentRegisters: ${error.message}`);
    return [];
  }

  const parsed = z.array(contentRegisterRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(`[content] getContentRegisters: ${parsed.error.message}`);
    return [];
  }
  return parsed.data;
}


/* ── Preferences ─────────────────────────────────────────────────────────── */

/**
 * Her content preferences, or `null` if she has never answered.
 *
 * `null` is not an error and must not be rendered as one: it is the state of
 * every kit until the first visit, and the preferences step exists precisely
 * to fill it.
 */
export async function getContentPreferences(
  supabase: Client,
  brandKitId: string
): Promise<ContentPreferences | null> {
  const { data, error } = await supabase
    .from("content_preferences")
    .select("brand_kit_id, cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", brandKitId)
    .maybeSingle();

  if (error) {
    console.error("[content] getContentPreferences", error);
    return null;
  }
  if (!data) return null;

  const parsed = contentPreferencesSchema.safeParse(data);
  if (!parsed.success) {
    /*
     * A row whose `accepted_registers` holds something the six do not cover.
     * The database trigger makes that impossible today; if it ever happens,
     * reporting "not answered" is safer than handing the generator a register
     * it has no safety rule for.
     */
    console.error("[content] preferences row does not parse", parsed.error);
    return null;
  }
  return parsed.data;
}

export async function setContentPreferences(
  supabase: Client,
  input: {
    brandKitId: string;
    cadencePerWeek: ContentCadence;
    acceptedRegisters: ContentRegister[];
    offLimits: string | null;
  }
): Promise<ContentResult<{ saved_at: string }>> {
  const { data, error } = await supabase.rpc("set_content_preferences", {
    p_brand_kit_id: input.brandKitId,
    p_cadence_per_week: input.cadencePerWeek,
    p_accepted_registers: input.acceptedRegisters,
    p_off_limits: input.offLimits,
  } as never);

  return decode(
    "setContentPreferences",
    z.object({ brand_kit_id: z.string(), saved_at: z.string() }),
    data,
    error
  );
}

/* ── The monthly check-in ────────────────────────────────────────────────── */

/**
 * Her answers for this month, or `null` if she has not answered yet.
 *
 * ⚠ `null` NEVER BLOCKS A MONTH. An unanswered check-in means "generate from
 * the brief alone and leave it open at the top of the calendar". The generator
 * reads it the same way.
 */
export async function getContentCheckin(
  supabase: Client,
  brandKitId: string,
  month: string
): Promise<ContentCheckin | null> {
  const { data, error } = await supabase
    .from("content_checkins")
    .select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", brandKitId)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    console.error("[content] getContentCheckin", error);
    return null;
  }
  if (!data) return null;

  const parsed = contentCheckinSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Has she answered enough for the card to stop asking?
 *
 * ⚠ ONE ANSWER IS ENOUGH, and `taking_clients` is the one that counts. It is
 * the only field that changes what may be GENERATED — whether a post may carry
 * a call to action, and which. The other two enrich; this one governs.
 *
 * Requiring all three would keep the card at the top of her calendar for the
 * sake of an optional question, which is the opposite of sixty seconds.
 */
export function checkinAnswered(checkin: ContentCheckin | null): boolean {
  return checkin?.taking_clients != null;
}

export async function setContentCheckin(
  supabase: Client,
  input: {
    brandKitId: string;
    month: string;
    sessionsTheme: string | null;
    takingClients: TakingClients | null;
    happening: string | null;
  }
): Promise<ContentResult<{ saved_at: string }>> {
  const { data, error } = await supabase.rpc("set_content_checkin", {
    p_brand_kit_id: input.brandKitId,
    p_month: input.month,
    p_sessions_theme: input.sessionsTheme,
    p_taking_clients: input.takingClients,
    p_happening: input.happening,
  } as never);

  return decode(
    "setContentCheckin",
    z.object({ brand_kit_id: z.string(), month: z.string(), saved_at: z.string() }),
    data,
    error
  );
}

/* ── The month record ────────────────────────────────────────────────────── */

/** Statuses a generated month moves through. `posted` is never one of them. */
export const CONTENT_MONTH_STATUSES = [
  "generating",
  "proposed",
  "approved",
  "failed",
] as const;
export type ContentMonthStatus = (typeof CONTENT_MONTH_STATUSES)[number];

export const contentMonthRecordSchema = z.object({
  id: z.string(),
  brand_kit_id: z.string(),
  month: z.string(),
  themes: z.array(z.string()),
  status: z.enum(CONTENT_MONTH_STATUSES),
  created_at: z.string(),
});
export type ContentMonthRecord = z.infer<typeof contentMonthRecordSchema>;

/**
 * The month's provenance row — its themes, and whether it has been approved.
 *
 * ⚠ NOT DERIVED FROM THE ITEMS. `month_id` on an item is the link; the date it
 * is scheduled for is not. A proposal she drags into November still belongs to
 * October's plan, and still moves with it when she approves that plan.
 *
 * Returns null when no month has been generated, which is the state of every
 * kit in production today. Null is "there is no plan", not "the plan is empty".
 */
export async function getContentMonthRecord(
  supabase: Client,
  brandKitId: string,
  month: string
): Promise<ContentMonthRecord | null> {
  const { data, error } = await supabase
    .from("content_months")
    .select("id, brand_kit_id, month, themes, status, created_at")
    .eq("brand_kit_id", brandKitId)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    console.error(`[content] getContentMonthRecord: ${error.message}`);
    return null;
  }
  if (!data) return null;

  const parsed = contentMonthRecordSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`[content] getContentMonthRecord: ${parsed.error.message}`);
    return null;
  }
  return parsed.data;
}


/* ── Approving the month ─────────────────────────────────────────────────── */

/**
 * Moves a whole month of proposals to `draft`, in one statement in the
 * database.
 *
 * `moved` is what actually changed — 0 on a replay, and reported as 0 rather
 * than repeated to look busy. The caller should refetch the month rather than
 * patching its own copy: approval also moves items she has dragged out of the
 * month, which a local patch would miss.
 */
export async function approveContentMonth(
  supabase: Client,
  monthId: string
): Promise<ContentResult<{ moved: number }>> {
  const { data, error } = await supabase.rpc("approve_content_month", {
    p_month_id: monthId,
  } as never);

  return decode(
    "approveContentMonth",
    z.object({
      month_id: z.string(),
      approved_at: z.string(),
      moved: z.number().int(),
    }),
    data,
    error
  );
}
