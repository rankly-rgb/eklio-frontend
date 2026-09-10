"use client";

import { useState } from "react";
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
  collapseAfter,
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
  /**
   * Montre les `collapseAfter` premières options et cache le reste derrière un
   * « Show all ».
   *
   * ⚠ POUR LA LONGUE TRAÎNE, PAS POUR LE CHOIX. Quatorze modalités où une
   * praticienne en coche deux ou trois font cinq écrans et demi sur l'étape 4
   * (`ACQUISITION_WALK.md` §9.1). Les premières couvrent la quasi-totalité des
   * cas ; les dernières sont là pour celles qui les cherchent.
   *
   * ⚠ UNE OPTION COCHÉE RESTE TOUJOURS VISIBLE, où qu'elle soit dans la liste.
   * Replier par-dessus un choix déjà fait le ferait disparaître de l'écran
   * sans le désélectionner — un état que rien à l'écran n'expliquerait.
   */
  collapseAfter?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const collapsible =
    collapseAfter !== undefined && options.length > collapseAfter;

  const shown =
    !collapsible || expanded
      ? options
      : options.filter(
          (option, index) => index < collapseAfter || selected.includes(option.id)
        );
  const hidden = options.length - shown.length;

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
        {shown.map((option) => {
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
                  : /*
                     * ⚠ 44px, NOT 34. Measured at 390px on the brief walk:
                     * every chip in the product was 34px tall — ten under the
                     * touch minimum (WCAG 2.5.8, Apple HIG) — and step 1 alone
                     * puts 22 of them in front of every single visitor.
                     *
                     * `min-h` rather than `h`: a chip whose label wraps at a
                     * narrow width must grow, not clip. The pill radius keeps
                     * its shape either way.
                     */
                    "flex min-h-[44px] items-center rounded-pill border px-4 py-2"
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
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex min-h-[44px] items-center text-ui text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
        >
          {`Show ${hidden} more`}
        </button>
      ) : null}

      {max && mode === "multi" ? (
        <MonoLabel tracking="14" tone="ink-3" className="mt-3 block">
          {`${selected.length} of ${max}`}
        </MonoLabel>
      ) : null}
    </fieldset>
  );
}
