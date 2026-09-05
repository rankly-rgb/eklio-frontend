/*
 * Reading level — Flesch-Kincaid grade, computed deterministically. The one
 * reading measure the product shows, and it is not a score: never a
 * percentage, never colored good or bad, always rendered as
 * "Reading level · 8th grade".
 */

export type ReadingLevel = {
  /** Raw Flesch-Kincaid grade level, unrounded — for tests and diffing. */
  grade: number;
  /** "Kindergarten" | "1st grade" … "12th grade" | "College" */
  label: string;
};

const SENTENCE_SPLIT = /[.!?]+(?:\s+|$)/;
const WORD_SPLIT = /\s+/;

function words(text: string): string[] {
  return text
    .split(WORD_SPLIT)
    .map((w) => w.replace(/[^A-Za-z']/g, ""))
    .filter((w) => w.length > 0);
}

function sentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Heuristic vowel-group syllable count — no dictionary, no dependency. */
function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length === 0) return 0;

  const groups = lower.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;

  if (lower.endsWith("e") && !lower.endsWith("le") && count > 1) {
    count -= 1;
  }

  return Math.max(count, 1);
}

/**
 * `0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59` — the
 * standard Flesch-Kincaid Grade Level formula. Empty or single-word input
 * returns grade 0 ("Kindergarten") rather than dividing by zero.
 */
export function fleschKincaidGrade(text: string): number {
  const w = words(text);
  const s = sentences(text);

  if (w.length === 0 || s.length === 0) return 0;

  const syllables = w.reduce((total, word) => total + countSyllables(word), 0);
  const grade = 0.39 * (w.length / s.length) + 11.8 * (syllables / w.length) - 15.59;

  return Math.max(grade, 0);
}

function gradeLabel(grade: number): string {
  const rounded = Math.round(grade);

  if (rounded <= 0) return "Kindergarten";
  if (rounded >= 13) return "College";

  const suffix =
    rounded % 10 === 1 && rounded !== 11
      ? "st"
      : rounded % 10 === 2 && rounded !== 12
        ? "nd"
        : rounded % 10 === 3 && rounded !== 13
          ? "rd"
          : "th";

  return `${rounded}${suffix} grade`;
}

export function readingLevel(text: string): ReadingLevel {
  const grade = fleschKincaidGrade(text);
  return { grade, label: gradeLabel(grade) };
}
