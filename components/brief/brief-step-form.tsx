"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveBriefField } from "@/lib/actions/brief";
import {
  defaultSliderValues,
  isFieldRequired,
  missingRequiredFields,
  type BriefAnswer,
  type BriefField,
  type BriefStep,
} from "@/lib/brief/steps";

/**
 * Renders any step from `lib/brief/steps.ts`. Autosave is a server action on
 * every field blur and on every choice — no browser storage, no draft state
 * that only exists in this tab.
 */

type SaveState = "idle" | "saving" | "saved" | "error";

export function BriefStepForm({
  projectId,
  step,
  initialAnswer,
  previousHref,
  nextHref,
  nextLabel,
}: {
  projectId: string;
  step: BriefStep;
  initialAnswer: BriefAnswer;
  previousHref: string | null;
  nextHref: string;
  nextLabel: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<BriefAnswer>(() =>
    withSliderDefaults(step, initialAnswer)
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPending, startTransition] = useTransition();

  const missing = missingRequiredFields(step, answer);
  const canContinue = missing.length === 0;

  function persist(fieldName: string, value: unknown) {
    setSaveState("saving");
    startTransition(async () => {
      const result = await saveBriefField(projectId, step.id, fieldName, value);
      setSaveState(result.ok ? "saved" : "error");
      // The dashboard shows the practice name, so keep server data fresh.
      if (result.ok) router.refresh();
    });
  }

  /** Local edit only — the write happens on blur. */
  function setLocal(fieldName: string, value: unknown) {
    setAnswer((prev) => ({ ...prev, [fieldName]: value as never }));
  }

  /** Choices have no blur to wait for: write immediately. */
  function setAndPersist(fieldName: string, value: unknown) {
    setLocal(fieldName, value);
    persist(fieldName, value);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
          {step.title}
        </p>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">
          {step.question}
        </h1>
      </header>

      <div className="flex flex-col gap-10">
        {step.fields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            answer={answer}
            onLocalChange={setLocal}
            onCommit={persist}
            onChoose={setAndPersist}
          />
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-noir/10 pt-6">
        <SaveIndicator state={isPending ? "saving" : saveState} />

        {!canContinue && (
          <p className="font-mono text-sm text-gris-fonce">
            Fill in the required fields above to continue.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          {previousHref ? (
            <Link href={previousHref} className="font-mono text-sm underline hover:opacity-60">
              Back
            </Link>
          ) : (
            <Link href="/app" className="font-mono text-sm underline hover:opacity-60">
              Save and exit
            </Link>
          )}

          {canContinue ? (
            <Link
              href={nextHref}
              className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
            >
              {nextLabel}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="cursor-not-allowed rounded-full bg-noir/30 px-6 py-3 font-mono text-sm text-cream-light"
            >
              {nextLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const text: Record<SaveState, string> = {
    idle: "Every answer saves as you go.",
    saving: "Saving…",
    saved: "Saved.",
    error: "We could not save that. Check your connection and edit the field again.",
  };

  return (
    <p
      role="status"
      aria-live="polite"
      className={`font-mono text-xs ${
        state === "error" ? "text-red-700" : "text-gris-fonce"
      }`}
    >
      {text[state]}
    </p>
  );
}

// ---------------------------------------------------------------------------

function FieldRenderer({
  field,
  answer,
  onLocalChange,
  onCommit,
  onChoose,
}: {
  field: BriefField;
  answer: BriefAnswer;
  onLocalChange: (name: string, value: unknown) => void;
  onCommit: (name: string, value: unknown) => void;
  onChoose: (name: string, value: unknown) => void;
}) {
  const required = isFieldRequired(field, answer);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-col gap-1">
        <span className="font-mono text-sm">
          {field.label}
          {required && <span className="text-gris-fonce"> *</span>}
        </span>
        {field.hint && (
          <span className="max-w-xl text-sm text-gris-fonce">{field.hint}</span>
        )}
      </legend>

      <FieldControl
        field={field}
        answer={answer}
        onLocalChange={onLocalChange}
        onCommit={onCommit}
        onChoose={onChoose}
      />
    </fieldset>
  );
}

function FieldControl({
  field,
  answer,
  onLocalChange,
  onCommit,
  onChoose,
}: {
  field: BriefField;
  answer: BriefAnswer;
  onLocalChange: (name: string, value: unknown) => void;
  onCommit: (name: string, value: unknown) => void;
  onChoose: (name: string, value: unknown) => void;
}) {
  const inputClass =
    "w-full rounded-md border border-noir/20 bg-cream-light px-3 py-2 text-base text-noir outline-none focus:border-noir";

  switch (field.kind) {
    case "text": {
      const value = asString(answer[field.name]);
      return (
        <input
          type="text"
          name={field.name}
          value={value}
          placeholder={field.placeholder}
          className={inputClass}
          onChange={(e) => onLocalChange(field.name, e.target.value)}
          onBlur={(e) => onCommit(field.name, e.target.value)}
        />
      );
    }

    case "textarea": {
      const value = asString(answer[field.name]);
      return (
        <textarea
          name={field.name}
          value={value}
          rows={3}
          placeholder={field.placeholder}
          className={`${inputClass} resize-y`}
          onChange={(e) => onLocalChange(field.name, e.target.value)}
          onBlur={(e) => onCommit(field.name, e.target.value)}
        />
      );
    }

    case "single-choice": {
      const value = asString(answer[field.name]);
      return (
        <div className="flex flex-col gap-2">
          {field.options.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3 transition-colors ${
                value === option.value
                  ? "border-noir bg-cream-light"
                  : "border-noir/20 hover:border-noir/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChoose(field.name, option.value)}
                  className="accent-noir"
                />
                <span className="text-base">{option.label}</span>
              </span>
              {option.description && (
                <span className="pl-7 text-sm text-gris-fonce">
                  {option.description}
                </span>
              )}
            </label>
          ))}
        </div>
      );
    }

    case "multi-choice":
    case "swatches":
    case "typefaces": {
      const selected = asStringArray(answer[field.name]);
      const max = field.maxSelect ?? Number.POSITIVE_INFINITY;

      function toggle(optionValue: string) {
        const isSelected = selected.includes(optionValue);
        let next: string[];

        if (isSelected) {
          next = selected.filter((v) => v !== optionValue);
        } else if (max === 1) {
          // Single-select rendered as cards: choosing replaces.
          next = [optionValue];
        } else if (selected.length >= max) {
          // At the cap, drop the oldest choice so the click still does
          // something rather than silently failing.
          next = [...selected.slice(1), optionValue];
        } else {
          next = [...selected, optionValue];
        }

        onChoose(field.name, next);
      }

      const layout =
        field.kind === "swatches"
          ? "grid grid-cols-2 gap-3 sm:grid-cols-4"
          : field.kind === "typefaces"
            ? "flex flex-col gap-3"
            : "flex flex-wrap gap-2";

      return (
        <>
          <div className={layout}>
            {field.options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(option.value)}
                  className={`rounded-md border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-noir bg-cream-light"
                      : "border-noir/20 hover:border-noir/50"
                  }`}
                >
                  {field.kind === "swatches" && option.swatch && (
                    <span
                      aria-hidden="true"
                      className="mb-2 block h-10 w-full rounded"
                      style={{ backgroundColor: option.swatch }}
                    />
                  )}
                  {field.kind === "typefaces" ? (
                    <span className="flex flex-col gap-1">
                      {/* Rendered in its own typeface using build-time or OS
                          families only — nothing is fetched at runtime. */}
                      <span
                        className="text-2xl leading-tight"
                        style={{ fontFamily: option.sampleFont }}
                      >
                        The work of being understood
                      </span>
                      <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                        {option.label}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">{option.label}</span>
                  )}
                </button>
              );
            })}
          </div>
          <SelectionCount field={field} count={selected.length} />
        </>
      );
    }

    case "sliders": {
      const values = {
        ...defaultSliderValues(field),
        ...asNumberRecord(answer[field.name]),
      };

      function update(sliderName: string, next: number, commit: boolean) {
        const merged = { ...values, [sliderName]: next };
        if (commit) onCommit(field.name, merged);
        else onLocalChange(field.name, merged);
      }

      return (
        <div className="flex flex-col gap-5">
          {field.sliders.map((slider) => (
            <label key={slider.name} className="flex flex-col gap-2">
              <span className="flex justify-between font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                <span>{slider.leftLabel}</span>
                <span>{slider.rightLabel}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={values[slider.name] ?? 50}
                className="w-full accent-noir"
                onChange={(e) => update(slider.name, Number(e.target.value), false)}
                onPointerUp={(e) =>
                  update(slider.name, Number(e.currentTarget.value), true)
                }
                onKeyUp={(e) =>
                  update(slider.name, Number(e.currentTarget.value), true)
                }
                onBlur={(e) => update(slider.name, Number(e.target.value), true)}
              />
            </label>
          ))}
        </div>
      );
    }
  }
}

function SelectionCount({
  field,
  count,
}: {
  field: Extract<BriefField, { kind: "multi-choice" | "swatches" | "typefaces" }>;
  count: number;
}) {
  const { minSelect, maxSelect } = field;
  if (!minSelect && !maxSelect) return null;

  let requirement: string;
  if (minSelect && maxSelect && minSelect === maxSelect) {
    requirement = `Choose exactly ${minSelect}.`;
  } else if (minSelect && maxSelect) {
    requirement = `Choose ${minSelect} to ${maxSelect}.`;
  } else if (maxSelect) {
    requirement = `Choose up to ${maxSelect}.`;
  } else {
    requirement = `Choose at least ${minSelect}.`;
  }

  return (
    <p className="font-mono text-xs text-gris-fonce">
      {requirement} {count} selected.
    </p>
  );
}

// --- value coercion --------------------------------------------------------
// Answers come back from Postgres as untyped JSON, so every read narrows.

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    )
  );
}

/** Sliders start centered so a saved answer always has all four positions. */
function withSliderDefaults(step: BriefStep, answer: BriefAnswer): BriefAnswer {
  const next = { ...answer };
  for (const field of step.fields) {
    if (field.kind === "sliders" && !next[field.name]) {
      next[field.name] = defaultSliderValues(field);
    }
  }
  return next;
}
