"use client";

import { COLOR_ROLE_KEYS } from "@/lib/site/colors";
import type { SiteErrorBody } from "@/lib/site/types";

/*
 * Le filet de sécurité des erreurs.
 *
 * Un refus qui NOMME un champ s'affiche sur ce champ — c'est la règle, et
 * chaque contrôle la tient de son côté. Restent ceux qui n'en nomment pas
 * (`not_found`, `no_direction`, une coupure réseau) et ceux dont le champ ne
 * correspond à aucun contrôle affiché. Sans ce bloc, ils disparaîtraient en
 * silence, et l'utilisatrice verrait son édition revenir en arrière sans
 * explication.
 *
 * Ce n'est PAS un toast : il reste tant que l'erreur est là, et il est en haut
 * du rail, où on regarde déjà.
 */

/** Les champs qui ont un contrôle capable d'afficher l'erreur lui-même. */
function hasOwnControl(field: string | undefined): boolean {
  if (!field) return false;
  return (
    (COLOR_ROLE_KEYS as string[]).includes(field) ||
    field.startsWith("hero.") ||
    field.startsWith("pages.") ||
    field.startsWith("practice_details.") ||
    field === "about_excerpt" ||
    field === "extra_instructions"
  );
}

export function RailError({
  error,
  onDismiss,
}: {
  error: SiteErrorBody | null;
  onDismiss: () => void;
}) {
  if (!error || hasOwnControl(error.field)) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 border-b border-line px-6 py-4"
    >
      <p className="min-w-0 flex-1 border-l border-[var(--danger)] pl-3 text-meta leading-body text-ink">
        {error.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="size-6 flex-none rounded-check text-ink-3 hover:bg-card hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
