"use client";

import type { ReactNode } from "react";

export function Overline({ children }: { children: ReactNode }) {
  return <div className="overline text-muted">{children}</div>;
}

export function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex-none">
      <div className="mb-2.5 flex justify-end font-mono text-[11px] tracking-[0.16em] text-muted">
        STEP {current} OF {total}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-[3px] rounded-full ${i < current ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center rounded-full bg-ink px-[30px] text-sm font-semibold text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  hidden,
}: {
  children: ReactNode;
  onClick?: () => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center rounded-full border border-line px-[26px] text-sm text-muted transition hover:border-muted"
    >
      {children}
    </button>
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-muted hover:text-ink">
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span className="overline text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-11 rounded-xl border border-line bg-white px-4 text-[15px] outline-none transition focus:border-accent"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="overline text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-xl border border-line bg-white p-4 text-[15px] leading-relaxed outline-none transition focus:border-accent"
      />
      {hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}

/** Carte sélectionnable : bordure terracotta + pastille cochée, comme l'écran 1. */
export function SelectCard({
  selected,
  onClick,
  badge,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col gap-2 rounded-[14px] border p-4 text-left transition ${
        selected ? "border-accent bg-white" : "border-line bg-white/60 hover:border-faint"
      }`}
    >
      {selected ? (
        <span className="absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-paper">
          ✓
        </span>
      ) : null}
      {children}
      {badge ? <span className="overline text-accent">{badge}</span> : null}
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        selected
          ? "border-accent bg-accent/10 text-ink"
          : "border-line bg-white text-muted hover:border-faint"
      }`}
    >
      {children}
    </button>
  );
}
