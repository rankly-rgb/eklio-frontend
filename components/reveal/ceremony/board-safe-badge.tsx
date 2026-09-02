"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Le tampon « Board-safe copy » — le différenciateur Ethics Guard (§2). Une
 * pastille ronde, et une petite bulle au clic/focus listant le CONTENU RÉEL
 * de `voice_guide.never_write` : pas un texte de marketing générique sur la
 * déontologie, ses propres contre-exemples à elle.
 *
 * Aucun composant `Tooltip` n'existe dans ce dépôt (vérifié) — celui-ci est
 * scopé à ce seul badge plutôt que de poser une primitive de design système
 * pour un unique appelant.
 */
export function BoardSafeBadge({ neverWrite }: { neverWrite: string[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex size-[68px] flex-col items-center justify-center gap-0.5 rounded-pill border border-line bg-bg text-center font-mono text-mono-sm uppercase leading-tight tracking-mono-10 text-ink-2 transition-colors hover:border-accent hover:text-ink"
      >
        <span>Board-</span>
        <span>safe</span>
        <span>copy</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="What the Ethics Guard never writes for this practice"
          className="brand-preview-static absolute bottom-full left-1/2 z-20 mb-3 w-[280px] -translate-x-1/2 rounded-card border border-line bg-bg p-4 text-left shadow-preview"
        >
          <p className="font-mono text-mono-sm uppercase tracking-mono-12 text-ink-2">
            Never write this
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {neverWrite.map((line) => (
              <li key={line} className="text-meta leading-body text-ink-2">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
