import type { ContentModel } from "./model";
import { ON_IMAGE_MAX_WORDS, ON_IMAGE_MIN_WORDS } from "./capacity";

/*
 * ── A STUB, AND IT SAYS SO ──────────────────────────────────────────────
 *
 * `api.anthropic.com` answers 401 from this environment and no key exists, so
 * the real lines cannot be written yet. Everything AROUND the words is
 * finished and can be proven: register choice, archetype rotation, the floor,
 * the scanner and its rewrite, the alt text, the reservation and its release.
 * An unrunnable pipeline is a different thing from an untested one, and this
 * is what makes the difference.
 *
 * ⚠ THE LABEL IS NOT COSMETIC. `label` is copied onto every post the pipeline
 * returns (`GeneratedPost.generatedBy`) and onto the month itself. A stubbed
 * month and a real one are otherwise identical in shape, and a fixture that
 * cannot be told apart from production is exactly how a fixture ends up on
 * someone's Instagram. Anything that renders a month must show this.
 *
 * The sentences below are FIXTURES. They are written in the registers' shapes
 * so the fitting arithmetic is exercised against realistic English — lorem
 * breaks at different places and would measure a different capacity — but they
 * are not copy, they are not any practice's voice, and none of them should
 * ever be published.
 */

export const STUB_LABEL = "stub:no-model-key";

const LINES = [
  "Some weeks the hardest part is just getting yourself to the appointment at all.",
  "What would it mean to stop apologising for needing more time than you planned?",
  "We start where you are today, not where you think you were supposed to be.",
  "You are allowed to find this harder than it looks from the outside looking in.",
  "Rest is not a reward you earn for finishing. It is part of the work itself.",
  "The first session is mostly listening, and there is nothing to prepare beforehand.",
];

const CAPTIONS = [
  "There is a version of this month that asks a lot of you, and a version that asks what you can give.\n\nMost weeks land somewhere between the two. Noticing which one you are in is not nothing.",
  "People often arrive apologising for how long it took them to call.\n\nThere is no schedule you were supposed to be keeping. The timing was whatever it was.",
  "Starting is rarely a decision made once. It tends to be made again on the morning of, and again in the waiting room.",
];

/** A line that breaks a blocking ethics pattern (`proven`), on purpose. */
export const STUB_UNETHICAL_LINE =
  "We heal your anxiety in a way that finally lasts for good.";

/** Its cleared form, so a test can assert the rewrite actually landed. */
export const STUB_REWRITTEN_LINE =
  "We work with anxiety at a pace that you set, week by week.";

/*
 * Three themes in the shape a derivation would produce: subjects a person is
 * living through, not post shapes. Fixtures, like everything else here.
 */
const THEMES = [
  "Going back to a routine",
  "Rest that is not a reward",
  "Asking for help",
];

/** A theme set that breaks the rules on purpose, for the validator's test. */
export const STUB_BAD_THEMES = ["reflective_question", "statement", "notes"];

export type StubOptions = {
  /**
   * Themes whose FIRST line should trip the ethics scanner. Steering is by
   * theme rather than by post index because the model interface deliberately
   * does not carry an index — the writer has no business knowing where in the
   * month it is.
   */
  misbehaveOnTheme?: string[];
  /** Themes whose FIRST line should be far too long for any archetype. */
  overrunOnTheme?: string[];
  /** Every call, in order, so a test can assert the ORDER of the six steps. */
  calls?: string[];
  /**
   * Make the FIRST theme derivation return post shapes instead of subjects —
   * the mistake a real model actually makes when it has just been handed the
   * register vocabulary.
   */
  badThemesFirst?: boolean;
};

/**
 * A deterministic stub. Same call, same answer — a month that changed between
 * two runs would make every assertion below it a coin toss.
 */
export function stubContentModel(options: StubOptions = {}): ContentModel {
  const misbehave = new Set(options.misbehaveOnTheme ?? []);
  const overrun = new Set(options.overrunOnTheme ?? []);
  const attempts = new Map<string, number>();
  const record = (what: string) => options.calls?.push(what);

  function attemptOf(key: string): number {
    const next = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, next);
    return next;
  }

  return {
    label: STUB_LABEL,

    async writeThemes(request) {
      const attempt = attemptOf("themes");
      record(`themes:${request.sessionsTheme ? "check_in" : "brief"}:${attempt}`);
      if (attempt === 1 && options.badThemesFirst) return STUB_BAD_THEMES;
      return THEMES;
    },

    async writeOnImageLine(request) {
      const attempt = attemptOf(`line:${request.theme}:${request.archetype}`);
      record(`line:${request.register}:${request.archetype}:${attempt}`);

      if (attempt === 1 && overrun.has(request.theme)) {
        /*
         * Six sentences: about 470 characters, which is under the `notes`
         * floor of 472 — so this fails on the WORD bound (78 words against a
         * ceiling of 40), not the character one. Deliberate: the two bounds
         * are separate rules and only one of them is about the box.
         */
        return LINES.join(" ");
      }
      if (attempt === 1 && misbehave.has(request.theme)) {
        return STUB_UNETHICAL_LINE;
      }

      return fitToFloor(LINES[(attempt - 1) % LINES.length], request.floorChars);
    },

    async writeCaption(request) {
      const attempt = attemptOf(`caption:${request.theme}`);
      record(`caption:${request.register}:${attempt}`);
      return CAPTIONS[(attempt - 1) % CAPTIONS.length];
    },

    async writeAltText(request) {
      record(`alt:${request.archetype}`);
      return `${request.composedDescription} The words "${request.onImageText}" are set over it.`;
    },

    async rewrite(request) {
      record("rewrite");
      // A real rewrite keeps the shape and drops the claim. This one does the
      // same thing crudely, which is enough to prove the guard clears.
      return request.text.split(STUB_UNETHICAL_LINE).join(STUB_REWRITTEN_LINE);
    },
  };
}

/** Trim to the floor on a word boundary, keeping at least the minimum words. */
function fitToFloor(line: string, floorChars: number): string {
  const words = line.split(" ");
  while (words.length > ON_IMAGE_MIN_WORDS && words.join(" ").length > floorChars) {
    words.pop();
  }
  return words.slice(0, ON_IMAGE_MAX_WORDS).join(" ");
}
