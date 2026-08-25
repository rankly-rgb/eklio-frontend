"use client";

import { useEffect, useState } from "react";

/*
 * Copie au presse-papiers — valeurs hex, noms de police, prompt multi-plateformes.
 *
 * L'API Clipboard exige un contexte sécurisé et peut être refusée : l'échec est
 * dit explicitement plutôt que de laisser un bouton qui ne fait rien en silence.
 * `aria-live` porte le retour aux lecteurs d'écran, pour qui le changement de
 * libellé passerait autrement inaperçu.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`font-mono text-xs text-ink-muted underline transition-opacity hover:opacity-60 ${className}`}
    >
      {state === "copied"
        ? copiedLabel
        : state === "failed"
          ? "Copy failed — select it manually"
          : label}
    </button>
  );
}
