"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import type { SaveState } from "@/components/brief/use-brief-autosave";

/*
 * Le libellé d'enregistrement, ancré en bas à gauche de la colonne de question
 * (Écran 1). Il s'efface après deux secondes.
 *
 * Il vit dans une RÉGION LIVE (§9) : un lecteur d'écran doit apprendre que le
 * travail est sauvegardé, sinon l'autosave est une promesse invisible.
 */
export function SaveStateLabel({
  state,
  error,
}: {
  state: SaveState;
  error: string | null;
}) {
  const message =
    state === "saving"
      ? "Saving"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? (error ?? "Not saved")
          : "";

  return (
    <div role="status" aria-live="polite" className="pb-5">
      {message ? (
        state === "error" ? (
          <p className="border-l border-accent pl-3 text-helper leading-prose text-ink">
            {message}
          </p>
        ) : (
          <MonoLabel tracking="18" tone="ink-3" className="opacity-60">
            {message}
          </MonoLabel>
        )
      ) : (
        // Réserve la hauteur : le libellé apparaît et disparaît sans décaler
        // la colonne au-dessus.
        <span className="block h-[16px]" aria-hidden="true" />
      )}
    </div>
  );
}
