import type { ReactNode } from "react";

/*
 * Enveloppe commune d'un champ : libellé mono en capitales, aide d'une
 * phrase, message d'erreur relié au champ par aria-describedby (les ids
 * `${id}-aide` / `${id}-erreur` sont construits par describedBy()).
 */
export function describedBy(
  id: string,
  { help, error }: { help?: string; error?: string }
): string | undefined {
  const ids = [help ? `${id}-aide` : null, error ? `${id}-erreur` : null]
    .filter((v): v is string => v !== null)
    .join(" ");
  return ids === "" ? undefined : ids;
}

export function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label-mono text-ink-muted">
        {label}
        {required ? null : (
          <span className="ml-2 normal-case tracking-normal">(facultatif)</span>
        )}
      </label>
      {help && (
        <p id={`${id}-aide`} className="text-sm text-ink-muted">
          {help}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-erreur`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
