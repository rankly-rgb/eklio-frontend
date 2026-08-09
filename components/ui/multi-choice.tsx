"use client";

import type { ChoiceOption } from "@/components/ui/choice-group";

/*
 * Groupe multi-choix : fieldset/legend + cases à cocher natives. Quand `max`
 * est atteint, les options non cochées sont désactivées et une mention
 * l'explique.
 */
export function MultiChoice({
  name,
  legend,
  help,
  error,
  required,
  options,
  values,
  max,
  onChange,
}: {
  name: string;
  legend: string;
  help?: string;
  error?: string;
  required?: boolean;
  options: ChoiceOption[];
  values: string[];
  max?: number;
  onChange: (values: string[]) => void;
}) {
  const maxReached = max !== undefined && values.length >= max;

  function toggle(value: string) {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value]
    );
  }

  return (
    <fieldset
      aria-describedby={error ? `${name}-erreur` : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="label-mono mb-2 text-ink-muted">
        {legend}
        {required ? null : (
          <span className="ml-2 normal-case tracking-normal">(facultatif)</span>
        )}
      </legend>
      {help && <p className="mb-1 text-sm text-ink-muted">{help}</p>}
      {max !== undefined && (
        <p className="mb-1 font-mono text-xs text-ink-muted">
          {values.length} / {max} sélectionnés
        </p>
      )}
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const checked = values.includes(option.value);
          const disabled = !checked && maxReached;
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 rounded border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                checked
                  ? "border-rule-strong bg-accent-tint"
                  : "border-rule bg-paper"
              } ${
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer hover:bg-paper-raised"
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(option.value)}
                className="size-4 shrink-0 accent-ink focus-visible:outline-none"
              />
              <span className={option.labelClassName ?? "text-base"}>
                {option.label}
              </span>
              {option.swatches && (
                <span className="ml-auto flex shrink-0 gap-1" aria-hidden="true">
                  {option.swatches.map((color) => (
                    <span
                      key={color}
                      className="size-4 rounded-full border border-rule"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${name}-erreur`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
