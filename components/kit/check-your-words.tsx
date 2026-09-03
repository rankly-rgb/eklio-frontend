"use client";

import { useMemo, useState } from "react";
import { checkEthics, type EthicsViolation } from "@/lib/ethics/rules";

/*
 * "Check your own words" (Lot 7) — a textarea for text SHE writes herself
 * (a bio, a Psychology Today profile, anything outside what Eklio drafts),
 * checked against the exact same deterministic engine
 * (`checkEthics`, `lib/ethics/rules.ts`) the generation pipeline already
 * runs on everything IT writes. Purely client-side: `checkEthics` is a pure
 * function, no model call, no network round trip — the check runs on every
 * keystroke.
 *
 * `checkEthics` reports each violation's matched `excerpt` text, not a
 * character offset — this component locates it with `indexOf` purely for
 * display (the first occurrence, matching the engine's own "first
 * occurrence only" design, `guard.ts`'s own comment). Never touches
 * `lib/ethics/rules.ts` itself.
 */

type RuleLabel = { id: string; label: string; description: string };

function labelFor(ruleId: string, rules: RuleLabel[]): RuleLabel | null {
  return rules.find((rule) => rule.id === ruleId) ?? null;
}

/** Builds the text into segments, some plain, some flagged — for underlining without touching the engine's own output. */
export function segmentText(
  text: string,
  violations: EthicsViolation[]
): { text: string; violation: EthicsViolation | null }[] {
  const ranges: { start: number; end: number; violation: EthicsViolation }[] = [];
  for (const violation of violations) {
    const start = text.indexOf(violation.excerpt);
    if (start === -1) continue;
    ranges.push({ start, end: start + violation.excerpt.length, violation });
  }
  ranges.sort((a, b) => a.start - b.start);

  const segments: { text: string; violation: EthicsViolation | null }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue; // overlapping match — keep the first
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), violation: null });
    segments.push({ text: text.slice(range.start, range.end), violation: range.violation });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), violation: null });
  return segments;
}

export function CheckYourWords({ ethicsRules }: { ethicsRules: RuleLabel[] }) {
  const [text, setText] = useState("");
  const result = useMemo(() => checkEthics(text), [text]);
  const segments = useMemo(() => segmentText(text, result.violations), [text, result.violations]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-subsection font-medium text-ink">Check your own words</h3>
        <p className="mt-1.5 text-helper leading-prose text-ink-2">
          Paste your Psychology Today bio, a profile, or anything else you&rsquo;ve written yourself.
          Nothing here is saved.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste your own words here…"
        rows={6}
        className="w-full rounded-card border border-line bg-bg p-4 text-body text-ink outline-none focus:border-ink"
      />

      {text.trim() !== "" ? (
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-body leading-prose text-ink">
            {segments.map((segment, index) =>
              segment.violation ? (
                <span
                  key={index}
                  className={
                    segment.violation.severity === "block"
                      ? "underline decoration-[var(--danger)] decoration-2 underline-offset-2"
                      : "underline decoration-ink-3 decoration-2 underline-offset-2"
                  }
                >
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )}
          </p>

          {result.violations.length === 0 ? (
            <p className="mt-3 text-meta text-ink-2">Nothing flagged.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-3">
              {result.violations.map((violation, index) => {
                const rule = labelFor(violation.ruleId, ethicsRules);
                return (
                  <li key={index} className="text-meta leading-body">
                    <span
                      className={
                        violation.severity === "block" ? "text-[var(--danger)]" : "text-ink-2"
                      }
                    >
                      {rule?.label ?? violation.ruleId}
                    </span>
                    <span className="text-ink-2"> — {rule?.description ?? violation.reason}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
