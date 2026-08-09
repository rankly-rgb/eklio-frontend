"use client";

import { describedBy, Field } from "@/components/ui/field";

const inputClasses =
  "w-full rounded border bg-paper px-3 py-2.5 text-base text-ink placeholder:text-ink-muted hover:bg-paper-raised";

export function TextInput({
  id,
  label,
  help,
  error,
  required,
  value,
  onChange,
  onBlur,
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
  placeholder?: string;
}) {
  return (
    <Field id={id} label={label} help={help} error={error} required={required}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { help, error })}
        className={`${inputClasses} ${error ? "border-danger" : "border-rule"}`}
      />
    </Field>
  );
}
