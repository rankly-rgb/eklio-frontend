"use client";

import { CheckGlyph } from "@/components/ui/glyphs";

/*
 * Case à cocher — carré de 14px (16px en mobile), rayon 3px. Cochée : fond
 * argile et coche blanche ; le libellé passe en `--ink-3` et se barre (§2).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  size = 14,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 14 | 16;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={`box-border flex flex-none items-center justify-center rounded-check transition-colors duration-[var(--dur-select)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)] ${
          checked ? "bg-accent" : "border border-line"
        }`}
        style={{ width: size, height: size, marginTop: size === 14 ? 3 : 2 }}
      >
        {checked ? <CheckGlyph size={size === 14 ? "sm" : "md"} /> : null}
      </span>
      <span
        className={`leading-body ${size === 14 ? "text-ui" : "text-helper"} ${
          checked ? "text-ink-3 line-through decoration-[var(--ink-3)]" : "text-ink"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
