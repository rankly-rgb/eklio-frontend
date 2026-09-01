"use client";

import { useRef } from "react";

/*
 * Contrôle segmenté — un VRAI groupe de boutons radio (`role="radiogroup"`,
 * chaque option `role="radio"` + `aria-checked`, flèches gauche/droite pour
 * naviguer), pas un `ChipGroup` en mode `single` : `aria-pressed` décrit un
 * bouton bascule, pas un choix exclusif parmi un ensemble nommé — deux
 * sémantiques différentes pour un lecteur d'écran (§2.7).
 *
 * `value` peut être `null` : rien n'est sélectionné tant que la praticienne
 * n'a pas choisi — on ne présélectionne jamais l'option du milieu.
 */

export type SegmentedOption = { id: string; label: string };

export function SegmentedControl({
  legend,
  options,
  value,
  onChange,
}: {
  /** Nom accessible du groupe. */
  legend: string;
  options: SegmentedOption[];
  value: string | null;
  onChange: (next: string) => void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.id);
    buttons.current[next.id]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className="inline-flex gap-1 rounded-pill border border-line p-1"
    >
      {options.map((option, index) => {
        const selected = value === option.id;
        const tabbable = selected || (value === null && index === 0);
        return (
          <button
            key={option.id}
            ref={(el) => {
              buttons.current[option.id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`box-border flex h-[34px] items-center rounded-pill px-4 text-ui transition-colors duration-[var(--dur-select)] ${
              selected
                ? "border border-accent bg-card text-ink"
                : "border border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
