import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";
import {
  CONTENT_ARCHETYPES,
  CONTENT_REGISTERS,
  type ContentCheckin,
} from "@/lib/data/content";
import type { ContentModel } from "./model";

/*
 * ── THE THREE THEMES ARE DERIVED, NOT ASKED FOR ─────────────────────────
 *
 * ⚠ IN PRODUCTION SHE NEVER TYPES THEM. If a therapist has to supply three
 * themes to get a month, the sixty-second promise is gone and the monthly
 * check-in exists for nothing. The check-in already asks the only question
 * that matters — "what has been coming up in your sessions this month" — and
 * this is what that answer is FOR.
 *
 * Two paths, and both produce a month:
 *
 *   derived_check_in   she answered. The themes come from her own sentence,
 *                      which is kept verbatim beside them.
 *   derived_brief      she did not. The themes come from the brief's specialty
 *                      and audience plus the calendar month. ⚠ AN UNANSWERED
 *                      CHECK-IN NEVER BLOCKS A MONTH — the card says so on her
 *                      calendar, and this is the code that keeps the promise.
 *
 * There is a third value, `supplied`, and it is not a path: it is what the
 * generator script stamps when a human passes `--themes`. It exists so that a
 * hand-typed test run can never be read, later, as evidence the derivation
 * works.
 */

export type ThemeSource = "derived_check_in" | "derived_brief" | "supplied";

export type DerivedThemes = {
  themes: [string, string, string];
  source: ThemeSource;
  /**
   * The check-in sentence the themes came from, verbatim.
   *
   * Null on `derived_brief` and `supplied`, where there is no sentence. A
   * paraphrase here would defeat the point of keeping it: reviewing a month
   * means asking whether these three follow from what she actually said.
   */
  sourceText: string | null;
};

export type ThemesRequest = {
  /** YYYY-MM. The model needs the season; "October" is not a detail. */
  month: string;
  /** Her free text, or null. */
  sessionsTheme: string | null;
  /** The brief's specialty and audience, already assembled. */
  briefContext: string;
  offLimits: string | null;
  retryBecause?: string;
};

export class ThemeDerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeDerivationError";
  }
}

/*
 * ⚠ A THEME IS NOT A REGISTER AND NOT AN ARCHETYPE. Asked for "three themes",
 * a model reaches for the vocabulary it was just handed and returns "a
 * reflective question" or "statement". Those are the axes the month is BUILT
 * on; a theme is what it is about. Refused by name, because the failure is
 * invisible downstream — a month whose three themes are three layouts reads as
 * three photographs of nothing.
 */
const RESERVED = new Set<string>([
  ...CONTENT_REGISTERS,
  ...CONTENT_ARCHETYPES,
  ...CONTENT_REGISTERS.map((register) => register.replace(/_/g, " ")),
]);

/** Mirrors `content_months_themes_check` and the theme column's own CHECK. */
export const THEME_MAX_CHARS = 80;

export type ThemeRejection = { reason: string };

/**
 * Whether a candidate set may become a month's themes.
 *
 * Pure, and separate from the call, so the rules are readable without reading
 * a prompt — and so the retry can quote the actual failure back.
 */
export function checkThemes(candidates: string[]): ThemeRejection | null {
  if (candidates.length !== 3) {
    return { reason: `You returned ${candidates.length} themes. It must be exactly three.` };
  }

  for (const theme of candidates) {
    const trimmed = theme.trim();
    if (trimmed === "") return { reason: "One of the themes was empty." };
    if (trimmed.length > THEME_MAX_CHARS) {
      return {
        reason:
          `"${trimmed.slice(0, 30)}…" is ${trimmed.length} characters. ` +
          `A theme must fit in ${THEME_MAX_CHARS}.`,
      };
    }
    if (RESERVED.has(trimmed.toLowerCase())) {
      return {
        reason:
          `"${trimmed}" is a post shape, not a subject. A theme is what the ` +
          `month is ABOUT — name something a person is living through.`,
      };
    }
  }

  const lowered = candidates.map((theme) => theme.trim().toLowerCase());
  if (new Set(lowered).size !== 3) {
    return { reason: "Two of the themes are the same. The month needs three different ones." };
  }

  /*
   * ⚠ SCANNED BEFORE ANYTHING IS BUILT ON THEM. A theme is not published text,
   * which is exactly why it is easy to forget — but it steers twelve captions
   * and three photographs. "Healing your anxiety for good" as a theme produces
   * twelve posts the guard then has to catch one at a time, and some of them
   * it will not.
   */
  for (const theme of candidates) {
    const violations = checkEthics(theme).violations;
    if (hasBlockingViolation(violations)) {
      const first = violations.find((violation) => violation.severity === "block")!;
      return {
        reason: `"${theme}" breaks an advertising-ethics rule: ${first.reason}`,
      };
    }
  }

  return null;
}

const MAX_ATTEMPTS = 3;

/**
 * The production path. One model call, validated, retried with the reason.
 *
 * `sourceText` is her sentence and nothing else — not a summary of it, and not
 * the prompt that was built around it.
 */
export async function deriveThemes(
  model: ContentModel,
  input: {
    month: string;
    checkin: ContentCheckin | null;
    briefContext: string;
    offLimits: string | null;
  }
): Promise<DerivedThemes> {
  const sessionsTheme = input.checkin?.sessions_theme?.trim() || null;
  const source: ThemeSource = sessionsTheme ? "derived_check_in" : "derived_brief";

  let because: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidates = await model.writeThemes({
      month: input.month,
      sessionsTheme,
      briefContext: input.briefContext,
      offLimits: input.offLimits,
      retryBecause: because,
    });

    const cleaned = candidates.map((theme) => theme.trim()).filter(Boolean);
    const rejection = checkThemes(cleaned);
    if (!rejection) {
      return {
        themes: [cleaned[0], cleaned[1], cleaned[2]],
        source,
        sourceText: sessionsTheme,
      };
    }
    because = rejection.reason;
  }

  /*
   * No fallback set. Three invented themes here would be published under her
   * name, in her voice, about people she treats — and would be indistinguishable
   * from derived ones in the row. A failed month is recoverable; a plausible
   * wrong one is not.
   */
  throw new ThemeDerivationError(
    `Could not derive three usable themes in ${MAX_ATTEMPTS} attempts. Last reason: ${because}`
  );
}

/** The override path. Validated exactly as hard, and stamped `supplied`. */
export function suppliedThemes(candidates: string[]): DerivedThemes {
  const cleaned = candidates.map((theme) => theme.trim()).filter(Boolean);
  const rejection = checkThemes(cleaned);
  if (rejection) throw new ThemeDerivationError(rejection.reason);

  return {
    themes: [cleaned[0], cleaned[1], cleaned[2]],
    source: "supplied",
    sourceText: null,
  };
}

/* ── The prompt ────────────────────────────────────────────────────────── */

export function themesPrompt(request: ThemesRequest): string {
  const monthName = new Date(`${request.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return [
    `THE MONTH: ${monthName}`,
    request.briefContext,
    request.sessionsTheme
      ? `WHAT SHE SAID HAS BEEN COMING UP IN HER SESSIONS THIS MONTH, in her own words:\n\n"${request.sessionsTheme}"`
      : `SHE DID NOT ANSWER THIS MONTH'S CHECK-IN. Write from the practice above and the time of year alone. Do not invent anything about her caseload — you do not know what has been coming up, and a theme that pretends to would be a claim about clients nobody made.`,
    request.offLimits ? `NEVER WRITE ABOUT: ${request.offLimits}` : "",
    `Name three themes for this practice's month.

A theme is what a month is ABOUT — something a person is living through, in plain words, that several different posts could each approach differently. "Going back to a routine". "Rest that is not a reward". "Asking for help".

A theme is NOT a kind of post. Do not return "a question", "a statement", "notes", "a permission" or anything else that describes the shape of a post rather than its subject.

Three, all different, each under ${THEME_MAX_CHARS} characters. No diagnosis, no promise about what therapy achieves, nothing attributed to a client.

Return exactly three lines, one theme per line. No numbering, no punctuation at the end, nothing else.`,
    request.retryBecause ? `YOUR PREVIOUS ATTEMPT WAS REJECTED. ${request.retryBecause}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Three lines out of one text block, however the model punctuated them. */
export function parseThemeLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) =>
      line
        .trim()
        // "1. ", "1) ", "- ", "• " — a model numbers a list however often it
        // is told not to, and rejecting the whole answer over a bullet would
        // spend a retry on punctuation.
        .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")
        .replace(/^["“]|["”]$/g, "")
        .replace(/[.,;]$/, "")
        .trim()
    )
    .filter(Boolean);
}
