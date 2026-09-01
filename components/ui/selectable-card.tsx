"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { SelectionDisc } from "@/components/ui/glyphs";

/*
 * Carte sélectionnable — rayon 14px, filet 1px `--line` au repos ; une fois
 * sélectionnée, filet 1px argile et pastille de coche de 18px en haut à
 * droite (§2, géométrie relevée sur l'Écran 1).
 *
 * C'est un vrai contrôle au clavier : <button>, `aria-pressed`, focus visible.
 * La transition de sélection dure 150 ms ; la pastille entre en grandissant.
 */
export function SelectableCard({
  selected,
  onSelect,
  children,
  label,
  disabled = false,
  /** Décalage de la pastille — 8px sur les cartes de palette, 12px sur les cartes de ton. */
  discOffset = "8px",
  padded = true,
  className = "",
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  /** Nom accessible quand le contenu visible ne suffit pas. */
  label?: string;
  disabled?: boolean;
  discOffset?: string;
  /** À false, la carte n'a pas de padding : le contenu va bord à bord (palette). */
  padded?: boolean;
  className?: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Espace et Entrée sont déjà gérés par <button> ; on ne fait qu'empêcher
    // l'espace de faire défiler la page.
    if (event.key === " ") event.preventDefault();
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`relative box-border overflow-hidden rounded-card border text-left transition-colors duration-[var(--dur-select)] disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-accent" : "border-line"
      } ${padded ? "p-[20px_18px]" : ""} ${className}`}
    >
      {selected ? <SelectionDisc offset={discOffset} /> : null}
      {children}
    </button>
  );
}
