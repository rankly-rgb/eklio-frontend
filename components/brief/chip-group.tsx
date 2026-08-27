"use client";

import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Puces de choix — types de licence, spécialités, objectifs de site, action
 * principale, constructeur visé.
 *
 * Aucune référence ne montre ces puces (les Écrans 1 et 2 sont la palette et
 * le ton) : elles reprennent donc le vocabulaire du système sans en inventer.
 * Pastille, filet 1px au repos, filet argile et fond `--card` une fois
 * choisie. Pas de monospace : ce sont des libellés de formulaire (§1).
 *
 * Chaque puce est un vrai bouton, avec `aria-pressed` (§9).
 */

export type ChipOption = {
  id: string;
  label: string;
  description?: string | null;
};

export function ChipGroup({
  legend,
  options,
  selected,
  onChange,
  mode = "multi",
  max,
  columns,
}: {
  /** Nom accessible du groupe. Rendu en mono seulement s'il est visible. */
  legend: string;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  mode?: "single" | "multi";
  /** Plafond pour un groupe multiple — au-delà, le plus ancien choix tombe. */
  max?: number;
  /** Rendu en grille plutôt qu'en ligne, pour les options à description. */
  columns?: 2 | 3;
}) {
  function toggle(id: string) {
    if (mode === "single") {
      onChange(selected[0] === id ? [] : [id]);
      return;
    }
    if (selected.includes(id)) {
      onChange(selected.filter((entry) => entry !== id));
      return;
    }
    const next = [...selected, id];
    onChange(max && next.length > max ? next.slice(next.length - max) : next);
  }

  return (
    <fieldset className="border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div
        className={
          columns
            ? `grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`
            : "flex flex-wrap gap-2.5"
        }
      >
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option.id)}
              className={`box-border text-left transition-colors duration-[var(--dur-select)] ${
                option.description
                  ? "rounded-card border p-4"
                  : "flex h-[34px] items-center rounded-pill border px-4"
              } ${
                isSelected
                  ? "border-accent bg-card text-ink"
                  : "border-line text-ink-2 hover:text-ink"
              }`}
            >
              <span className="text-ui">{option.label}</span>
              {option.description ? (
                <span className="mt-1.5 block text-ui leading-body text-ink-2">
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {max && mode === "multi" ? (
        <MonoLabel tracking="14" tone="ink-3" className="mt-3 block">
          {`${selected.length} of ${max}`}
        </MonoLabel>
      ) : null}
    </fieldset>
  );
}
