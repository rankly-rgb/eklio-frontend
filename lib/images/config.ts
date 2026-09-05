/*
 * ── THE PROMPT PACK ─────────────────────────────────────────────────────
 *
 * Everything about generated photography that a human should be able to edit
 * without reading the pipeline: which model, which slots exist, what each one
 * costs, and the ceiling. Nothing here is inlined at a call site — the model
 * id in particular is pinned in exactly one place so a model change is one
 * edit and one review, not a grep.
 *
 * WHY gpt-image-1 AND NOT gpt-image-2. gpt-image-2 is billed by token only,
 * with no published flat per-image price, which makes a hard, provable spend
 * cap impossible to compute BEFORE the call. A flat price is a requirement
 * here, not a preference: the whole budget mechanism reserves an estimate at
 * claim time. Evaluating gpt-image-2 later is logged in FINDINGS.md.
 */

export const IMAGE_MODEL = "gpt-image-1" as const;

/**
 * Bump when the prompt builder's OUTPUT changes for inputs that would
 * otherwise hash identically — new wording, a new constraint, a different
 * slot subject. Part of `computeImageFingerprint`, so a bump makes every
 * stored image stale and the gradient returns until something regenerates.
 * Deliberately separate from `RENDERER_VERSION`, which describes satori and
 * resvg and has nothing to do with photography.
 */
export const IMAGE_PROMPT_VERSION = 1;

export type ImageQuality = "low" | "medium" | "high";
export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type ImageSlot =
  | "hero"
  | "ambient_a"
  | "ambient_b"
  | "post_bg_1"
  | "post_bg_2"
  | "post_bg_3"
  | "texture";

export type SlotConfig = {
  size: ImageSize;
  quality: ImageQuality;
  /**
   * Whether this slot may be generated at all. Six of the seven are off:
   * Session 3 proves ONE slot end to end, and a slot that cannot be claimed
   * cannot be spent on by accident. Flipping these is a later session's
   * deliberate act, not a config drive-by.
   */
  enabled: boolean;
  /** The closed vocabulary this slot's prompt is built from. Never free text. */
  subject: string;
  composition: string;
};

/*
 * Quality is a spend decision, not a taste one. The hero is the only image
 * ever shown large and full-bleed; the other six sit under a scrim with type
 * over them, where "high" buys detail nobody will ever see.
 */
export const IMAGE_SLOTS: Record<ImageSlot, SlotConfig> = {
  hero: {
    size: "1536x1024",
    quality: "high",
    enabled: true,
    subject: "an empty, softly lit interior corner of a private consulting room",
    composition:
      "wide editorial photograph, the left third open and uncluttered so text can sit over it, shallow depth of field",
  },
  ambient_a: {
    size: "1024x1536",
    quality: "medium",
    enabled: false,
    subject: "a quiet still life of everyday objects on a side table, no people present",
    composition: "vertical editorial photograph, generous negative space at the top",
  },
  ambient_b: {
    size: "1024x1536",
    quality: "medium",
    enabled: false,
    subject: "daylight falling across a plain wall and a plant, no people present",
    composition: "vertical editorial photograph, soft gradient of light across the frame",
  },
  post_bg_1: {
    size: "1024x1024",
    quality: "medium",
    enabled: false,
    subject: "an out-of-focus interior background, no people present",
    composition: "square, evenly lit, deliberately unremarkable so type reads over it",
  },
  post_bg_2: {
    size: "1024x1024",
    quality: "medium",
    enabled: false,
    subject: "an out-of-focus natural background of foliage and light, no people present",
    composition: "square, evenly lit, deliberately unremarkable so type reads over it",
  },
  post_bg_3: {
    size: "1024x1024",
    quality: "medium",
    enabled: false,
    subject: "an out-of-focus fabric and paper surface, no people present",
    composition: "square, evenly lit, deliberately unremarkable so type reads over it",
  },
  texture: {
    size: "1024x1024",
    quality: "medium",
    enabled: false,
    subject: "a close macro of a plain matte surface — paper grain, raw plaster, or woven linen",
    composition: "square, flat and even, filling the frame edge to edge",
  },
};

export const IMAGE_SLOT_KEYS = Object.keys(IMAGE_SLOTS) as ImageSlot[];

export function isImageSlot(value: string): value is ImageSlot {
  return value in IMAGE_SLOTS;
}

/*
 * ── PRICE ───────────────────────────────────────────────────────────────
 *
 * Flat USD per image, keyed on (model, quality, size).
 *
 * RETRIEVED 2026-09-05 from OpenAI's published pricing, supplied by the
 * product owner from a source this environment cannot reach. Re-verify before
 * relying on it for budgeting; OpenAI can change prices at any time.
 *
 * NOT derived from the response's `usage` block. `usage` is returned for
 * gpt-image-1, and computing cost from it would mean re-deriving OpenAI's
 * own billing formula from tokens — a second implementation of a number they
 * already publish flat. `usage` is recorded, never trusted as money.
 *
 * NOT taken from `scripts/brand-shots/openai.ts` either: that table's own
 * comment says it came from unreachable docs and dated secondary sources.
 */
export const PRICE_USD: Record<string, Record<ImageQuality, Record<ImageSize, number>>> = {
  "gpt-image-1": {
    low: { "1024x1024": 0.011, "1536x1024": 0.016, "1024x1536": 0.016 },
    medium: { "1024x1024": 0.042, "1536x1024": 0.063, "1024x1536": 0.063 },
    high: { "1024x1024": 0.167, "1536x1024": 0.25, "1024x1536": 0.25 },
  },
};

export class UnpricedImageError extends Error {
  constructor(model: string, quality: string, size: string) {
    super(`No published price for ${model} at ${quality} ${size}.`);
    this.name = "UnpricedImageError";
  }
}

/**
 * Cost in whole cents, rounded UP.
 *
 * Up, not to nearest: this number is both what gets reserved against the
 * daily ceiling and what gets recorded as spend, and a budget that
 * under-counts is not a budget. The overstatement is at most one cent per
 * image (a medium 1024x1536 at $0.063 records 7¢), always in the safe
 * direction.
 *
 * Throws rather than defaulting. A slot whose price cannot be found must stop
 * the pipeline, not quietly cost nothing — see the test that resolves every
 * slot in IMAGE_SLOTS through this function.
 */
export function priceCents(model: string, quality: ImageQuality, size: ImageSize): number {
  const usd = PRICE_USD[model]?.[quality]?.[size];
  if (typeof usd !== "number") throw new UnpricedImageError(model, quality, size);
  return Math.ceil(usd * 100);
}

export function slotPriceCents(slot: ImageSlot): number {
  const config = IMAGE_SLOTS[slot];
  return priceCents(IMAGE_MODEL, config.quality, config.size);
}

/*
 * ── REQUEST SHAPE ───────────────────────────────────────────────────────
 *
 * webp at 82, because these are photographs. The deterministic renders
 * (wordmarks, monograms, favicons) are unaffected and stay SVG/PNG.
 *
 * `moderation: "auto"`, always, never "low". This is a product for therapists.
 *
 * `response_format` is deliberately absent: GPT image models always return
 * b64_json and reject the parameter.
 */
export const OUTPUT_FORMAT = "webp" as const;
export const OUTPUT_COMPRESSION = 82;
export const MODERATION = "auto" as const;
export const BACKGROUND = "opaque" as const;
export const IMAGE_CONTENT_TYPE = "image/webp";

/**
 * The ceiling this process asks for. The database clamps it against its own
 * `brand_images_daily_cap_cents`, which the caller can only tighten — so this
 * number is a request, not the authority.
 */
export const DAILY_CAP_CENTS = 2000;

/** One retry, on transient failures only. Never a loop. */
export const MAX_ATTEMPTS = 2;
