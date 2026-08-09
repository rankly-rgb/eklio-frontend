"use client";

export type ChoiceOption = {
  value: string;
  label: string;
  /** Aperçu de couleurs (familles chromatiques) — données, pas décor. */
  swatches?: string[];
  /** Classe de police pour rendre l'option dans sa propre typographie. */
  labelClassName?: string;
};

/*
 * Groupe de choix unique : fieldset/legend + radios natifs, navigables au
 * clavier. L'option sélectionnée passe sur fond crème (--accent-tint) avec
 * une bordure --rule-strong.
 */
export function ChoiceGroup({
  name,
  legend,
  help,
  error,
  required,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  help?: string;
  error?: string;
  required?: boolean;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
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
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                checked
                  ? "border-rule-strong bg-accent-tint"
                  : "border-rule bg-paper hover:bg-paper-raised"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
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
