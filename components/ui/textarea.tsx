"use client";

import { describedBy, Field } from "@/components/ui/field";

export function Textarea({
  id,
  label,
  help,
  error,
  required,
  value,
  onChange,
  onBlur,
  rows = 4,
  placeholder,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Field id={id} label={label} help={help} error={error} required={required}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { help, error })}
        className={`w-full resize-y rounded border bg-paper px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-muted hover:bg-paper-raised ${
          error ? "border-danger" : "border-rule"
        }`}
      />
    </Field>
  );
}
