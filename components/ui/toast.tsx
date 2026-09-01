"use client";

import { useEffect } from "react";

/*
 * Toast — carte `--card`, filet 1px, rayon 14px, ancrée en bas à gauche
 * au-dessus de la gouttière. Une seule à la fois, jamais empilée.
 */
export function Toast({
  message,
  onDismiss,
  durationMs = 3000,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="route-enter fixed bottom-[var(--gutter)] left-[var(--gutter)] z-50 rounded-card border border-line bg-card px-6 py-4 text-ui text-ink"
    >
      {message}
    </div>
  );
}
