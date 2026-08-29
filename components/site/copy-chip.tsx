"use client";

import { useEffect, useState, type ReactNode } from "react";

/*
 * Copier une valeur, avec sa confirmation.
 *
 * Une pastille de hex montre la couleur ET la copie au clic : c'est le geste
 * qu'on fait vingt fois d'affilée en remplissant un panneau de palette, et il
 * doit tenir en un clic. La confirmation dure deux secondes et se remplace
 * elle-même — jamais une pile de toasts.
 */
export function useCopied(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Presse-papier refusé (contexte non sécurisé, permission) : on ne dit
      // pas « copié » quand ça ne l'est pas. Le texte reste sélectionnable.
      setCopied(false);
    }
  }

  return [copied, copy];
}

export function CopyChip({
  value,
  label,
  swatch = false,
  onCopied,
}: {
  value: string;
  label: string;
  /** Une valeur `hex` montre sa couleur à gauche. */
  swatch?: boolean;
  onCopied?: () => void;
}) {
  const [copied, copy] = useCopied();

  return (
    <button
      type="button"
      onClick={() => {
        void copy(value).then(onCopied);
      }}
      aria-label={`Copy ${label}: ${value}`}
      className="group flex items-center gap-2.5 rounded-pill border border-line bg-bg py-1 pl-1.5 pr-3.5 text-left hover:bg-card"
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className="size-5 flex-none rounded-pill border border-line"
          style={{ background: value }}
        />
      ) : null}
      <span className="min-w-0">
        <span className="block truncate text-meta leading-body text-ink-2">
          {label}
        </span>
        <span className="block truncate font-mono text-mono tracking-mono-hex text-ink">
          {copied ? "Copied" : value}
        </span>
      </span>
    </button>
  );
}

/** Un bloc de copy : son libellé, son texte, et la copie du texte seul. */
export function CopyBlockRow({
  label,
  text,
  onCopied,
}: {
  label: string;
  text: string;
  onCopied?: () => void;
}) {
  const [copied, copy] = useCopied();

  return (
    <div className="flex items-start gap-3 border-b border-line py-2 last:border-b-0">
      <span className="w-[110px] flex-none pt-0.5 font-mono text-mono uppercase tracking-mono-12 text-ink-3">
        {label}
      </span>
      <p className="min-w-0 flex-1 text-ui leading-body text-ink">{text}</p>
      <button
        type="button"
        onClick={() => {
          void copy(text).then(onCopied);
        }}
        aria-label={`Copy ${label}`}
        className="flex-none rounded-pill border border-line px-3 py-0.5 text-meta text-ink-2 hover:bg-card hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CopyButton({
  text,
  children,
  onCopied,
  variant = "primary",
  className = "",
}: {
  text: string;
  children: ReactNode;
  onCopied?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [copied, copy] = useCopied();

  return (
    <button
      type="button"
      onClick={() => {
        void copy(text).then(onCopied);
      }}
      className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-pill px-[26px] text-ui transition-colors ${
        variant === "primary"
          ? "bg-ink font-semibold text-bg hover:bg-ink-2"
          : "border border-line text-ink hover:bg-card"
      } ${className}`}
    >
      {copied ? "Copied" : children}
    </button>
  );
}
