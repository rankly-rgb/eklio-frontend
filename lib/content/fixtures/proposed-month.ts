import type { ContentItem, ContentMonthRecord } from "@/lib/data/content";
import { STUB_LABEL } from "@/lib/content/generate/stub-model";

/*
 * ── A MONTH THAT DOES NOT EXIST, SAID OUT LOUD ──────────────────────────
 *
 * No month has been generated yet: `api.anthropic.com` answers 401 from this
 * environment and there is no key. The review screen still has to be designed,
 * and designing it against an empty state teaches nothing about the state it
 * exists for.
 *
 * So: a fixture, shaped exactly like the real thing — the same
 * `ContentMonthRecord`, the same `ContentItem` rows, the same three themes, the
 * same twelve posts at cadence 3, the same archetype rotation the planner
 * would produce.
 *
 * ⚠ AND LABELLED WHEREVER IT APPEARS. `MonthPlan` takes a `fixture` prop that
 * draws a red badge, and the generator label these posts carry is
 * `stub:no-model-key` — the same one `stubContentModel` stamps. Nothing here
 * can be mistaken for a real month on screen, in the database, or in a report.
 *
 * ⚠ THE WORDS ARE NOT COPY. They are placeholders written in the registers'
 * shapes so the layout is exercised against realistic English. They are not
 * any practice's voice and none of them should ever be published.
 *
 * This module is imported by `/dev/content-plan` only. It is not reachable
 * from the app, and a test asserts that.
 */

export const FIXTURE_LABEL = STUB_LABEL;

export const FIXTURE_MONTH: ContentMonthRecord = {
  id: "00000000-0000-4000-8000-fixture000001",
  brand_kit_id: "00000000-0000-4000-8000-fixture000002",
  month: "2026-10-01",
  themes: ["Going back to a routine", "Rest that is not a reward", "Asking for help"],
  status: "proposed",
  /*
   * The fixture models the production path: themes derived from her own
   * check-in sentence, with that sentence kept beside them. `supplied` would
   * have been the easier fixture and the wrong one — the review screen's job
   * is partly to let her ask whether these three follow from what she said,
   * and a fixture with no sentence cannot exercise that.
   */
  theme_source: "derived_check_in",
  theme_source_text: "Burnout, mostly. A lot of people going back to work after the summer.",
  created_at: "2026-09-28T09:00:00Z",
};

type Seed = {
  theme: string;
  archetype: ContentItem["archetype"];
  register: NonNullable<ContentItem["register"]>;
  day: string;
  line: string;
  caption: string;
};

/*
 * Twelve posts, three themes, cadence 3 (Mon/Wed/Fri), and no layout twice in
 * a row — which is what `planMonth` produces for these inputs. Written out
 * rather than generated so the fixture cannot drift into "whatever the planner
 * happens to do today" and quietly stop being a test of the screen.
 */
const SEEDS: Seed[] = [
  {
    theme: "Going back to a routine",
    archetype: "statement",
    register: "named_feeling",
    day: "2026-10-05",
    line: "September asks a lot of people who spent August holding it together.",
    caption:
      "The first full week back is rarely the hardest one. It is usually the second, when the novelty has gone and the calendar is still full.\n\nIf that is where you are, it is not a sign you have done this badly.",
  },
  {
    theme: "Rest that is not a reward",
    archetype: "question",
    register: "reflective_question",
    day: "2026-10-07",
    line: "What would it mean to stop apologising for needing time?",
    caption:
      "Most people can name the last time they rested. Fewer can name a time they rested without having earned it first.\n\nThat difference is worth sitting with.",
  },
  {
    theme: "Asking for help",
    archetype: "notes",
    register: "how_the_work_works",
    day: "2026-10-09",
    line: "The first session is mostly listening. There is nothing to prepare, and no right way to begin.",
    caption:
      "People often arrive with a list, worried they will forget something.\n\nYou will not need it. We start with whatever is closest to the surface, and the rest arrives in its own time.",
  },
  {
    theme: "Going back to a routine",
    archetype: "signature",
    register: "permission",
    day: "2026-10-12",
    line: "You are allowed to find this harder than it looks from the outside.",
    caption:
      "A routine that works on paper can still cost more than you have. Noticing that is not a failure of discipline.",
  },
  {
    theme: "Rest that is not a reward",
    archetype: "notes",
    register: "practical_note",
    day: "2026-10-14",
    line: "Evening sessions are open again this month, and telehealth covers the whole state.",
    caption:
      "If the middle of the day has never worked, there is now more room at either end of it.",
  },
  {
    theme: "Asking for help",
    archetype: "story",
    register: "seasonal_note",
    day: "2026-10-16",
    line: "October is when the year stops asking and starts arriving.",
    caption:
      "The light goes earlier, the term is properly underway, and the things you postponed in August are still there.\n\nThis is an ordinary time to find it heavier.",
  },
  {
    theme: "Going back to a routine",
    archetype: "statement",
    register: "named_feeling",
    day: "2026-10-19",
    line: "Some weeks the hardest part is just getting to the appointment.",
    caption:
      "Getting there counts. It is not the small part of the work that has to be got out of the way before the real part starts.",
  },
  {
    theme: "Rest that is not a reward",
    archetype: "question",
    register: "reflective_question",
    day: "2026-10-21",
    line: "When did rest last arrive before you were empty?",
    caption:
      "Rest that only comes after collapse teaches the body that collapse is how rest is requested.",
  },
  {
    theme: "Asking for help",
    archetype: "notes",
    register: "how_the_work_works",
    day: "2026-10-23",
    line: "We start where you are, not where you think you should be by now.",
    caption:
      "There is no baseline you were supposed to have reached before calling. The timing was whatever it was.",
  },
  {
    theme: "Going back to a routine",
    archetype: "signature",
    register: "permission",
    day: "2026-10-26",
    line: "Rest is not a reward for finishing. It is part of the work.",
    caption:
      "You can put it in the week rather than at the end of it, and the week will usually survive.",
  },
  {
    theme: "Rest that is not a reward",
    archetype: "notes",
    register: "practical_note",
    day: "2026-10-28",
    line: "There is a waitlist rather than an open calendar this month.",
    caption:
      "If you would like to be on it, the form takes about a minute and there is no obligation attached to it.",
  },
  {
    theme: "Asking for help",
    archetype: "story",
    register: "seasonal_note",
    day: "2026-10-30",
    line: "The end of the month is a strange time to take stock, and people do it anyway.",
    caption:
      "Whatever the last four weeks were, they were four weeks. That is the whole of what they have to have been.",
  },
];

export const FIXTURE_ITEMS: ContentItem[] = SEEDS.map((seed, index) => ({
  id: `00000000-0000-4000-8000-fixtureitem${String(index).padStart(2, "0")}`,
  brand_kit_id: FIXTURE_MONTH.brand_kit_id,
  archetype: seed.archetype,
  status: "proposed",
  title: null,
  caption: seed.caption,
  on_image_text: seed.line,
  /*
   * Alt text is present on every fixture post because the RPC refuses `ready`
   * without it. A fixture that skipped it would make the screen's own
   * "cannot be marked ready" branch unreachable — so one post below drops it
   * on purpose instead.
   */
  alt_text:
    index === 4
      ? null
      : `A quiet interior standing for ${seed.theme.toLowerCase()}. The words "${seed.line}" are set over it.`,
  tags: [],
  category: null,
  image_slot: null,
  register: seed.register,
  month_id: FIXTURE_MONTH.id,
  theme: seed.theme,
  scheduled_for: seed.day,
  created_at: "2026-09-28T09:00:00Z",
  updated_at: "2026-09-28T09:00:00Z",
  posted: false,
  posted_at: null,
  channel: null,
}));
