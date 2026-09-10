import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";
import type { EthicsRule } from "@/lib/catalog/types";
import type { EthicsCheck } from "@/lib/brand/shapes";
import type {
  ContentArchetype,
  ContentCadence,
  ContentRegister,
  TakingClients,
} from "@/lib/data/content";
import { CAPTION_MAX_CHARS, checkOnImageFit, describeFit } from "./capacity";
import {
  ARCHETYPE_FLOOR,
  type ContentModel,
} from "./model";
import { assertThreeThemes, planMonth, themesNeedingGround, type PlannedPost } from "./plan";

/*
 * ── THE MONTH, END TO END ───────────────────────────────────────────────
 *
 * Six steps per post, in the ruled order — decide, then write to the decision:
 *
 *   1. register   (pure, `plan.ts`)
 *   2. archetype  (pure, `plan.ts`)
 *   3. the on-image line, written to that archetype's MEASURED floor
 *   4. the caption
 *   5. BOTH scanned by the Ethics Guard before EITHER is stored
 *   6. the alt text, from the composed image
 *
 * Steps 3, 4 and 6 are the only ones that need a model, and they reach it
 * through one interface (`ContentModel`). Everything else here is arithmetic
 * and control flow, which is why this file can be exercised whole with a stub.
 *
 * ── WHAT THIS FUNCTION DOES NOT DO ──────────────────────────────────────
 *
 * It does not write to the database and it does not spend on its own account.
 * It returns a month; the caller persists it. The money it does touch goes
 * through `AllowancePort`, which is the RPC pair `reserve_content_image` /
 * `settle_content_image` — reserve BEFORE the call, settle after, release on
 * failure. There is no post-purchase refund primitive in this product, so a
 * reservation that is neither settled nor released is money lost.
 */

export type GroundRequest = {
  theme: string;
  /** The prompt actually sent, exclusions included. */
  prompt: string;
  costCents: number;
};

export type GroundResult = {
  storagePath: string;
  /*
   * The identity of the brief that produced it. Carried back out so the row
   * and the file agree: recomputing it at persistence time from a different
   * input is how a stored fingerprint stops matching the path it names.
   */
  fingerprint: string;
  /** What the photograph shows, in a sentence. Feeds step 6. */
  description: string;
  /** What it really cost, if that differs from the estimate. */
  costCents: number;
};

/** Reserve before, settle after, release on failure. Never one without the other. */
export type AllowancePort = {
  reserve(costCents: number): Promise<{ ok: boolean; reason?: string }>;
  settle(costCents: number, succeeded: boolean): Promise<void>;
};

export type ComposePort = (input: {
  post: PlannedPost;
  onImageText: string;
  groundPath: string | null;
}) => Promise<{ description: string }>;

export type GenerateMonthInput = {
  /** YYYY-MM. */
  month: string;
  themes: readonly string[];
  cadence: ContentCadence;
  acceptedRegisters: readonly ContentRegister[];
  /** Read from `content_registers`. Never inlined: the rule is data. */
  safetyRules: Record<ContentRegister, string>;
  takingClients: TakingClients | null;
  /** The brief, the check-in and her off-limits, already assembled to a string. */
  context: string;
  rules: EthicsRule[];
  model: ContentModel;
  allowance: AllowancePort;
  drawGround: (request: GroundRequest) => Promise<GroundResult>;
  groundPrompt: (theme: string, context: string) => string;
  groundCostCents: number;
  compose: ComposePort;
  now?: Date;
};

export type GeneratedPost = {
  index: number;
  theme: string;
  register: ContentRegister;
  archetype: ContentArchetype;
  scheduledFor: string;
  onImageText: string;
  caption: string;
  altText: string;
  /** The theme's ground, or null for a typographic layout. */
  groundPath: string | null;
  /*
   * ⚠ WHO WROTE IT. Copied from `ContentModel.label` onto every post, so a
   * stubbed month is distinguishable from a real one in the database, in a
   * report, and on any screen that renders it. A fixture that cannot be told
   * from production is how a fixture gets published.
   */
  generatedBy: string;
};

export type GeneratedGround = {
  theme: string;
  storagePath: string | null;
  fingerprint: string | null;
  costCents: number;
  state: "settled" | "released";
};

export type GeneratedMonth = {
  month: string;
  themes: string[];
  posts: GeneratedPost[];
  grounds: GeneratedGround[];
  ethicsCheck: EthicsCheck;
  generatedBy: string;
  /** Everything that had to be rewritten or refitted, for the report. */
  retries: RetryNote[];
};

export type RetryNote = {
  index: number;
  field: "on_image_text" | "caption";
  attempt: number;
  because: string;
};

export class GenerationImpossibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationImpossibleError";
  }
}

export class AllowanceExhaustedError extends Error {
  constructor(reason: string) {
    super(`The month's image allowance refused a ground: ${reason}`);
    this.name = "AllowanceExhaustedError";
  }
}

/*
 * How many times a line may be rewritten before the month fails.
 *
 * Three, not "until it passes": a model that has broken the same rule three
 * times with the rule quoted back at it is not going to stop on the fourth,
 * and each attempt is a real call. The month fails loudly instead — nothing
 * blocking is ever persisted.
 */
const MAX_ATTEMPTS = 3;

export async function generateMonth(input: GenerateMonthInput): Promise<GeneratedMonth> {
  assertThreeThemes(input.themes);
  const now = input.now ?? new Date();

  const plan = planMonth({
    month: input.month,
    cadence: input.cadence,
    acceptedRegisters: input.acceptedRegisters,
    themes: input.themes,
  });

  const retries: RetryNote[] = [];
  const flagged: EthicsCheck["flagged"] = [];

  /* ── Steps 3, 4 and 5, post by post ─────────────────────────────────── */
  const written: { post: PlannedPost; onImageText: string; caption: string }[] = [];

  for (const post of plan) {
    const onImageText = await writeFittedLine(input, post, retries, flagged);
    const caption = await writeCaption(input, post, onImageText, retries, flagged);
    written.push({ post, onImageText, caption });
  }

  /*
   * ⚠ BOTH TEXTS ARE CLEAN BEFORE ANY MONEY IS SPENT. The grounds are drawn
   * below, after every line and caption has passed the scanner. A month that
   * fails the guard on its last post has then cost nothing, instead of leaving
   * three paid-for photographs attached to copy that can never be published.
   */

  /* ── The grounds, one per theme that carries a photographic post ────── */
  const grounds: GeneratedGround[] = [];
  const groundByTheme = new Map<string, string>();

  for (const theme of themesNeedingGround(plan)) {
    const reservation = await input.allowance.reserve(input.groundCostCents);
    if (!reservation.ok) {
      throw new AllowanceExhaustedError(reservation.reason ?? "unknown");
    }

    try {
      const result = await input.drawGround({
        theme,
        prompt: input.groundPrompt(theme, input.context),
        costCents: input.groundCostCents,
      });
      await input.allowance.settle(input.groundCostCents, true);
      groundByTheme.set(theme, result.storagePath);
      grounds.push({
        theme,
        storagePath: result.storagePath,
        fingerprint: result.fingerprint,
        costCents: result.costCents,
        state: "settled",
      });
    } catch (error) {
      /*
       * ⚠ RELEASE, THEN RETHROW. The reservation is held on a monthly
       * allowance that resets structurally; a failed draw that keeps its
       * reservation quietly shrinks the month's budget with nothing to show
       * for it, and nothing later releases it.
       */
      await input.allowance.settle(input.groundCostCents, false);
      grounds.push({ theme, storagePath: null, fingerprint: null, costCents: 0, state: "released" });
      throw error;
    }
  }

  /* ── Step 6: compose, then describe what was composed ───────────────── */
  const posts: GeneratedPost[] = [];

  for (const { post, onImageText, caption } of written) {
    const groundPath = post.photographic ? groundByTheme.get(post.theme) ?? null : null;
    const composed = await input.compose({ post, onImageText, groundPath });
    const altText = (
      await input.model.writeAltText({
        composedDescription: composed.description,
        onImageText,
        archetype: post.archetype,
      })
    ).trim();

    /*
     * The RPC refuses `ready` without alt text, and it is right to. Catching it
     * here as well means the failure names the post it happened on rather than
     * arriving as `alt_text_required` from a batch insert.
     */
    if (altText === "") {
      throw new GenerationImpossibleError(
        `Post ${post.index} (${post.archetype}, ${post.theme}) came back with no alt text.`
      );
    }

    posts.push({
      index: post.index,
      theme: post.theme,
      register: post.register,
      archetype: post.archetype,
      scheduledFor: post.scheduledFor,
      onImageText,
      caption,
      altText,
      groundPath,
      generatedBy: input.model.label,
    });
  }

  return {
    month: input.month,
    themes: [...input.themes],
    posts,
    grounds,
    ethicsCheck: { passed: true, flagged, checked_at: now.toISOString() },
    generatedBy: input.model.label,
    retries,
  };
}

/* ── Step 3 ─────────────────────────────────────────────────────────────── */

async function writeFittedLine(
  input: GenerateMonthInput,
  post: PlannedPost,
  retries: RetryNote[],
  flagged: EthicsCheck["flagged"]
): Promise<string> {
  const floorChars = ARCHETYPE_FLOOR[post.archetype];
  let because: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = (
      await input.model.writeOnImageLine({
        register: post.register,
        safetyRule: input.safetyRules[post.register],
        archetype: post.archetype,
        theme: post.theme,
        floorChars,
        context: input.context,
        takingClients: input.takingClients,
        retryBecause: because,
      })
    ).trim();

    /*
     * ⚠ THE FIT IS CHECKED BEFORE THE SCANNER, on purpose. A line that does
     * not fit is going to be rewritten anyway, and scanning it first would
     * spend a rewrite on a string that is about to be thrown away.
     */
    const misfit = checkOnImageFit(candidate, post.archetype);
    if (misfit) {
      because = describeFit(misfit, post.archetype);
      retries.push({ index: post.index, field: "on_image_text", attempt, because });
      continue;
    }

    const scanned = await scan(input, candidate, post.index, "on_image_text", retries, flagged);
    if (scanned) return scanned;

    because =
      "It broke an advertising-ethics rule and the rewrite did not clear it. " +
      "Write a different line about the same theme.";
  }

  throw new GenerationImpossibleError(
    `Post ${post.index} (${post.archetype}) could not be given a line that fits ` +
      `${floorChars} characters and passes the guard in ${MAX_ATTEMPTS} attempts.`
  );
}

/* ── Step 4 ─────────────────────────────────────────────────────────────── */

async function writeCaption(
  input: GenerateMonthInput,
  post: PlannedPost,
  onImageText: string,
  retries: RetryNote[],
  flagged: EthicsCheck["flagged"]
): Promise<string> {
  let because: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = (
      await input.model.writeCaption({
        register: post.register,
        safetyRule: input.safetyRules[post.register],
        theme: post.theme,
        onImageText,
        context: input.context,
        takingClients: input.takingClients,
        retryBecause: because,
      })
    ).trim();

    if (candidate.length > CAPTION_MAX_CHARS) {
      because = `That is ${candidate.length} characters. Instagram cuts off at ${CAPTION_MAX_CHARS}.`;
      retries.push({ index: post.index, field: "caption", attempt, because });
      continue;
    }
    if (candidate === "") {
      because = "You returned nothing. Write the caption.";
      retries.push({ index: post.index, field: "caption", attempt, because });
      continue;
    }

    const scanned = await scan(input, candidate, post.index, "caption", retries, flagged);
    if (scanned) return scanned;

    because =
      "It broke an advertising-ethics rule and the rewrite did not clear it. " +
      "Write a different caption for the same line.";
  }

  throw new GenerationImpossibleError(
    `Post ${post.index} could not be given a caption that passes the guard in ` +
      `${MAX_ATTEMPTS} attempts.`
  );
}

/* ── Step 5 ─────────────────────────────────────────────────────────────── */

/**
 * The deterministic scanner, then ONE targeted rewrite.
 *
 * Returns the clean text, or null when the rewrite did not clear it — at which
 * point the caller writes something new rather than rewriting a rewrite. Every
 * violation is recorded whether or not it was caught in the end: the badge has
 * to be able to say what was rescued, not only what survived.
 */
async function scan(
  input: GenerateMonthInput,
  text: string,
  index: number,
  field: "on_image_text" | "caption",
  retries: RetryNote[],
  flagged: EthicsCheck["flagged"]
): Promise<string | null> {
  const first = checkEthics(text);
  for (const violation of first.violations) {
    flagged.push({ field: `${index}.${field}`, excerpt: violation.excerpt, rule_id: violation.ruleId });
  }
  if (!hasBlockingViolation(first.violations)) return text;

  const blocking = first.violations.filter((violation) => violation.severity === "block");
  const problem = blocking
    .map((violation) => {
      const rule = input.rules.find((entry) => entry.id === violation.ruleId);
      return `"${violation.excerpt}" — ${rule?.description ?? violation.reason}`;
    })
    .join(" ");

  retries.push({ index, field, attempt: 0, because: `ethics: ${problem}` });

  const rewritten = (await input.model.rewrite({ text, problem })).trim();
  if (rewritten === "") return null;

  const second = checkEthics(rewritten);
  for (const violation of second.violations) {
    flagged.push({ field: `${index}.${field}`, excerpt: violation.excerpt, rule_id: violation.ruleId });
  }
  return hasBlockingViolation(second.violations) ? null : rewritten;
}
