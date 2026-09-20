import { creditPhrase, shouldShow, type CreditMeter } from "@/lib/billing/credits";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * ── DISCRET, ET JAMAIS L'ÉLÉMENT LE PLUS FORT DE L'ÉCRAN ────────────────
 *
 * Pas de barre de progression, pas de couleur d'alerte, pas de pourcentage.
 * Une ligne de texte d'appui, de la même taille que la justification sous une
 * carte.
 *
 * ⚠ ET IL N'APPARAÎT PAS QUAND IL N'A RIEN À DIRE. Un essai n'a pas de visuel
 * custom ; `shouldShow` retire la ligne plutôt que d'afficher « 0 a month »,
 * qui est un mur là où il n'y avait pas de porte.
 */

const ORDER = ["swap", "regeneration", "custom_visual"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  swap: "Swaps",
  regeneration: "Regenerations",
  custom_visual: "Custom visuals",
};

export function CreditsMeter({ meter }: { meter: CreditMeter }) {
  const lines = ORDER.map((kind) => meter[kind]).filter(shouldShow);
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <MonoLabel tracking="16">This month</MonoLabel>
      <p className="text-helper leading-prose text-ink-2">
        {lines.map((line, i) => (
          <span key={line.kind}>
            {i > 0 ? " · " : ""}
            {LABEL[line.kind as (typeof ORDER)[number]]} {creditPhrase(line)}
          </span>
        ))}
      </p>
    </div>
  );
}
