import {
  CONTENT_ARCHETYPES,
  type ContentArchetype,
  type ContentCadence,
  type ContentRegister,
} from "@/lib/data/content";

/*
 * ── THE ORDER IS REVERSED, AND THAT IS THE WHOLE POINT ──────────────────
 *
 * The first draft of this pipeline wrote the caption, measured it, and then
 * picked the layout that happened to fit. That is circular: it lets the layout
 * be decided by an accident of sentence length, and it means the writer is
 * never told what it is writing into.
 *
 * So the decisions come FIRST, and the writing is done to them:
 *
 *   1. the register   — an editorial shape, drawn from what she accepted
 *   2. the archetype  — a satori layout, from the month's mix, never twice
 *                        in a row
 *   3. the on-image line, written to that archetype's measured floor
 *   4. the caption
 *   5. both scanned by the Ethics Guard, before either is stored
 *   6. the alt text, from the composed image
 *
 * Steps 1 and 2 are this file, and they are PURE. No model, no clock, no
 * database: the same inputs give the same month, which is what makes a
 * generated month reviewable instead of merely plausible.
 */

/*
 * ── HOW MANY POSTS A MONTH IS ───────────────────────────────────────────
 *
 * Four weeks' worth, not "every Tuesday in the month". A month with five
 * Tuesdays would otherwise silently produce a fifth post — 25% more image
 * spend against a fixed monthly allowance, for a post nobody promised. "Two
 * posts a week" reliably means eight; the fifth Tuesday is a calendar
 * accident, and an accident should not spend money.
 */
export const POSTS_PER_MONTH: Record<ContentCadence, number> = {
  1: 4,
  2: 8,
  3: 12,
};

/*
 * Which weekdays. Spread rather than consecutive, so a week never lands as a
 * burst on Monday and Tuesday and then silence. 1 = Monday … 7 = Sunday.
 */
export const WEEKDAYS_BY_CADENCE: Record<ContentCadence, number[]> = {
  1: [2],
  2: [2, 4],
  3: [1, 3, 5],
};

/*
 * ── THE DEFAULT LAYOUT FOR EACH EDITORIAL SHAPE ─────────────────────────
 *
 * Register is not archetype: one is what the post SAYS, the other is how it is
 * drawn. But some pairings are obvious, and `reflective_question` → `question`
 * is ruled rather than chosen.
 *
 * `permission` takes `signature` because a permission is something a practice
 * extends — "you're allowed to find this hard" reads as an assertion from
 * nowhere unless the practice's name sits under it.
 *
 * ⚠ THE DEFAULT LOSES TO THE NO-REPEAT RULE. Two identical layouts in a row
 * make a grid look like a template, which is the single most visible way
 * generated content announces itself.
 */
export const DEFAULT_ARCHETYPE: Record<ContentRegister, ContentArchetype> = {
  named_feeling: "statement",
  reflective_question: "question",
  how_the_work_works: "notes",
  permission: "signature",
  practical_note: "notes",
  seasonal_note: "story",
};

/*
 * Where a default is refused, the fallback is tried in this order. Ordered by
 * how much text the layout holds, descending, so a line already written long
 * has somewhere to go — though in the reversed order the layout is chosen
 * before a word exists, which is exactly why this list can stay this simple.
 */
const FALLBACK_ORDER: ContentArchetype[] = [
  "notes",
  "story",
  "signature",
  "question",
  "statement",
];

/*
 * ── ARCHETYPES THAT SIT ON A PHOTOGRAPH ─────────────────────────────────
 *
 * `notes` is typographic: a small-caps label over body copy, up to 472
 * characters. A photograph under that much type is either invisible behind a
 * scrim or makes the type unreadable, and it costs money either way.
 *
 * This is what decides which themes get a ground: a theme whose posts are all
 * `notes` never has a photograph drawn for it.
 */
export const PHOTOGRAPHIC_ARCHETYPES: ReadonlySet<ContentArchetype> = new Set<ContentArchetype>([
  "statement",
  "question",
  "signature",
  "story",
]);

export type PlannedPost = {
  /** Position in the month, 0-based. Stable, and the tie-break for everything. */
  index: number;
  theme: string;
  register: ContentRegister;
  archetype: ContentArchetype;
  /** YYYY-MM-DD. */
  scheduledFor: string;
  /** Whether this post needs its theme's ground composed under it. */
  photographic: boolean;
};

export type MonthPlanInput = {
  /** YYYY-MM. */
  month: string;
  cadence: ContentCadence;
  /** Her accepted registers, in catalogue order. Never empty — see below. */
  acceptedRegisters: readonly ContentRegister[];
  /** Exactly three. Always three: see `assertThreeThemes`. */
  themes: readonly string[];
};

export class NoAcceptedRegistersError extends Error {
  constructor() {
    super(
      "This kit accepted no registers. A month cannot be written from an empty " +
        "editorial vocabulary, and picking one on her behalf would put a safety " +
        "category on a caption she never agreed to."
    );
    this.name = "NoAcceptedRegistersError";
  }
}

export class ThemeCountError extends Error {
  constructor(count: number) {
    super(`A month has exactly three themes; this one has ${count}.`);
    this.name = "ThemeCountError";
  }
}

/*
 * ⚠ THREE THEMES, ALWAYS. Not "up to three", not "as many as the model
 * proposes". Two themes make a month read as one idea told twice; four make it
 * read as no idea at all, and each theme costs a photograph. The column allows
 * one to six so a future ruling has room; this generator does not use it.
 */
export function assertThreeThemes(themes: readonly string[]): asserts themes is [string, string, string] {
  if (themes.length !== 3) throw new ThemeCountError(themes.length);
}

/** Every date in `month` (YYYY-MM) falling on one of `weekdays` (1=Mon). */
export function scheduleDates(month: string, weekdays: number[], count: number): string[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const dates: string[] = [];

  for (let day = 1; day <= 31; day += 1) {
    // UTC throughout: these are calendar dates, not instants. A local-time
    // Date would shift the whole month by one day west of Greenwich.
    const date = new Date(Date.UTC(year, monthIndex - 1, day));
    if (date.getUTCMonth() !== monthIndex - 1) break;

    const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (weekdays.includes(weekday)) dates.push(date.toISOString().slice(0, 10));
  }

  return dates.slice(0, count);
}

/**
 * The month, decided. Pure, total, and deterministic.
 *
 * Registers cycle rather than being drawn at random: over twelve posts a
 * random draw from six registers reliably produces one that appears five times
 * and one that never appears at all, and she chose all of them.
 */
export function planMonth(input: MonthPlanInput): PlannedPost[] {
  if (input.acceptedRegisters.length === 0) throw new NoAcceptedRegistersError();
  assertThreeThemes(input.themes);

  const count = POSTS_PER_MONTH[input.cadence];
  const dates = scheduleDates(input.month, WEEKDAYS_BY_CADENCE[input.cadence], count);

  const posts: PlannedPost[] = [];
  let previous: ContentArchetype | null = null;

  for (let index = 0; index < Math.min(count, dates.length); index += 1) {
    const register = input.acceptedRegisters[index % input.acceptedRegisters.length];
    const archetype = chooseArchetype(register, previous);

    posts.push({
      index,
      // Themes cycle too, so all three carry posts even at cadence 1 — and a
      // theme with no post is a theme nobody paid a photograph for.
      theme: input.themes[index % input.themes.length],
      register,
      archetype,
      scheduledFor: dates[index],
      photographic: PHOTOGRAPHIC_ARCHETYPES.has(archetype),
    });
    previous = archetype;
  }

  return posts;
}

/** The default for this register, unless it would repeat the last layout. */
export function chooseArchetype(
  register: ContentRegister,
  previous: ContentArchetype | null
): ContentArchetype {
  const preferred = DEFAULT_ARCHETYPE[register];
  if (preferred !== previous) return preferred;

  const alternative = FALLBACK_ORDER.find((candidate) => candidate !== previous);
  /*
   * Unreachable while more than one archetype exists, and asserted rather than
   * defaulted: a silent fall back to `previous` here would reintroduce exactly
   * the repetition this function exists to prevent.
   */
  if (!alternative) throw new Error("No archetype available that is not a repeat.");
  return alternative;
}

/** Which themes need a photograph drawn, in plan order, deduplicated. */
export function themesNeedingGround(posts: PlannedPost[]): string[] {
  const themes: string[] = [];
  for (const post of posts) {
    if (post.photographic && !themes.includes(post.theme)) themes.push(post.theme);
  }
  return themes;
}

/* Kept honest: every archetype the planner can emit is one the renderer has. */
export const PLANNABLE_ARCHETYPES: readonly ContentArchetype[] = CONTENT_ARCHETYPES;
