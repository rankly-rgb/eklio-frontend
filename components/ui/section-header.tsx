import type { ReactNode } from "react";
import { MonoLabel, type MonoTracking } from "@/components/ui/mono-label";

/*
 * En-tête de section — titre Fraunces 20px, libellé mono facultatif à côté,
 * puis un filet 1px qui court jusqu'à la gouttière droite (`flex:1`).
 *
 * Écart de gouttière relevé sur les références : 24px quand le titre est seul
 * (Écran 5), 20px quand un libellé mono l'accompagne (Écrans 6 et 7).
 */
export function SectionHeader({
  title,
  mono,
  monoTracking = "16",
  trailing,
  id,
}: {
  title: string;
  mono?: string;
  monoTracking?: MonoTracking;
  /** Élément posé après le filet — la pastille BOARD-SAFE COPY, par exemple. */
  trailing?: ReactNode;
  id?: string;
}) {
  return (
    <div className={`flex items-center ${mono ? "gap-5" : "gap-6"}`}>
      <h2
        id={id}
        className="flex-none font-display text-section font-medium text-ink"
      >
        {title}
      </h2>
      {mono ? (
        <MonoLabel tracking={monoTracking} className="flex-none">
          {mono}
        </MonoLabel>
      ) : null}
      {trailing}
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
