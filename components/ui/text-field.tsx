import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/*
 * Champ de saisie. Libellé en Karla — jamais en monospace (§1) — filet 1px,
 * rayon de carte, fond de page. Le focus est porté par l'anneau global.
 */

const CONTROL =
  "w-full rounded-card border border-line bg-bg px-4 py-3 text-body text-ink placeholder:text-ink-3";

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-ui font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-helper leading-prose text-ink-2">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={CONTROL}
        {...props}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="border-l border-accent pl-3 text-helper text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-ui font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-helper leading-prose text-ink-2">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${CONTROL} leading-prose resize-y`}
        {...props}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="border-l border-accent pl-3 text-helper text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/*
 * Erreur d'une ligne, sous le champ ou sous le groupe. Elle dit quoi faire
 * ensuite.
 *
 * Le TEXTE est en `--ink`, pas en `--accent` : l'argile sur le fond de page
 * mesure 4.20:1, sous le seuil AA du texte courant (cf.
 * `lib/brand/__tests__/contrast.test.ts`). Un message d'erreur illisible est
 * une contradiction. L'argile reste, en filet de 1px — c'est ce qui le fait
 * lire comme une erreur, sans aplat de couleur ni perte de contraste.
 */
export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l border-accent pl-3 text-helper leading-prose text-ink"
    >
      {children}
    </p>
  );
}
